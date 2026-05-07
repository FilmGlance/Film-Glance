// app/api/discover/recent/route.ts
//
// Last 10 cached films matching the discover quality gate, ordered by
// cached_at DESC. Powers the "Recently Added" rail at the top of the
// /discover page so it feels alive.
//
// v6.4.0. Anonymous OK; uses anon client.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAnon } from "@/lib/supabase-anon";

export const runtime = "edge";

export async function GET(_req: NextRequest) {
  const { data, error } = await supabaseAnon().rpc("discover_recent", { p_limit: 10 });
  if (error) {
    console.error("[discover-recent] error:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
  const res = NextResponse.json({ entries: data || [] });
  // 5-min edge cache; new cache writes don't need to be instantly visible here.
  res.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=900");
  return res;
}
