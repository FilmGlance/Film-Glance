// app/api/discover/route.ts
//
// /discover page backend — list-only endpoint. Returns up to 100 films
// matching (release_window, genre?, year?, hidden_gems?), ranked by the
// denormalized fg_score column (see migration 016). Anonymous OK.
//
// v6.4.0.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAnon } from "@/lib/supabase-anon";
import { DiscoverQuerySchema } from "@/lib/schemas";

// v6.7.0 hotfix: switched edge → nodejs + bumped to 30s after the Phase-C
// cache growth pushed discover_movies RPC to ~4.2s; edge 25s limit was OK
// but cold-start + 3 parallel RPCs occasionally tripped the gateway. Node
// runtime is more reliable here and tolerates the longer query. Proper fix
// (D4: denormalize popularity + source_count columns) coming next.
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const parsed = DiscoverQuerySchema.safeParse({
    release_window: sp.get("release_window") ?? undefined,
    genre: sp.get("genre") ?? undefined,
    year: sp.get("year") ?? undefined,
    hidden_gems: sp.get("hidden_gems") ?? undefined,
    limit: sp.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues.map((i) => i.message) },
      { status: 400 }
    );
  }
  const { release_window, genre, year, hidden_gems, limit } = parsed.data;

  // Three RPCs in parallel: entries (top N ranked), genres for the dropdown,
  // years for the dropdown. All grant-to-anon so we use the public client.
  const supa = supabaseAnon();
  // v6.7.0 — allSettled so a slow dropdown RPC (genres/years) doesn't fail
  // the whole response. The entries RPC is still required; only it returns 500.
  const settled = await Promise.allSettled([
    supa.rpc("discover_movies", {
      p_release_window: release_window,
      p_genre: genre ?? null,
      p_year: year ?? null,
      p_hidden_gems: hidden_gems ?? false,
      p_limit: limit ?? 100,
    }),
    supa.rpc("discover_genres"),
    supa.rpc("discover_years", {
      p_release_window: release_window,
      p_genre: genre ?? null,
    }),
  ]);
  const entriesRes = settled[0].status === "fulfilled" ? settled[0].value : { data: null, error: settled[0].reason };
  const genresRes = settled[1].status === "fulfilled" ? settled[1].value : { data: null, error: settled[1].reason };
  const yearsRes = settled[2].status === "fulfilled" ? settled[2].value : { data: null, error: settled[2].reason };

  if (entriesRes.error) {
    console.error("[discover] entries error:", entriesRes.error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  const res = NextResponse.json({
    release_window,
    genre: genre ?? null,
    year: year ?? null,
    hidden_gems: hidden_gems ?? false,
    count: (entriesRes.data || []).length,
    available_genres: genresRes.data || [],
    available_years: yearsRes.data || [],
    entries: entriesRes.data || [],
  });
  // 10-min edge cache with SWR — release_window only changes daily at 04:15 UTC.
  res.headers.set("Cache-Control", "public, s-maxage=600, stale-while-revalidate=3600");
  return res;
}
