// lib/ratings.ts — v5.1
// Fetches VERIFIED ratings from 5 APIs and constructs working URLs.
//
// v5.1 FIXES:
//   - TMDB-first ID resolution (more reliable year filtering than OMDb)
//   - Cross-validates OMDb results against expected title/year
//   - Removed Criticker (site is broken/offline)
//   - 10 sources total: 9 verified + 1 estimated (MUBI only)
//
// VERIFIED SOURCES (9 of 10):
//   OMDb       → IMDb rating, RT Critics %, Metacritic score
//   TMDB       → TMDB vote_average, tmdb_id, imdb_id
//   Trakt      → Trakt community rating (0-10)
//   Simkl      → Simkl community rating (0-10)
//   RapidAPI   → RT Audience %, Metacritic User, Letterboxd (0-5)
//                + direct URLs for RT, Metacritic, Letterboxd pages
//
// ESTIMATED SOURCES (1 of 10, from Claude):
//   MUBI — no API exists
//
// URL STRATEGY:
//   IMDb, TMDB, Trakt, Simkl → direct links via verified IDs
//   RT, Metacritic, Letterboxd → direct links from RapidAPI response
//   MUBI → search-page URL (always works)

const OMDB_URL = "https://www.omdbapi.com";
const OMDB_KEY = process.env.OMDB_API_KEY;
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_KEY = process.env.TMDB_API_KEY;
const TRAKT_CLIENT_ID = process.env.TRAKT_CLIENT_ID;
const TRAKT_BASE = "https://api.trakt.tv";
const SIMKL_CLIENT_ID = process.env.SIMKL_CLIENT_ID;
const SIMKL_BASE = "https://api.simkl.com";
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = "movies-ratings2.p.rapidapi.com";

export const RATINGS_DISCLAIMER =
  "Please be advised there might be small discrepancies between various site ratings due to daily rating fluctuations and updates.";

export interface VerifiedData {
  sources: Map<string, { score: number; max: number; url: string }>;
  imdb_id: string | null;
  tmdb_id: number | null;
  trakt_slug: string | null;
  simkl_id: number | null;
  allUrls: Map<string, string>;
}

// ═══════════════════════════════════════════════════════════════════════
// Title similarity check — prevents wrong-movie matches
// ═══════════════════════════════════════════════════════════════════════

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\b(the|a|an)\b/g, "").replace(/\s+/g, " ").trim();
}

function titlesSimilar(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const wa = new Set(na.split(" "));
  const wb = new Set(nb.split(" "));
  const overlap = [...wa].filter((w) => wb.has(w)).length;
  const minLen = Math.min(wa.size, wb.size);
  return minLen > 0 && overlap / minLen >= 0.5;
}

function yearMatches(expected?: number, actual?: string | number): boolean {
  if (!expected || !actual) return true;
  const exp = Number(expected);
  const act = typeof actual === "string" ? parseInt(actual) : actual;
  if (isNaN(exp) || isNaN(act)) return true;
  return Math.abs(exp - act) <= 1;
}

// ═══════════════════════════════════════════════════════════════════════
// TMDB API — PRIMARY ID source (best year filtering)
// ═══════════════════════════════════════════════════════════════════════

interface TMDBMovieResult {
  id: number;
  title: string;
  vote_average: number;
  release_date: string;
}

