// app/api/suggest/route.ts
// "Did You Mean?" suggestions for failed movie searches.
//
// Two-tier lookup with enrichment:
//   1. TMDB exact-token search → for hits, parallel-fetch each result's
//      /movie/{id}?append_to_response=credits for runtime + director +
//      release_date (search result alone doesn't include them).
//   2. Fuzzy fallback against movie_cache via fuzzy_movie_suggestions RPC
//      (pg_trgm) — JSONB already has runtime, director.
//
// Sort: released films first, unreleased (release_date > today OR null with
// year > current year) at the bottom.

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_KEY = process.env.TMDB_API_KEY;

type Suggestion = {
  title: string;
  year: number | null;
  poster_path: string | null;
  overview: string | null;
  runtime: string | null;     // "1h 36m" or "90 min" — frontend handles both
  director: string | null;
  release_date: string | null; // ISO YYYY-MM-DD
};

function formatRuntimeMins(mins: number | null | undefined): string | null {
  if (!mins || mins <= 0) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

async function tmdbDetails(id: number): Promise<{ runtime: string | null; director: string | null }> {
  try {
    const res = await fetch(
      `${TMDB_BASE}/movie/${id}?api_key=${TMDB_KEY}&append_to_response=credits`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return { runtime: null, director: null };
    const d = await res.json();
    const runtime = formatRuntimeMins(d.runtime);
    const directors = (d.credits?.crew || [])
      .filter((c: any) => c.job === "Director")
      .map((c: any) => c.name);
    const director = directors.length > 0 ? directors.join(", ") : null;
    return { runtime, director };
  } catch {
    return { runtime: null, director: null };
  }
}

async function tmdbSuggestions(q: string): Promise<Suggestion[]> {
  if (!TMDB_KEY) return [];
  const params = new URLSearchParams({ api_key: TMDB_KEY, query: q, include_adult: "false" });
  try {
    const res = await fetch(`${TMDB_BASE}/search/movie?${params}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const top = (data.results || []).slice(0, 5);
    const enriched = await Promise.all(
      top.map(async (m: any) => {
        const details = await tmdbDetails(m.id);
        return {
          title: m.title,
          year: m.release_date ? parseInt(m.release_date.substring(0, 4)) : null,
          poster_path: m.poster_path,
          overview: m.overview || null,
          runtime: details.runtime,
          director: details.director,
          release_date: m.release_date || null,
        } as Suggestion;
      })
    );
    return enriched;
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
      overview: r.overview || null,
      runtime: r.runtime || null,
      director: r.director || null,
      release_date: r.release_date || null,
    }));
  } catch {
    return [];
  }
}

function sortReleasedFirst(items: Suggestion[]): Suggestion[] {
  const today = new Date().toISOString().substring(0, 10);
  const currentYear = new Date().getFullYear();
  const isUnreleased = (s: Suggestion) => {
    if (s.release_date) return s.release_date > today;
    // No release_date but year is in future → also unreleased
    return s.year !== null && s.year > currentYear;
  };
  const released: Suggestion[] = [];
  const unreleased: Suggestion[] = [];
  for (const s of items) (isUnreleased(s) ? unreleased : released).push(s);
  return [...released, ...unreleased];
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  const tmdb = await tmdbSuggestions(q);
  if (tmdb.length > 0) {
    return NextResponse.json({ suggestions: sortReleasedFirst(tmdb), source: "tmdb" });
  }

  const fuzzy = await fuzzyCacheSuggestions(q);
  return NextResponse.json({
    suggestions: sortReleasedFirst(fuzzy),
    source: fuzzy.length > 0 ? "cache_fuzzy" : "none",
  });
}
