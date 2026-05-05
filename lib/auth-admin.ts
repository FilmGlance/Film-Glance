// lib/auth-admin.ts
// Fail-closed authorization for cron and admin endpoints.
//
// Required env: CRON_SECRET.
//   - Missing env  → 503 (monitoring catches misconfig instead of leaving the
//                          endpoint wide open — this is the v6.0.0 audit fix).
//   - Wrong/missing token → 401.
//
// Comparison is constant-time. Pure JS so the helper works in both Node and
// Edge runtimes; we don't import node:crypto.

import { NextRequest, NextResponse } from "next/server";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Returns null when the request carries the correct CRON_SECRET bearer token.
 * Returns a NextResponse error (401 / 503) otherwise.
 *
 * Usage:
 *   const denied = requireCronSecret(req);
 *   if (denied) return denied;
 */
export function requireCronSecret(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Server misconfigured: CRON_SECRET not set" },
      { status: 503 },
    );
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!safeEqual(authHeader, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
