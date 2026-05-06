// app/api/csp-report/route.ts
// Receives CSP violation reports from browsers when the
// `Content-Security-Policy-Report-Only` header in next.config.js fires.
// Logs to Vercel runtime logs; v1 is fire-and-forget, no DB persistence.
//
// Browsers POST these unauthenticated by spec — no requireCronSecret here.
// Body content-type is `application/csp-report`.

import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // Browsers wrap the report in { "csp-report": {...} } per the legacy spec.
    const report = body?.["csp-report"] ?? body;
    console.warn("[csp-violation]", JSON.stringify(report));
  } catch (err) {
    console.warn("[csp-violation] parse failed", err);
  }
  // Always 204 — browser doesn't care, and we don't want to leak parse state.
  return new NextResponse(null, { status: 204 });
}