async function fetchTMDBMovie(title: string, year?: number): Promise<TMDBMovieResult | null> {
  if (!TMDB_KEY) return null;
  try {
    if (year && year > 1900) {
      const params = new URLSearchParams({
        api_key: TMDB_KEY, query: title,
        primary_release_year: String(year), include_adult: "false",
      });
      const res = await fetch(`${TMDB_BASE}/search/movie?${params}`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json();
        const results = data.results as TMDBMovieResult[];
        if (results && results.length > 0) {
          const exact = results.find((r) => titlesSimilar(r.title, title));
          return exact || results[0];
        }
      }
    }
    const params = new URLSearchParams({ api_key: TMDB_KEY, query: title, include_adult: "false" });
    const res = await fetch(`${TMDB_BASE}/search/movie?${params}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    const results = data.results as TMDBMovieResult[];
    if (!results || results.length === 0) return null;
    if (year) {
      const bestMatch = results.find(
        (r) => titlesSimilar(r.title, title) && r.release_date?.startsWith(String(year))
      );
      if (bestMatch) return bestMatch;
      const yearMatch = results.find(
        (r) => r.release_date && yearMatches(year, r.release_date.substring(0, 4))
      );
      if (yearMatch) return yearMatch;
    }
    const titleMatch = results.find((r) => titlesSimilar(r.title, title));
    return titleMatch || results[0];
  } catch { return null; }
}

async function fetchIMDbIdFromTMDB(tmdbId: number): Promise<string | null> {
  if (!TMDB_KEY) return null;
  try {
    const res = await fetch(`${TMDB_BASE}/movie/${tmdbId}/external_ids?api_key=${TMDB_KEY}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return (await res.json()).imdb_id || null;
  } catch { return null; }
}

// ═══════════════════════════════════════════════════════════════════════
// OMDb API — SECONDARY, cross-validated against TMDB
// ═══════════════════════════════════════════════════════════════════════

interface OMDbResponse {
  Title: string;
  Year: string;
  imdbID: string;
  Ratings: { Source: string; Value: string }[];
  Response: string;
}

async function fetchOMDb(title: string, year?: number): Promise<OMDbResponse | null> {
  if (!OMDB_KEY) return null;
  try {
    const params = new URLSearchParams({ apikey: OMDB_KEY, t: title, type: "movie" });
    if (year && year > 1900) params.set("y", String(year));
    const res = await fetch(`${OMDB_URL}?${params}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    return data.Response === "False" ? null : (data as OMDbResponse);
  } catch { return null; }
}

async function fetchOMDbById(imdbId: string): Promise<OMDbResponse | null> {
  if (!OMDB_KEY || !imdbId) return null;
  try {
    const params = new URLSearchParams({ apikey: OMDB_KEY, i: imdbId, type: "movie" });
    const res = await fetch(`${OMDB_URL}?${params}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    return data.Response === "False" ? null : (data as OMDbResponse);
  } catch { return null; }
}

// ═══════════════════════════════════════════════════════════════════════
// Trakt API
// ═══════════════════════════════════════════════════════════════════════

function getTraktHeaders(): Record<string, string> {
  return { "Content-Type": "application/json", "trakt-api-version": "2", "trakt-api-key": TRAKT_CLIENT_ID || "" };
}

async function fetchTraktRating(slug: string): Promise<number> {
  try {
    const res = await fetch(`${TRAKT_BASE}/movies/${slug}/ratings`, { headers: getTraktHeaders(), signal: AbortSignal.timeout(5000) });
    if (!res.ok) return 0;
    const data = await res.json();
    return Math.round(data.rating * 10) / 10;
  } catch { return 0; }
}

async function fetchTrakt(imdbId: string | null, title: string, year?: number): Promise<{ slug: string; rating: number } | null> {
  if (!TRAKT_CLIENT_ID) return null;
  try {
    if (imdbId) {
      const res = await fetch(`${TRAKT_BASE}/search/imdb/${imdbId}?type=movie`, { headers: getTraktHeaders(), signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json();
        const slug = data?.[0]?.movie?.ids?.slug;
        if (slug) return { slug, rating: await fetchTraktRating(slug) };
      }
    }
    const q = encodeURIComponent(title);
    const url = year ? `${TRAKT_BASE}/search/movie?query=${q}&years=${year}` : `${TRAKT_BASE}/search/movie?query=${q}`;
    const res = await fetch(url, { headers: getTraktHeaders(), signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    const slug = data?.[0]?.movie?.ids?.slug;
    if (!slug) return null;
    return { slug, rating: await fetchTraktRating(slug) };
  } catch { return null; }
}

// ═══════════════════════════════════════════════════════════════════════
// Simkl API
// ═══════════════════════════════════════════════════════════════════════

async function fetchSimkl(imdbId: string | null, title: string): Promise<{ simklId: number; rating: number; slug: string } | null> {
  if (!SIMKL_CLIENT_ID) return null;
  try {
    let movieData: any = null;
    if (imdbId) {
      const res = await fetch(`${SIMKL_BASE}/search/id?imdb=${imdbId}&client_id=${SIMKL_CLIENT_ID}`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) movieData = data[0];
      }
    }
    if (!movieData) {
      const q = encodeURIComponent(title);
      const res = await fetch(`${SIMKL_BASE}/search/movie?q=${q}&client_id=${SIMKL_CLIENT_ID}&extended=full`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data || data.length === 0) return null;
      movieData = data[0];
    }
    if (!movieData) return null;
    const simklId = movieData.ids?.simkl || movieData.ids?.simkl_id || 0;
    const slug = movieData.ids?.slug || "";
    const rating = movieData.ratings?.simkl?.rating || 0;
    return { simklId, rating: Math.round(rating * 10) / 10, slug };
  } catch { return null; }
}

// ═══════════════════════════════════════════════════════════════════════
// RapidAPI "Movies Ratings"
// ═══════════════════════════════════════════════════════════════════════

interface RapidAPIRatings {
  imdb?: { score: number; url: string };
  metacritic?: { metascore: number; userScore: number; url: string };
  rotten_tomatoes?: { tomatometer: number; audienceScore: number; url: string };
  letterboxd?: { score: number; url: string };
}

async function fetchRapidAPIRatings(imdbId: string | null, tmdbId: number | null): Promise<RapidAPIRatings | null> {
  if (!RAPIDAPI_KEY || (!imdbId && !tmdbId)) return null;
  try {
    const url = imdbId
      ? `https://${RAPIDAPI_HOST}/ratings?id=${imdbId}`
      : `https://${RAPIDAPI_HOST}/ratings?id=${tmdbId}&mediaType=movie`;
    const res = await fetch(url, {
      headers: { "x-rapidapi-key": RAPIDAPI_KEY, "x-rapidapi-host": RAPIDAPI_HOST },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.ratings || null;
  } catch { return null; }
}

// ═══════════════════════════════════════════════════════════════════════
// URL Construction — Criticker removed
// ═══════════════════════════════════════════════════════════════════════

function buildUrls(
  title: string, year: number | undefined,
  imdbId: string | null, tmdbId: number | null,
  traktSlug: string | null, simklId: number | null,
  rapidUrls: RapidAPIRatings | null
): Map<string, string> {
  const encoded = encodeURIComponent(title);
  const searchWithYear = year ? `${encoded}+${year}` : encoded;
  const urls = new Map<string, string>();

  urls.set("imdb", imdbId ? `https://www.imdb.com/title/${imdbId}/` : `https://www.imdb.com/find/?q=${searchWithYear}&s=tt&ttype=ft`);
  urls.set("tmdb", tmdbId ? `https://www.themoviedb.org/movie/${tmdbId}` : `https://www.themoviedb.org/search?query=${encoded}`);
  urls.set("trakt", traktSlug ? `https://trakt.tv/movies/${traktSlug}` : `https://trakt.tv/search?query=${searchWithYear}`);
  urls.set("simkl", simklId ? `https://simkl.com/movies/${simklId}` : `https://simkl.com/search/?type=movies&q=${encoded}`);

  if (rapidUrls?.rotten_tomatoes?.url) {
    urls.set("rt_critics", rapidUrls.rotten_tomatoes.url);
    urls.set("rt_audience", rapidUrls.rotten_tomatoes.url);
  } else {
    urls.set("rt_critics", `https://www.rottentomatoes.com/search?search=${encoded}`);
    urls.set("rt_audience", `https://www.rottentomatoes.com/search?search=${encoded}`);
  }

  if (rapidUrls?.metacritic?.url) {
    urls.set("metacritic", rapidUrls.metacritic.url);
    urls.set("metacritic_user", rapidUrls.metacritic.url);
  } else {
    urls.set("metacritic", `https://www.metacritic.com/search/${encoded}/`);
    urls.set("metacritic_user", `https://www.metacritic.com/search/${encoded}/`);
  }

  urls.set("letterboxd", rapidUrls?.letterboxd?.url || `https://letterboxd.com/search/${encoded}/`);
  urls.set("mubi", `https://mubi.com/en/search?query=${encoded}`);

  return urls;
}

// ═══════════════════════════════════════════════════════════════════════
// Source Name Matching — Criticker removed
// ═══════════════════════════════════════════════════════════════════════

type SourceKey = "rt_critics" | "rt_audience" | "metacritic" | "metacritic_user" | "imdb" | "letterboxd" | "tmdb" | "trakt" | "simkl" | "mubi";

function identifySource(name: string): SourceKey | null {
  const n = name.toLowerCase();
  if (/rt\s*critic|rotten\s*tomatoes?\s*critic|tomatometer/i.test(n)) return "rt_critics";
  if (/rt\s*audience|rotten\s*tomatoes?\s*audience|popcorn/i.test(n)) return "rt_audience";
  if (/metacritic\s*user/i.test(n)) return "metacritic_user";
  if (/metacritic|metascore/i.test(n)) return "metacritic";
  if (/imdb/i.test(n)) return "imdb";
  if (/letterboxd/i.test(n)) return "letterboxd";
  if (/tmdb|themoviedb/i.test(n)) return "tmdb";
  if (/trakt/i.test(n)) return "trakt";
  if (/simkl/i.test(n)) return "simkl";
  if (/mubi/i.test(n)) return "mubi";
  return null;
}

// ═══════════════════════════════════════════════════════════════════════
// Main: Fetch All Verified Ratings
// TMDB-first: TMDB → IMDb ID → OMDb by ID → Phase 3 parallel
// ═══════════════════════════════════════════════════════════════════════

export async function fetchVerifiedRatings(
  title: string,
  year?: number
): Promise<VerifiedData> {
  const verified: VerifiedData = {
    sources: new Map(),
    imdb_id: null,
    tmdb_id: null,
    trakt_slug: null,
    simkl_id: null,
    allUrls: new Map(),
  };

  // ── Phase 1: TMDB first → get IMDb ID ──
  const tmdbMovie = await fetchTMDBMovie(title, year);
  if (tmdbMovie) {
    verified.tmdb_id = tmdbMovie.id;
    if (tmdbMovie.vote_average > 0) {
      verified.sources.set("tmdb", { score: Math.round(tmdbMovie.vote_average * 10) / 10, max: 10, url: "" });
    }
    verified.imdb_id = await fetchIMDbIdFromTMDB(tmdbMovie.id);
  }

  // ── Phase 2: OMDb using verified IMDb ID (or cross-validated fallback) ──
  let omdbData: OMDbResponse | null = null;
  if (verified.imdb_id) {
    omdbData = await fetchOMDbById(verified.imdb_id);
  } else {
    omdbData = await fetchOMDb(title, year);
    if (omdbData) {
      const titleOk = titlesSimilar(omdbData.Title, title);
      const yearOk = yearMatches(year, omdbData.Year);
      if (!titleOk || !yearOk) {
        console.warn(`OMDb cross-validation FAILED: asked "${title}" (${year}), got "${omdbData.Title}" (${omdbData.Year}). Discarding.`);
        omdbData = null;
      } else {
        verified.imdb_id = omdbData.imdbID || null;
      }
    }
  }

  if (omdbData) {
    for (const r of omdbData.Ratings || []) {
      if (r.Source === "Internet Movie Database") {
        const s = parseFloat(r.Value.split("/")[0]);
        if (!isNaN(s)) verified.sources.set("imdb", { score: s, max: 10, url: "" });
      } else if (r.Source === "Rotten Tomatoes") {
        const s = parseInt(r.Value);
        if (!isNaN(s)) verified.sources.set("rt_critics", { score: s, max: 100, url: "" });
      } else if (r.Source === "Metacritic") {
        const s = parseInt(r.Value.split("/")[0]);
        if (!isNaN(s)) verified.sources.set("metacritic", { score: s, max: 100, url: "" });
      }
    }
  }

  // ── Phase 3: Trakt + Simkl + RapidAPI in parallel ──
  const [traktResult, simklResult, rapidRatings] = await Promise.all([
    fetchTrakt(verified.imdb_id, title, year),
    fetchSimkl(verified.imdb_id, title),
    fetchRapidAPIRatings(verified.imdb_id, verified.tmdb_id),
  ]);

  if (traktResult) {
    verified.trakt_slug = traktResult.slug;
    if (traktResult.rating > 0) verified.sources.set("trakt", { score: traktResult.rating, max: 10, url: "" });
  }
  if (simklResult) {
    verified.simkl_id = simklResult.simklId;
    if (simklResult.rating > 0) verified.sources.set("simkl", { score: simklResult.rating, max: 10, url: "" });
  }
  if (rapidRatings) {
    if (rapidRatings.rotten_tomatoes?.audienceScore)
      verified.sources.set("rt_audience", { score: rapidRatings.rotten_tomatoes.audienceScore, max: 100, url: "" });
    if (rapidRatings.metacritic?.userScore)
      verified.sources.set("metacritic_user", { score: rapidRatings.metacritic.userScore, max: 10, url: "" });
    if (rapidRatings.letterboxd?.score)
      verified.sources.set("letterboxd", { score: rapidRatings.letterboxd.score, max: 5, url: "" });
  }

  // ── Build URLs ──
  verified.allUrls = buildUrls(title, year, verified.imdb_id, verified.tmdb_id, verified.trakt_slug, verified.simkl_id, rapidRatings);
  for (const [key, data] of verified.sources) {
    const url = verified.allUrls.get(key);
    if (url) data.url = url;
  }

  return verified;
}

// ═══════════════════════════════════════════════════════════════════════
// Apply Verified Data to Claude's Sources — removes Criticker
// ═══════════════════════════════════════════════════════════════════════

export function applyVerifiedRatings(claudeSources: any[], verified: VerifiedData): any[] {
  // Filter out Criticker (broken) and any unrecognized sources
  const filtered = claudeSources.filter((s) => {
    const n = s.name?.toLowerCase() || "";
    if (/criticker/i.test(n)) return false; // remove Criticker
    return true;
  });

  const updated = filtered.map((source) => {
    const key = identifySource(source.name);
    if (!key) return source;

    const u = { ...source };
    const verifiedSource = verified.sources.get(key);
    if (verifiedSource) {
      u.score = verifiedSource.score;
      u.max = verifiedSource.max;
      u.verified = true;
    } else {
      u.verified = false;
    }
    const verifiedUrl = verified.allUrls.get(key);
    if (verifiedUrl) u.url = verifiedUrl;
    return u;
  });

  // Add Simkl if Claude didn't include it
  const hasSimkl = updated.some((s) => identifySource(s.name) === "simkl");
  if (!hasSimkl && verified.sources.has("simkl")) {
    const d = verified.sources.get("simkl")!;
    updated.push({ name: "Simkl", score: d.score, max: d.max, type: "community", url: d.url, verified: true });
  }

  return updated;
}
