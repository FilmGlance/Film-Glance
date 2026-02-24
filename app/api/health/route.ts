// app/api/health/route.ts
// Lightweight health check endpoint for uptime monitoring.
// Tests connectivity to Supabase and TMDB. No auth required.

import { NextResponse } from "next/server";

const TMDB_KEY = process.env.TMDB_API_KEY;

export async function GET() {
  const checks: Record<string, string> = {};
  let healthy = true;

  // Check Supabase
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      },
      signal: AbortSignal.timeout(5000),
    });
    checks.supabase = res.ok ? "ok" : `error: ${res.status}`;
    if (!res.ok) healthy = false;
  } catch (e) {
    checks.supabase = "unreachable";
    healthy = false;
  }

  // Check TMDB
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/configuration?api_key=${TMDB_KEY}`,
      { signal: AbortSignal.timeout(5000) }
    );
    checks.tmdb = res.ok ? "ok" : `error: ${res.status}`;
    if (!res.ok) healthy = false;
  } catch (e) {
    checks.tmdb = "unreachable";
    healthy = false;
  }

  // Check Anthropic key is present (don't call the API — expensive)
  checks.anthropic_key = process.env.ANTHROPIC_API_KEY ? "configured" : "missing";
  if (!process.env.ANTHROPIC_API_KEY) healthy = false;

  return NextResponse.json(
    { status: healthy ? "healthy" : "degraded", checks, timestamp: new Date().toISOString() },
    { status: healthy ? 200 : 503 }
  );
}
