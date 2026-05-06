// app/api/health/route.ts
// Lightweight health check endpoint.
//
// Public response is intentionally minimal — `{status, timestamp}` — so
// uptime monitors stay happy without leaking which third-party deps we use,
// which keys are configured, or per-service HTTP statuses (audit High 10).
//
// Detailed dependency probe is gated behind `?detailed=1` + CRON_SECRET so
// only operators (or our own monitoring) see it.

import { NextRequest, NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/auth-admin";

const TMDB_KEY = process.env.TMDB_API_KEY;

async function probeSupabase(): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "" },
      signal: AbortSignal.timeout(5000),
    });
    return { ok: res.ok, detail: res.ok ? "ok" : `error: ${res.status}` };
  } catch {
    return { ok: false, detail: "unreachable" };
  }
}

async function probeTMDB(): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/configuration?api_key=${TMDB_KEY}`,
      { signal: AbortSignal.timeout(5000) }
    );
    return { ok: res.ok, detail: res.ok ? "ok" : `error: ${res.status}` };
  } catch {
    return { ok: false, detail: "unreachable" };
  }
}

export async function GET(req: NextRequest) {
  const detailed = req.nextUrl.searchParams.get("detailed") === "1";

  // Detailed mode: requires CRON_SECRET. Returns full dependency status.
  if (detailed) {
    const denied = requireCronSecret(req);
    if (denied) return denied;

    const [supabase, tmdb] = await Promise.all([probeSupabase(), probeTMDB()]);
    const anthropicConfigured = Boolean(process.env.ANTHROPIC_API_KEY);
    const healthy = supabase.ok && tmdb.ok && anthropicConfigured;

    return NextResponse.json(
      {
        status: healthy ? "healthy" : "degraded",
        checks: {
          supabase: supabase.detail,
          tmdb: tmdb.detail,
          anthropic_key: anthropicConfigured ? "configured" : "missing",
        },
        timestamp: new Date().toISOString(),
      },
      { status: healthy ? 200 : 503 }
    );
  }

  // Public mode: minimal response. Only flips to 503 if Supabase is down
  // (the only dep whose availability the user actually depends on for the
  // login flow / cache reads — TMDB outages degrade results but don't break
  // the site; Anthropic key absence is a misconfig, not a runtime concern).
  const supabase = await probeSupabase();
  return NextResponse.json(
    { status: supabase.ok ? "ok" : "degraded", timestamp: new Date().toISOString() },
    { status: supabase.ok ? 200 : 503 }
  );
}
