// app/api/suggest/route.ts
// "Did You Mean?" suggestions for failed movie searches.
//
// Two-tier lookup:
//   1. TMDB exact-token search (fast, free, broad catalog) — handles cases
//      where the user typed a real title or a typo TMDB's tokenizer can still
//      resolve.
//   2. Fuzzy fallback against our Supabase movie_cache via the
//      fuzzy_movie_suggestions() RPC (pg_trgm trigram similarity) — handles
//      character-level typos like "shrak" → Shrek, "mattrix" → The Matrix,
//      "tittttanc" → Titanic. TMDB's API has no fuzzy matching, so without
//      this fallback those queries return nothing.

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_KEY = process.env.TMDB_API_KEY;

type Suggestion = { title: string; year: number | null; poster_path: string | null };

async function tmdbSuggestions(q: string): Promise<Suggestion[]> {
  if (!TMDB_KEY) return [];
  const params = new URLSearchParams({
    api_key: TMDB_KEY,
    query: q,
    include_adult: "false",
  });
  try {
    const res = await fetch(`${TMDB_BASE}/search/movie?${params}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).slice(0, 5).map((m: any) => ({
      title: m.title,
      year: m.release_date ? parseInt(m.release_date.substring(0, 4)) : null,
      poster_path: m.poster_path,
    }));
  } catch {
    return [];
  }
}

async function fuzzyCacheSuggestions(q: string): Promise<Suggestion[]> {
  try {
    const { data, error } = await supabaseAdmin.rpc("fuzzy_movie_suggestions", {
      q,
      max_results: 5,
    });
    if (error || !data) return [];
    return (data as any[]).map((r) => ({
      title: r.title,
      year: typeof r.year === "number" ? r.year : null,
      poster_path: r.poster_path,
    }));
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  const tmdb = await tmdbSuggestions(q);
  if (tmdb.length > 0) {
    return NextResponse.json({ suggestions: tmdb, source: "tmdb" });
  }

  const fuzzy = await fuzzyCacheSuggestions(q);
  return NextResponse.json({ suggestions: fuzzy, source: fuzzy.length > 0 ? "cache_fuzzy" : "none" });
}
