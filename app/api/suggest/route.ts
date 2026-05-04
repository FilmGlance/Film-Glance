// app/api/suggest/route.ts
//
// Did You Mean suggestions — runs TMDB and fuzzy-cache in parallel, merges,
// dedupes, sorts. Earlier "TMDB-or-fuzzy" architecture meant queries like
// "star wr" never reached fuzzy because TMDB returned 5 weak matches for
// the literal token "wr" (Star Wreck, Star Trek...) — and Star Wars from
// our cache never got a chance to surface. New architecture always merges.

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
  runtime: string | null;
  director: string | null;
  release_date: string | null;
  popularity: number;     // for ranking — TMDB popularity, fuzzy uses sim*200
  source: "tmdb" | "fuzzy";
};

function formatRuntimeMins(mins: number | null | undefined): string | null {
  if (!mins || mins <= 0) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

// English poster selection: TMDB's `poster_path` on /movie/{id} can be a
// foreign-language cover. Use `append_to_response=images&include_image_
// language=en,null` to grab English + language-agnostic posters and pick
// the highest-voted one. Same logic lives in lib/tmdb.ts (canonical there).
function pickBestPoster(
  posters: Array<{ file_path: string; iso_639_1: string | null; vote_average: number }> | undefined,
  fallback: string | null,
): string | null {
  if (!posters || posters.length === 0) return fallback;
  const sorted = [...posters].sort((a, b) => {
    const aRank = a.iso_639_1 === "en" ? 2 : a.iso_639_1 == null ? 1 : 0;
    const bRank = b.iso_639_1 === "en" ? 2 : b.iso_639_1 == null ? 1 : 0;
    if (aRank !== bRank) return bRank - aRank;
    return (b.vote_average ?? 0) - (a.vote_average ?? 0);
  });
  return sorted[0]?.file_path ?? fallback;
}

async function tmdbDetails(
  id: number,
): Promise<{ runtime: string | null; director: string | null; poster_path: string | null }> {
  try {
    const res = await fetch(
      `${TMDB_BASE}/movie/${id}?api_key=${TMDB_KEY}&append_to_response=credits,images&include_image_language=en,null&language=en-US`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return { runtime: null, director: null, poster_path: null };
    const d = await res.json();
    const runtime = formatRuntimeMins(d.runtime);
    const directors = (d.credits?.crew || [])
      .filter((c: any) => c.job === "Director")
      .map((c: any) => c.name);
    const director = directors.length > 0 ? directors.join(", ") : null;
    const poster_path = pickBestPoster(d.images?.posters, d.poster_path ?? null);
    return { runtime, director, poster_path };
  } catch {
    return { runtime: null, director: null, poster_path: null };
  }
}

async function tmdbSuggestions(q: string): Promise<Suggestion[]> {
  if (!TMDB_KEY) return [];
  const params = new URLSearchParams({
    api_key: TMDB_KEY,
    query: q,
    include_adult: "false",
    language: "en-US",
    region: "US",
  });
  try {
    const res = await fetch(`${TMDB_BASE}/search/movie?${params}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const top = (data.results || []).slice(0, 8); // pull more — we'll dedupe later
    const enriched = await Promise.all(
      top.map(async (m: any) => {
        const details = await tmdbDetails(m.id);
        return {
          title: m.title,
          year: m.release_date ? parseInt(m.release_date.substring(0, 4)) : null,
          poster_path: details.poster_path ?? m.poster_path,
          overview: m.overview || null,
          runtime: details.runtime,
          director: details.director,
          release_date: m.release_date || null,
          popularity: typeof m.popularity === "number" ? m.popularity : 0,
          source: "tmdb" as const,
        };
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
      max_results: 8,
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
      // Sim is 0..1; ×200 makes a strong typo-match outrank a low-popularity
      // TMDB token-match. TMDB blockbusters typically have popularity 100+,
      // so a sim of 0.6 (= 120) competes with mid-popularity titles, while
      // sim 0.9 (= 180) easily wins.
      popularity: typeof r.sim === "number" ? r.sim * 200 : 0,
      source: "fuzzy" as const,
    }));
  } catch {
    return [];
  }
}

// Some older cached movies have null overview / poster (Claude pipeline didn't
// store every field). For final top-5 entries missing those, do a quick TMDB
// title lookup to backfill. One parallel call per gap, capped at 5.
async function enrichMissingFields(items: Suggestion[]): Promise<Suggestion[]> {
  if (!TMDB_KEY) return items;
  return Promise.all(
    items.map(async (s) => {
      if (s.overview && s.poster_path && s.release_date) return s;
      try {
        const params = new URLSearchParams({
          api_key: TMDB_KEY,
          query: s.title,
          include_adult: "false",
          language: "en-US",
          region: "US",
        });
        if (s.year) params.set("primary_release_year", String(s.year));
        const res = await fetch(`${TMDB_BASE}/search/movie?${params}`, {
          signal: AbortSignal.timeout(3500),
        });
        if (!res.ok) return s;
        const data = await res.json();
        const m = (data.results || [])[0];
        if (!m) return s;
        return {
          ...s,
          overview: s.overview || m.overview || null,
          poster_path: s.poster_path || m.poster_path || null,
          release_date: s.release_date || m.release_date || null,
        };
      } catch {
        return s;
      }
    })
  );
}

function mergeAndRank(tmdb: Suggestion[], fuzzy: Suggestion[]): Suggestion[] {
  const byTitle = new Map<string, Suggestion>();
  // Fuzzy first — its rows have richer metadata (cached Claude data: runtime,
  // director, overview). When TMDB tier returns the same title later, we keep
  // the fuzzy row but copy over any fields TMDB has that fuzzy is missing.
  for (const s of fuzzy) {
    byTitle.set(s.title.toLowerCase(), s);
  }
  for (const s of tmdb) {
    const k = s.title.toLowerCase();
    const existing = byTitle.get(k);
    if (!existing) {
      byTitle.set(k, s);
    } else {
      // Backfill missing fields from TMDB onto the fuzzy row
      byTitle.set(k, {
        ...existing,
        poster_path: existing.poster_path || s.poster_path,
        overview: existing.overview || s.overview,
        runtime: existing.runtime || s.runtime,
        director: existing.director || s.director,
        release_date: existing.release_date || s.release_date,
        // For ranking: keep the higher score (the fuzzy hit is what
        // surfaced it via typo, the TMDB popularity is real-world signal)
        popularity: Math.max(existing.popularity, s.popularity),
      });
    }
  }
  return [...byTitle.values()].sort((a, b) => b.popularity - a.popularity);
}

function sortReleasedFirst(items: Suggestion[]): Suggestion[] {
  const today = new Date().toISOString().substring(0, 10);
  const currentYear = new Date().getFullYear();
  const isUnreleased = (s: Suggestion) => {
    if (s.release_date) return s.release_date > today;
    if (s.year !== null) return s.year > currentYear;
    return true;
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

  const [tmdb, fuzzy] = await Promise.all([
    tmdbSuggestions(q),
    fuzzyCacheSuggestions(q),
  ]);

  const merged = mergeAndRank(tmdb, fuzzy);
  const top5 = merged.slice(0, 5);
  const enriched = await enrichMissingFields(top5);
  const sorted = sortReleasedFirst(enriched);

  return NextResponse.json({
    suggestions: sorted,
    source: tmdb.length > 0 && fuzzy.length > 0 ? "merged" : tmdb.length > 0 ? "tmdb" : "fuzzy",
  });
}
