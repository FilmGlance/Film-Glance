// lib/ratings.ts — v5.0
// Fetches VERIFIED ratings from 5 APIs and constructs working URLs.
//
// VERIFIED SOURCES (9 of 11):
//   OMDb       → IMDb rating, RT Critics %, Metacritic score
//   TMDB       → TMDB vote_average, tmdb_id, imdb_id
//   Trakt      → Trakt community rating (0-10)
//   Simkl      → Simkl community rating (0-10)
//   RapidAPI   → RT Audience %, Metacritic User, Letterboxd (0-5)
//                + direct URLs for RT, Metacritic, Letterboxd pages
//
// ESTIMATED SOURCES (2 of 11, from Claude):
//   Criticker, MUBI — no APIs exist
//
// URL STRATEGY:
//   IMDb, TMDB, Trakt, Simkl → direct links via verified IDs
//   RT, Metacritic, Letterboxd → direct links from RapidAPI response
//   Criticker, MUBI → search-page URLs (always work)

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

// Disclaimer shown below the source breakdown in the UI
export const RATINGS_DISCLAIMER =
  "Please be advised there might be small discrepancies between various site ratings due to daily rating fluctuations and updates";

export interface VerifiedData {
  sources: Map<string, { score: number; max: number; url: string }>;
  imdb_id: string | null;
  tmdb_id: number | null;
  trakt_slug: string | null;
  simkl_id: number | null;
  allUrls: Map<string, string>;
}

