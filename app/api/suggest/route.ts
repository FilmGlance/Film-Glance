// app/api/suggest/route.ts
// Lightweight TMDB search for "Did You Mean?" suggestions.
// Returns up to 5 close movie title matches for misspelled queries.
// No auth required — free TMDB lookup, no Anthropic cost.

import { NextRequest, NextResponse } from "next/server";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_KEY = process.env.TMDB_API_KEY;

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q")?.trim();
    if (!q || q.length < 2) {
      return NextResponse.json({ suggestions: [] });
    }

    if (!TMDB_KEY) {
      return NextResponse.json({ suggestions: [] });
    }

    const params = new URLSearchParams({
      api_key: TMDB_KEY,
      query: q,
      include_adult: "false",
    });

    const res = await fetch(`${TMDB_BASE}/search/movie?${params}`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return NextResponse.json({ suggestions: [] });
    }

    const data = await res.json();
    const results = (data.results || []).slice(0, 5).map((m: any) => ({
      title: m.title,
      year: m.release_date ? parseInt(m.release_date.substring(0, 4)) : null,
      poster_path: m.poster_path,
    }));

    return NextResponse.json({ suggestions: results });
  } catch (err) {
    console.error("Suggest error:", err);
    return NextResponse.json({ suggestions: [] });
  }
}
