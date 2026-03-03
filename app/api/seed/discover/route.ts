// app/api/seed/discover/route.ts — v5.6
// Auto-discover popular films via TMDB Discover API and seed them.
// Finds movies NOT already in cache, ordered by popularity.
//
// Usage:
//   POST /api/seed/discover?limit=50&min_votes=200&start_year=1970&end_year=2026
//
// This supplements the hand-curated B1-B12 seed lists by pulling from TMDB's
// catalog of 50,000+ popular films. Deduplicates against existing cache.
//
// Each discovered movie feeds through the standard pipeline:
//   Claude → TMDB enrichment (incl. video reviews) → Verified Ratings → cache write

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { calcScore } from "@/lib/score";
import { enrichWithTMDB } from "@/lib/tmdb";
import { fetchVerifiedRatings, applyVerifiedRatings } from "@/lib/ratings";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_KEY = process.env.TMDB_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-haiku-4-5-20251001";
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const CLAUDE_SYSTEM = [
  "You are a movie database that returns structured JSON data about films.",
  "Return ONLY valid JSON. No markdown fences. No explanation. No commentary.",
  "Always return data even for sequels. Interpret numbered sequels intelligently.",
  "",
  "IMPORTANT: You are a movie data lookup tool ONLY.",
  '- If the input does not look like a movie title, return: {"error": "not_a_movie"}',
].join("\n");

function claudeUserPrompt(title: string): string {
  return `Movie: "${title}"\n\nReturn JSON with: title (official title), year, genre (string like "Action · Comedy"), director, runtime (string like "93 min"), tagline, description, cast (6-8 with name and character), sources (all 9: RT Critics, RT Audience, Metacritic Metascore, Metacritic User, IMDb, Letterboxd, TMDB, Trakt, Simkl — each with name, score as NUMBER, max as NUMBER, type, url), hot_take (object with "good": array of 3 short strings summarizing general positive sentiment about the film, and "bad": array of 3 short strings summarizing general negative sentiment — keep each point to one succinct line, NO SPOILERS, never reveal plot points or endings), boxOffice (budget as "$200,000,000", openingWeekend as "$128,122,480", openingRank as "#X all-time" or null, pta as "$XX,XXX" per-theater average, domestic as dollar string, domesticRank as "#X all-time" or null, international as dollar string, worldwide as dollar string, worldwideRank as "#X all-time" or null, roi as "XXX%" estimated return on investment, theaterCount as number string like "4,662", daysInTheater as "XX days"), awards (award/result/detail for Oscar, Globe, BAFTA, SAG, Cannes etc). ONLY JSON.`;
}

function normalizeCacheKey(q: string): string {
  let key = q.toLowerCase().trim();
  key = key.replace(/^(the|a|an)\s+/i, "");
  key = key.replace(/[''`:;!?.,"()]/g, "").replace(/\s+/g, " ").trim();
  return key;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch one page of TMDB Discover results.
 * Returns array of { title, year } for films matching criteria.
 */
async function discoverPage(
  page: number,
  startYear: number,
  endYear: number,
  minVotes: number,
  language: string = "en"
): Promise<{ title: string; year: number }[]> {
  if (!TMDB_KEY) return [];

  const params = new URLSearchParams({
    api_key: TMDB_KEY,
    sort_by: "popularity.desc",
    "vote_count.gte": String(minVotes),
    "primary_release_date.gte": `${startYear}-01-01`,
    "primary_release_date.lte": `${endYear}-12-31`,
    with_original_language: language,
    include_adult: "false",
    page: String(page),
  });

  try {
    const res = await fetch(`${TMDB_BASE}/discover/movie?${params}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((r: any) => ({
      title: r.title,
      year: r.release_date ? parseInt(r.release_date.substring(0, 4)) : 0,
    }));
  } catch {
    return [];
  }
}

/**
 * Get all existing cache keys to skip already-seeded movies.
 */
async function getExistingCacheKeys(): Promise<Set<string>> {
  const keys = new Set<string>();
  let offset = 0;
  const batchSize = 1000;

  while (true) {
    const { data, error } = await supabaseAdmin
      .from("movie_cache")
      .select("search_key")
      .range(offset, offset + batchSize - 1);

    if (error || !data || data.length === 0) break;
    for (const row of data) {
      keys.add(row.search_key);
    }
    if (data.length < batchSize) break;
    offset += batchSize;
  }

  return keys;
}

async function seedMovie(
  title: string,
  year: number
): Promise<{ title: string; year: number; status: string }> {
  try {
    // Run Claude + TMDB in parallel
    const claudePromise = fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      signal: AbortSignal.timeout(25000),
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 2500,
        system: CLAUDE_SYSTEM,
        messages: [{ role: "user", content: claudeUserPrompt(title) }],
      }),
    });

    const tmdbPromise = enrichWithTMDB(title, year, undefined).catch(() => null);

    const apiRes = await claudePromise;
    if (!apiRes.ok) return { title, year, status: `claude error: ${apiRes.status}` };

    const d = await apiRes.json();
    const txt = (d.content || [])
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n")
      .trim();
    const match = txt.match(/\{[\s\S]*\}/);
    if (!match) return { title, year, status: "no JSON in response" };

    const mv = JSON.parse(match[0]);
    if (!mv.title || !mv.sources) return { title, year, status: "incomplete data" };

    delete mv.poster;
    delete mv.poster_path;

    // Verified ratings + TMDB enrichment
    const [verified, tmdb] = await Promise.all([
      fetchVerifiedRatings(mv.title, mv.year).catch(() => null),
      tmdbPromise,
    ]);

    let tmdbResult = tmdb;
    if (!tmdbResult || !tmdbResult.poster_path) {
      tmdbResult = await enrichWithTMDB(
        mv.title,
        mv.year,
        mv.cast?.map((c: any) => ({ name: c.name, character: c.character }))
      ).catch(() => null);
    }

    if (tmdbResult) {
      if (tmdbResult.poster_path) {
        mv.poster_path = tmdbResult.poster_path;
        mv.poster = `https://image.tmdb.org/t/p/w500${tmdbResult.poster_path}`;
      }
      if (tmdbResult.cast?.length > 0) {
        mv.cast = tmdbResult.cast.map((tc) => ({
          name: tc.name,
          character: tc.character,
          profile_path: tc.profile_path,
        }));
      }
      if ((tmdbResult as any).streaming?.length > 0) mv.streaming = (tmdbResult as any).streaming;
      if ((tmdbResult as any).trailer_key) mv.trailer_key = (tmdbResult as any).trailer_key;
      if ((tmdbResult as any).recommendations?.length > 0) mv.recommendations = (tmdbResult as any).recommendations;
      if ((tmdbResult as any).video_reviews?.length > 0) mv.video_reviews = (tmdbResult as any).video_reviews;
    }

    if (verified) {
      mv.sources = applyVerifiedRatings(mv.sources, verified);
    }

    // Cache with dual keys
    const cacheKey = normalizeCacheKey(title);
    const officialKey = normalizeCacheKey(mv.title);
    const cacheData = {
      data: mv,
      source: "discover-seed" as const,
      hit_count: 0,
      cached_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
    };

    const writes: Promise<any>[] = [
      supabaseAdmin.from("movie_cache").upsert({ search_key: cacheKey, ...cacheData }),
    ];
    if (officialKey !== cacheKey) {
      writes.push(supabaseAdmin.from("movie_cache").upsert({ search_key: officialKey, ...cacheData }));
    }
    await Promise.all(writes);

    return { title, year, status: "seeded" };
  } catch (err: any) {
    return { title, year, status: `error: ${err.message}` };
  }
}

