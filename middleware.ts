// middleware.ts
// Runs on every request before it hits route handlers.
// Provides three layers of protection:
//   1. Rate limiting on all API routes (distributed via Upstash when
//      provisioned; in-memory fallback otherwise — see lib/rate-limit.ts)
//   2. Auth enforcement on protected routes
//   3. Security headers on all responses

import { NextRequest, NextResponse } from "next/server";
import { rateLimit, retryAfterSeconds } from "@/lib/rate-limit";

function getIP(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || "unknown";
}

// ─── Route Configuration ────────────────────────────────────────────────────

// Routes that require auth (Bearer token checked here, JWT verified in handler)
const PROTECTED_ROUTES = ["/api/favorites"];

// Routes that skip auth (webhooks, auth callbacks, lightweight lookups)
const PUBLIC_ROUTES = ["/api/webhooks", "/api/auth", "/api/enrich", "/api/suggest", "/api/health", "/api/discover"];

// Per-route rate limits: [maxTokens, refillPerSecond]
const ROUTE_LIMITS: Record<string, [number, number]> = {
  "/api/search":    [10, 10 / 60],    // 10 req/min  — expensive (Claude API)
  "/api/enrich":    [30, 30 / 60],    // 30 req/min  — moderate (TMDB)
  "/api/suggest":   [30, 30 / 60],    // 30 req/min  — moderate (TMDB)
  "/api/favorites": [30, 30 / 60],    // 30 req/min  — lightweight (Supabase)
  "/api/discover":  [30, 30 / 60],    // 30 req/min  — cache-tier; anonymous OK
  "/api/auth":      [5, 5 / 60],      // 5 req/min   — brute-force protection
};

// Fallback for any unlisted API route
const DEFAULT_LIMIT: [number, number] = [60, 60 / 60]; // 60 req/min

// ─── Security Headers ───────────────────────────────────────────────────────

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
};

// ─── Middleware ──────────────────────────────────────────────────────────────

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip non-API routes (pages served normally by Next.js)
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const ip = getIP(req);

  // ── Rate Limiting ──
  // Find the most specific matching route limit
  const matchedRoute = Object.keys(ROUTE_LIMITS).find((r) => pathname.startsWith(r));
  const [maxTokens, refillRate] = matchedRoute
    ? ROUTE_LIMITS[matchedRoute]
    : DEFAULT_LIMIT;

  // Key combines IP + route for granular limiting. Now goes through the
  // shared rateLimit() helper — Upstash-distributed when provisioned, falls
  // back to per-instance in-memory otherwise.
  const rateLimitKey = `${ip}:${matchedRoute || "general"}`;
  const result = await rateLimit(rateLimitKey, {
    maxTokens,
    refillRate,
    windowMs: 60_000,
  });

  if (!result.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSeconds(result)),
          ...SECURITY_HEADERS,
        },
      }
    );
  }

  // ── Auth Check ──
  // Skip public routes
  const isPublic = PUBLIC_ROUTES.some((r) => pathname.startsWith(r));

  if (!isPublic && PROTECTED_ROUTES.some((r) => pathname.startsWith(r))) {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401, headers: SECURITY_HEADERS }
      );
    }
    // JWT validation happens in the route handler (Supabase verifies the token)
    // Middleware does fast rejection of obviously unauthenticated requests
  }

  // ── Response with Security Headers ──
  const response = NextResponse.next();
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }

  return response;
}

export const config = {
  matcher: "/api/:path*",
};
