// middleware.ts
// Runs on every request before it hits route handlers.
// Provides three layers of protection:
//   1. IP-based rate limiting on all API routes
//   2. Auth enforcement on protected routes
//   3. Security headers on all responses

import { NextRequest, NextResponse } from "next/server";

// ─── Rate Limiting (in-memory, per-instance) ────────────────────────────────
// Vercel serverless functions share memory within the same warm instance.
// This provides effective protection against single-source abuse.

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, TokenBucket>();
const CLEANUP_INTERVAL = 5 * 60 * 1000;
const STALE_THRESHOLD = 10 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    if (now - bucket.lastRefill > STALE_THRESHOLD) buckets.delete(key);
  }
}

function checkRate(key: string, maxTokens: number, refillPerSec: number): { allowed: boolean; retryAfter: number } {
  cleanup();
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket) {
    bucket = { tokens: maxTokens, lastRefill: now };
    buckets.set(key, bucket);
  }

  const elapsed = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(maxTokens, bucket.tokens + elapsed * refillPerSec);
  bucket.lastRefill = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return { allowed: true, retryAfter: 0 };
  }

  const waitSeconds = (1 - bucket.tokens) / refillPerSec;
  return { allowed: false, retryAfter: Math.ceil(waitSeconds) };
}

function getIP(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || "unknown";
}

// ─── Route Configuration ────────────────────────────────────────────────────

// Routes that require auth (Bearer token checked here, JWT verified in handler)
const PROTECTED_ROUTES = ["/api/favorites"];

// Routes that skip auth (webhooks, auth callbacks, lightweight lookups)
const PUBLIC_ROUTES = ["/api/webhooks", "/api/auth", "/api/enrich", "/api/suggest", "/api/health"];

// Per-route rate limits: [maxTokens, refillPerSecond]
const ROUTE_LIMITS: Record<string, [number, number]> = {
  "/api/search":    [10, 10 / 60],    // 10 req/min  — expensive (Claude API)
  "/api/enrich":    [30, 30 / 60],    // 30 req/min  — moderate (TMDB)
  "/api/suggest":   [30, 30 / 60],    // 30 req/min  — moderate (TMDB)
  "/api/favorites": [30, 30 / 60],    // 30 req/min  — lightweight (Supabase)
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

export function middleware(req: NextRequest) {
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

  // Key combines IP + route for granular limiting
  const rateLimitKey = `${ip}:${matchedRoute || "general"}`;
  const { allowed, retryAfter } = checkRate(rateLimitKey, maxTokens, refillRate);

  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
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
