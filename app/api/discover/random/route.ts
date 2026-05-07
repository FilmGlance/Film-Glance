// app/api/discover/random/route.ts
//
// Movie Reel Roulette — picks one random movie with fg_score >= min_score
// inside an optional decade bucket. Returns 404 if pool is empty so the UI
// can show a graceful "no movies match" message.
//
// v6.4.0.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAnon } from "@/lib/supabase-anon";
import { DiscoverRandomQuerySchema, decadeRange } from "@/lib/schemas";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const parsed = DiscoverRandomQuerySchema.safeParse({
    decade: sp.get("decade") ?? undefined,
    min_score: sp.get("min_score") ?? undefined,
    genre: sp.get("genre") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues.map((i) => i.message) },
      { status: 400 }
    );
  }
  const { decade, min_score, genre } = parsed.data;
  const { start, end } = decadeRange(decade);
  const minScore = min_score ?? 8.0;

  // Pool size + random pick in parallel — pool size feeds the "spinning from
  // N films" ticker on the spinner, so we always want both.
  const [poolRes, pickRes] = await Promise.all([
    supabaseAnon().rpc("discover_random_pool_size", {
      p_decade_start: start,
      p_decade_end: end,
      p_min_score: minScore,
      p_genre: genre ?? null,
    }),
    supabaseAnon().rpc("discover_random", {
      p_decade_start: start,
      p_decade_end: end,
      p_min_score: minScore,
      p_genre: genre ?? null,
    }),
  ]);

  if (poolRes.error || pickRes.error) {
    console.error("[discover-random] error:", poolRes.error || pickRes.error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  const pool_size = Number(poolRes.data ?? 0);
  const entry = (pickRes.data && pickRes.data[0]) || null;

  if (!entry) {
    return NextResponse.json(
      { error: "No movies match", decade, min_score: minScore, pool_size: 0 },
      { status: 404 }
    );
  }

  // No edge cache — every spin must be fresh.
  const res = NextResponse.json({
    entry,
    pool_size,
    decade,
    genre: genre ?? null,
    min_score: minScore,
    spun_at: new Date().toISOString(),
  });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