// ═══════════════════════════════════════════════════════════════════════
// OMDb API — returns IMDb rating, RT Critics %, Metacritic score
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
  } catch (err) {
    console.error("OMDb fetch failed:", err);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// TMDB API — returns vote_average, tmdb_id, imdb_id
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
    const params = new URLSearchParams({ api_key: TMDB_KEY, query: title, include_adult: "false" });
    if (year && year > 1900) params.set("primary_release_year", String(year));
    const res = await fetch(`${TMDB_BASE}/search/movie?${params}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    let results = data.results as TMDBMovieResult[];

    if ((!results || results.length === 0) && year) {
      const p2 = new URLSearchParams({ api_key: TMDB_KEY, query: title, include_adult: "false" });
      const r2 = await fetch(`${TMDB_BASE}/search/movie?${p2}`, { signal: AbortSignal.timeout(5000) });
      if (r2.ok) results = (await r2.json()).results as TMDBMovieResult[];
    }
    if (!results || results.length === 0) return null;
    if (year) {
      const exact = results.find((r) => r.release_date?.startsWith(String(year)));
      if (exact) return exact;
    }
    return results[0];
  } catch { return null; }
}

async function fetchIMDbId(tmdbId: number): Promise<string | null> {
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
// Trakt API — returns community rating (0-10) + slug for direct URL
// ═══════════════════════════════════════════════════════════════════════

function getTraktHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "trakt-api-version": "2",
    "trakt-api-key": TRAKT_CLIENT_ID || "",
  };
}

async function fetchTraktRating(slug: string): Promise<number> {
  try {
    const res = await fetch(`${TRAKT_BASE}/movies/${slug}/ratings`, {
      headers: getTraktHeaders(),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return Math.round(data.rating * 10) / 10;
  } catch { return 0; }
}

async function fetchTrakt(imdbId: string | null, title: string, year?: number): Promise<{ slug: string; rating: number } | null> {
  if (!TRAKT_CLIENT_ID) return null;
  try {
    // Prefer IMDb ID lookup (guaranteed correct)
    if (imdbId) {
      const res = await fetch(`${TRAKT_BASE}/search/imdb/${imdbId}?type=movie`, {
        headers: getTraktHeaders(),
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json();
        const slug = data?.[0]?.movie?.ids?.slug;
        if (slug) return { slug, rating: await fetchTraktRating(slug) };
      }
    }
    // Fallback: title search
    const q = encodeURIComponent(title);
    const url = year ? `${TRAKT_BASE}/search/movie?query=${q}&years=${year}` : `${TRAKT_BASE}/search/movie?query=${q}`;
    const res = await fetch(url, { headers: getTraktHeaders(), signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    const slug = data?.[0]?.movie?.ids?.slug;
    if (!slug) return null;
    return { slug, rating: await fetchTraktRating(slug) };
  } catch (err) {
    console.error("Trakt fetch failed:", err);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Simkl API — returns community rating (0-10) + simkl_id for direct URL
// ═══════════════════════════════════════════════════════════════════════

async function fetchSimkl(imdbId: string | null, title: string): Promise<{ simklId: number; rating: number; slug: string } | null> {
  if (!SIMKL_CLIENT_ID) return null;
  try {
    let movieData: any = null;

    // Prefer IMDb ID lookup
    if (imdbId) {
      const res = await fetch(`${SIMKL_BASE}/search/id?imdb=${imdbId}&client_id=${SIMKL_CLIENT_ID}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) movieData = data[0];
      }
    }

    // Fallback: title search
    if (!movieData) {
      const q = encodeURIComponent(title);
      const res = await fetch(`${SIMKL_BASE}/search/movie?q=${q}&client_id=${SIMKL_CLIENT_ID}&extended=full`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data || data.length === 0) return null;
      movieData = data[0];
    }

    if (!movieData) return null;

    const simklId = movieData.ids?.simkl || movieData.ids?.simkl_id || 0;
    const slug = movieData.ids?.slug || "";
    // Simkl ratings are in the 'ratings' object or 'rank' field
    const rating = movieData.ratings?.simkl?.rating || 0;

    return { simklId, rating: Math.round(rating * 10) / 10, slug };
  } catch (err) {
    console.error("Simkl fetch failed:", err);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// RapidAPI "Movies Ratings" — returns RT Audience, Metacritic User,
// Letterboxd scores + DIRECT URLs for RT, Metacritic, Letterboxd
// ═══════════════════════════════════════════════════════════════════════

interface RapidAPIRatings {
  imdb?: { score: number; url: string };
  metacritic?: { metascore: number; userScore: number; url: string };
  rotten_tomatoes?: { tomatometer: number; audienceScore: number; url: string };
  letterboxd?: { score: number; url: string };
}

async function fetchRapidAPIRatings(imdbId: string | null, tmdbId: number | null): Promise<RapidAPIRatings | null> {
  if (!RAPIDAPI_KEY) return null;
  if (!imdbId && !tmdbId) return null;

  try {
    // Prefer IMDb ID (more reliable), fall back to TMDB ID
    let url: string;
    if (imdbId) {
      url = `https://${RAPIDAPI_HOST}/ratings?id=${imdbId}`;
    } else {
      url = `https://${RAPIDAPI_HOST}/ratings?id=${tmdbId}&mediaType=movie`;
    }

    const res = await fetch(url, {
      headers: {
        "x-rapidapi-key": RAPIDAPI_KEY,
        "x-rapidapi-host": RAPIDAPI_HOST,
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      console.error(`RapidAPI ratings failed: ${res.status}`);
      return null;
    }

    const data = await res.json();
    return data?.ratings || null;
  } catch (err) {
    console.error("RapidAPI ratings fetch failed:", err);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// URL Construction
// ═══════════════════════════════════════════════════════════════════════

function buildUrls(
  title: string,
  year: number | undefined,
  imdbId: string | null,
  tmdbId: number | null,
  traktSlug: string | null,
  simklId: number | null,
  rapidUrls: RapidAPIRatings | null
): Map<string, string> {
  const encoded = encodeURIComponent(title);
  const searchWithYear = year ? `${encoded}+${year}` : encoded;
  const urls = new Map<string, string>();

  // ── VERIFIED DIRECT LINKS (from API IDs) ──
  urls.set("imdb", imdbId ? `https://www.imdb.com/title/${imdbId}/` : `https://www.imdb.com/find/?q=${searchWithYear}&s=tt&ttype=ft`);
  urls.set("tmdb", tmdbId ? `https://www.themoviedb.org/movie/${tmdbId}` : `https://www.themoviedb.org/search?query=${encoded}`);
  urls.set("trakt", traktSlug ? `https://trakt.tv/movies/${traktSlug}` : `https://trakt.tv/search?query=${searchWithYear}`);
  urls.set("simkl", simklId ? `https://simkl.com/movies/${simklId}` : `https://simkl.com/search/?type=movies&q=${encoded}`);

  // ── DIRECT LINKS FROM RAPIDAPI (correct movie page, not search) ──
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

  if (rapidUrls?.letterboxd?.url) {
    urls.set("letterboxd", rapidUrls.letterboxd.url);
  } else {
    urls.set("letterboxd", `https://letterboxd.com/search/${encoded}/`);
  }

  // ── SEARCH-PAGE FALLBACKS (niche sites, no API) ──
  urls.set("criticker", `https://www.criticker.com/films/?search=${encoded}`);
  urls.set("mubi", `https://mubi.com/en/search?query=${encoded}`);

  return urls;
}

// ═══════════════════════════════════════════════════════════════════════
// Source Name Matching
// ═══════════════════════════════════════════════════════════════════════

type SourceKey = "rt_critics" | "rt_audience" | "metacritic" | "metacritic_user" | "imdb" | "letterboxd" | "tmdb" | "trakt" | "simkl" | "criticker" | "mubi";

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
  if (/criticker/i.test(n)) return "criticker";
  if (/mubi/i.test(n)) return "mubi";
  return null;
}

// ═══════════════════════════════════════════════════════════════════════
// Main: Fetch All Verified Ratings
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

  // ── Phase 1: OMDb + TMDB in parallel (get IDs first) ──
  const [omdbData, tmdbMovie] = await Promise.all([
    fetchOMDb(title, year),
    fetchTMDBMovie(title, year),
  ]);

  // Process OMDb
  if (omdbData) {
    verified.imdb_id = omdbData.imdbID || null;
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

  // Process TMDB
  if (tmdbMovie) {
    verified.tmdb_id = tmdbMovie.id;
    if (tmdbMovie.vote_average > 0) {
      verified.sources.set("tmdb", { score: Math.round(tmdbMovie.vote_average * 10) / 10, max: 10, url: "" });
    }
    if (!verified.imdb_id) {
      verified.imdb_id = await fetchIMDbId(tmdbMovie.id);
    }
  }

  // ── Phase 2: Trakt + Simkl + RapidAPI in parallel (use IDs from Phase 1) ──
  const [traktResult, simklResult, rapidRatings] = await Promise.all([
    fetchTrakt(verified.imdb_id, title, year),
    fetchSimkl(verified.imdb_id, title),
    fetchRapidAPIRatings(verified.imdb_id, verified.tmdb_id),
  ]);

  // Process Trakt
  if (traktResult) {
    verified.trakt_slug = traktResult.slug;
    if (traktResult.rating > 0) {
      verified.sources.set("trakt", { score: traktResult.rating, max: 10, url: "" });
    }
  }

  // Process Simkl
  if (simklResult) {
    verified.simkl_id = simklResult.simklId;
    if (simklResult.rating > 0) {
      verified.sources.set("simkl", { score: simklResult.rating, max: 10, url: "" });
    }
  }

  // Process RapidAPI — RT Audience, Metacritic User, Letterboxd
  if (rapidRatings) {
    if (rapidRatings.rotten_tomatoes?.audienceScore) {
      verified.sources.set("rt_audience", {
        score: rapidRatings.rotten_tomatoes.audienceScore,
        max: 100,
        url: "",
      });
    }
    if (rapidRatings.metacritic?.userScore) {
      // Metacritic user scores are on a 0-10 scale
      verified.sources.set("metacritic_user", {
        score: rapidRatings.metacritic.userScore,
        max: 10,
        url: "",
      });
    }
    if (rapidRatings.letterboxd?.score) {
      // Letterboxd scores are on a 0-5 scale
      verified.sources.set("letterboxd", {
        score: rapidRatings.letterboxd.score,
        max: 5,
        url: "",
      });
    }
  }

  // ── Build URLs ──
  verified.allUrls = buildUrls(
    title, year,
    verified.imdb_id, verified.tmdb_id,
    verified.trakt_slug, verified.simkl_id,
    rapidRatings
  );

  // Set URLs on verified sources
  for (const [key, data] of verified.sources) {
    const url = verified.allUrls.get(key);
    if (url) data.url = url;
  }

  return verified;
}

// ═══════════════════════════════════════════════════════════════════════
// Apply Verified Data to Claude's Sources
// ═══════════════════════════════════════════════════════════════════════

export function applyVerifiedRatings(
  claudeSources: any[],
  verified: VerifiedData
): any[] {
  // First, apply verified data to Claude's sources
  const updated = claudeSources.map((source) => {
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

    // ALWAYS override URL (never trust Claude's URLs)
    const verifiedUrl = verified.allUrls.get(key);
    if (verifiedUrl) u.url = verifiedUrl;

    return u;
  });

  // Check if Claude included Simkl — if not, add it from verified data
  const hasSimkl = updated.some((s) => identifySource(s.name) === "simkl");
  if (!hasSimkl && verified.sources.has("simkl")) {
    const simklData = verified.sources.get("simkl")!;
    updated.push({
      name: "Simkl",
      score: simklData.score,
      max: simklData.max,
      type: "community",
      url: simklData.url,
      verified: true,
    });
  }

  return updated;
}