export async function POST(req: NextRequest) {
  // Auth check
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = authHeader.split(" ")[1];
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: "Auth unavailable" }, { status: 503 });
  }

  if (!ANTHROPIC_API_KEY || !TMDB_KEY) {
    return NextResponse.json({ error: "API keys not configured" }, { status: 503 });
  }

  // Parse params
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
  const minVotes = parseInt(url.searchParams.get("min_votes") || "200");
  const startYear = parseInt(url.searchParams.get("start_year") || "1970");
  const endYear = parseInt(url.searchParams.get("end_year") || "2026");
  const lang = url.searchParams.get("lang") || "en";

  console.log(`[discover-seed] Starting: limit=${limit}, votes>=${minVotes}, ${startYear}-${endYear}, lang=${lang}`);

  // Get existing cache keys to skip
  const existingKeys = await getExistingCacheKeys();
  console.log(`[discover-seed] ${existingKeys.size} movies already in cache`);

  // Discover movies from TMDB, skipping already-cached
  const candidates: { title: string; year: number }[] = [];
  let page = 1;
  const maxPages = 50; // TMDB max is 500 pages but we cap for safety

  while (candidates.length < limit && page <= maxPages) {
    const results = await discoverPage(page, startYear, endYear, minVotes, lang);
    if (results.length === 0) break;

    for (const movie of results) {
      if (candidates.length >= limit) break;
      const key = normalizeCacheKey(movie.title);
      if (!existingKeys.has(key)) {
        candidates.push(movie);
        existingKeys.add(key); // Prevent duplicates within this run
      }
    }

    page++;
    await delay(250); // Respect TMDB rate limit (~40 req/10s)
  }

  console.log(`[discover-seed] Found ${candidates.length} uncached movies across ${page - 1} TMDB pages`);

  if (candidates.length === 0) {
    return NextResponse.json({
      summary: { discovered: 0, seeded: 0, errors: 0, message: "All popular films in this range are already cached" },
      results: [],
    });
  }

  // Seed each discovered movie
  const results: { title: string; year: number; status: string }[] = [];
  let seeded = 0;
  let errors = 0;

  for (let i = 0; i < candidates.length; i++) {
    const { title, year } = candidates[i];
    const result = await seedMovie(title, year);
    results.push(result);

    if (result.status === "seeded") seeded++;
    else errors++;

    if ((i + 1) % 10 === 0) {
      console.log(`[discover-seed] Progress: ${i + 1}/${candidates.length} (seeded=${seeded}, errors=${errors})`);
    }

    await delay(1500); // Same rate as regular seed
  }

  console.log(`[discover-seed] Complete: seeded=${seeded}, errors=${errors}`);

  return NextResponse.json({
    summary: {
      discovered: candidates.length,
      tmdb_pages_scanned: page - 1,
      seeded,
      errors,
      start_year: startYear,
      end_year: endYear,
      min_votes: minVotes,
    },
    results,
  });
}
