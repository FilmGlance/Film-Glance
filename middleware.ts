// middleware.ts
// Runs on every request before it hits route handlers.
// Protects API routes and adds security headers.

import { NextRequest, NextResponse } from "next/server";

// Routes that require authentication
const PROTECTED_API_ROUTES = ["/api/search", "/api/favorites"];

// Routes that should NOT require auth (webhooks, auth callbacks)
const PUBLIC_API_ROUTES = ["/api/webhooks", "/api/auth"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip non-API routes (let Next.js handle pages normally)
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Skip public API routes
  if (PUBLIC_API_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.next();
  }

  // Check auth on protected routes
  if (PROTECTED_API_ROUTES.some((r) => pathname.startsWith(r))) {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Token validation happens in the route handler (Supabase verifies JWT)
    // Middleware just does the fast rejection of obviously unauthenticated requests
  }

  // Add security headers to all API responses
  const response = NextResponse.next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");

  return response;
}

export const config = {
  // Run middleware on API routes only
  matcher: "/api/:path*",
};
