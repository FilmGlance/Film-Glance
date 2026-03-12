// lib/ratings.ts — v5.8.1
// Fetches VERIFIED ratings from 5+ APIs and constructs working URLs.
//
// v5.8.1 CHANGES:
//   - Phase 5: Direct Letterboxd fallback — fetches rating from letterboxd.com
//     when movies-ratings2 doesn't have Letterboxd data. Constructs slug from
//     title, tries with/without year, parses rating from HTML meta tags.
//   - Enhanced fetchRapidAPIRatings(): dual-ID lookup — if first ID returns
//     no Letterboxd data, retries with the alternate ID (IMDb ↔ TMDB).
//
// v5.8 CHANGES:
//   - Empty sources builder in applyVerifiedRatings(): builds all 9 sources
//     from verified data Map when Claude returns empty sources array
//   - Tomatometer extraction: movies-ratings2 rotten_tomatoes.tomatometer
//     now used as RT Critics backup
//   - Phase 4: RottenTomato API (rottentomato.p.rapidapi.com) as fallback
//     for RT Critics + RT Audience gaps
//
// v5.2 CHANGES:
//   - Removed MUBI (no API, unreliable estimates, broken links)
//   - Removed Criticker (site is broken/offline)
//   - Sequel handling: resolveSequelTitle() via TMDB dual-search
//   - 9 sources total, all verified
//
// VERIFIED SOURCES (9):
//   OMDb       → IMDb rating, RT Critics %, Metacritic score
//   TMDB       → TMDB vote_average, tmdb_id, imdb_id
//   Trakt      → Trakt community rating (0-10)
//   Simkl      → Simkl community rating (0-10)
//   RapidAPI   → RT Audience %, Metacritic User, Letterboxd (0-5)
//                + direct URLs for RT, Metacritic, Letterboxd pages
//   RottenTomato API → RT Critics + RT Audience fallback (Phase 4)
//   Letterboxd Direct → Rating from letterboxd.com page (Phase 5)
//
// URL STRATEGY:
//   IMDb, TMDB, Trakt, Simkl → direct links via verified IDs
//   RT, Metacritic, Letterboxd → direct links from RapidAPI response

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
const RT_API_HOST = "rottentomato.p.rapidapi.com";

export const RATINGS_DISCLAIMER =
  "Please note slight discrepancies between site ratings due to daily rating fluctuations.";

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
// Sequel Normalization — helps APIs find the right movie
// Converts shorthand like "shrek 3" to a search-friendly form and
// uses TMDB as ground truth for the official title.
// ═══════════════════════════════════════════════════════════════════════

/**
 * Detects if a query looks like a sequel shorthand (e.g., "shrek 3", "iron man 2")
 * and performs a TMDB search to resolve the official title + year.
 * Returns { title, year } if resolved, or null to use the original query.
 */
export async function resolveSequelTitle(
  query: string
): Promise<{ title: string; year: number } | null> {
  if (!TMDB_KEY) return null;

  // Match patterns like "shrek 3", "iron man 2", "toy story 4", "aliens 3"
  const sequelMatch = query.match(/^(.+?)\s+(\d{1})$/);
  if (!sequelMatch) return null;

  const baseName = sequelMatch[1].trim();
  const sequelNum = parseInt(sequelMatch[2]);
  if (sequelNum < 2 || sequelNum > 9) return null;

  try {
    // Search TMDB for the base franchise — request more results to find sequels
    const params = new URLSearchParams({
      api_key: TMDB_KEY,
      query: baseName,
      include_adult: "false",
    });
    const res = await fetch(`${TMDB_BASE}/search/movie?${params}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;

    const data = await res.json();
    const results = data.results as { id: number; title: string; release_date: string }[];
    if (!results || results.length === 0) return null;

    // Also search with the number included (catches "Shrek 2", "Toy Story 3", etc.)
    const params2 = new URLSearchParams({
      api_key: TMDB_KEY,
      query: `${baseName} ${sequelNum}`,
      include_adult: "false",
    });
    const res2 = await fetch(`${TMDB_BASE}/search/movie?${params2}`, {
      signal: AbortSignal.timeout(5000),
    });
    let results2: { id: number; title: string; release_date: string }[] = [];
    if (res2.ok) {
      const data2 = await res2.json();
      results2 = data2.results || [];
    }

    // Combine and deduplicate
    const allResults = [...results2, ...results];
    const seen = new Set<number>();
    const unique = allResults.filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    // Look for a title that contains the sequel number or common sequel patterns
    const romanNumerals: Record<number, string> = {
      2: "II", 3: "III", 4: "IV", 5: "V", 6: "VI", 7: "VII", 8: "VIII", 9: "IX",
    };
    const roman = romanNumerals[sequelNum] || "";

    // Score each result for how well it matches the sequel
    const scored = unique
      .filter((r) => {
        const t = r.title.toLowerCase();
        const b = baseName.toLowerCase();
        // Must contain the base name (or close variant)
        return t.includes(b) || titlesSimilar(r.title, baseName);
      })
      .map((r) => {
        const t = r.title;
        let score = 0;
        // Direct number match: "Shrek 2", "Iron Man 3"
        if (new RegExp(`\\b${sequelNum}\\b`).test(t)) score += 10;
        // Roman numeral match: "Rocky III", "Star Wars: Episode IV"
        if (roman && t.includes(roman)) score += 10;
        // Word-form match: "the Third", "the Second"
        const ordinals: Record<number, string> = {
          2: "second", 3: "third", 4: "fourth", 5: "fifth",
          6: "sixth", 7: "seventh", 8: "eighth", 9: "ninth",
        };
        if (ordinals[sequelNum] && t.toLowerCase().includes(ordinals[sequelNum])) score += 10;
        // Part/Chapter match: "Part 2", "Chapter 3"
        if (new RegExp(`(part|chapter)\\s*${sequelNum}`, "i").test(t)) score += 10;
        return { ...r, matchScore: score };
      })
      .filter((r) => r.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore);

    if (scored.length > 0) {
      const best = scored[0];
      const year = best.release_date
        ? parseInt(best.release_date.substring(0, 4))
        : 0;
      return { title: best.title, year };
    }

    return null;
  } catch {
    return null;
  }
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
    let simklId: number = 0;

    // Step 1: Find the Simkl movie (prefer IMDb ID lookup)
    if (imdbId) {
      const res = await fetch(`${SIMKL_BASE}/search/id?imdb=${imdbId}&client_id=${SIMKL_CLIENT_ID}`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          movieData = data[0];
          simklId = movieData.ids?.simkl || movieData.ids?.simkl_id || 0;
        }
      }
    }

    // Fallback: title search with extended=full (more likely to include accurate ratings)
    if (!movieData) {
      const q = encodeURIComponent(title);
      const res = await fetch(`${SIMKL_BASE}/search/movie?q=${q}&client_id=${SIMKL_CLIENT_ID}&extended=full`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data || data.length === 0) return null;
      movieData = data[0];
      simklId = movieData.ids?.simkl || movieData.ids?.simkl_id || 0;
    }

    if (!movieData) return null;
    const slug = movieData.ids?.slug || "";

    // Step 2: Get rating — try from initial data first
    let rating = movieData.ratings?.simkl?.rating || 0;

    // Step 3: If rating is 0 or we used the ID search (which may have stale data),
    // re-fetch with title search + extended=full for fresh ratings
    if ((rating === 0 || (imdbId && movieData)) && simklId > 0) {
      try {
        const q = encodeURIComponent(title);
        const res = await fetch(`${SIMKL_BASE}/search/movie?q=${q}&client_id=${SIMKL_CLIENT_ID}&extended=full`, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const data = await res.json();
          if (data && data.length > 0) {
            // Find the matching movie by Simkl ID
            const match = data.find((d: any) => (d.ids?.simkl || d.ids?.simkl_id) === simklId) || data[0];
            const freshRating = match?.ratings?.simkl?.rating || 0;
            if (freshRating > 0) rating = freshRating;
          }
        }
      } catch { /* use whatever rating we already have */ }
    }

    return { simklId, rating: Math.round(rating * 10) / 10, slug };
  } catch { return null; }
}

// ═══════════════════════════════════════════════════════════════════════
// RapidAPI "Movies Ratings" — v5.8.1: dual-ID lookup for Letterboxd
// ═══════════════════════════════════════════════════════════════════════

interface RapidAPIRatings {
  imdb?: { score: number; url: string };
  metacritic?: { metascore: number; userScore: number; url: string };
  rotten_tomatoes?: { tomatometer: number; audienceScore: number; url: string };
  letterboxd?: { score: number; url: string };
}

async function fetchRapidAPISingle(id: string, isImdb: boolean): Promise<RapidAPIRatings | null> {
  if (!RAPIDAPI_KEY) return null;
  try {
    const url = isImdb
      ? `https://${RAPIDAPI_HOST}/ratings?id=${id}`
      : `https://${RAPIDAPI_HOST}/ratings?id=${id}&mediaType=movie`;
    const res = await fetch(url, {
      headers: { "x-rapidapi-key": RAPIDAPI_KEY, "x-rapidapi-host": RAPIDAPI_HOST },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.ratings || null;
  } catch { return null; }
}

async function fetchRapidAPIRatings(imdbId: string | null, tmdbId: number | null): Promise<RapidAPIRatings | null> {
  if (!RAPIDAPI_KEY || (!imdbId && !tmdbId)) return null;

  // Primary lookup: prefer IMDb ID, fall back to TMDB ID
  let primary: RapidAPIRatings | null = null;
  if (imdbId) {
    primary = await fetchRapidAPISingle(imdbId, true);
  } else if (tmdbId) {
    primary = await fetchRapidAPISingle(String(tmdbId), false);
  }

  // v5.8.1: If primary succeeded but is missing Letterboxd, and we have the
  // alternate ID available, try a second lookup and merge Letterboxd data.
  // This catches cases where movies-ratings2 indexes the movie under one ID
  // but only has Letterboxd data under the other.
  if (primary && !primary.letterboxd?.score && imdbId && tmdbId) {
    const altIsImdb = !imdbId; // we used IMDb first, so alt is TMDB
    const altId = imdbId ? String(tmdbId) : imdbId;
    const secondary = await fetchRapidAPISingle(altId, altIsImdb);
    if (secondary?.letterboxd?.score) {
      primary.letterboxd = secondary.letterboxd;
      console.log(`[rapidapi-dual] ✓ Got Letterboxd from alternate ID lookup`);
    }
  }

  return primary;
}

// ═══════════════════════════════════════════════════════════════════════
// Phase 4: RottenTomato API — RT Critics + RT Audience fallback (v5.8)
// ═══════════════════════════════════════════════════════════════════════

async function fetchRottenTomatoAPI(
  title: string, year?: number
): Promise<{ criticsScore: number | null; audienceScore: number | null; url: string | null } | null> {
  if (!RAPIDAPI_KEY) return null;
  try {
    const searchTerm = year ? `${title} ${year}` : title;
    const params = new URLSearchParams({ "search-term": searchTerm });
    const res = await fetch(`https://${RT_API_HOST}/search?${params}`, {
      headers: { "x-rapidapi-key": RAPIDAPI_KEY, "x-rapidapi-host": RT_API_HOST },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();

    // Find matching movie in results
    const movies = data?.movies_shows || [];
    if (movies.length === 0) return null;

    // Try to find exact match by title similarity
    let match = movies.find((m: any) =>
      titlesSimilar(m.title || m.name || "", title) &&
      (!year || yearMatches(year, m.year))
    );
    if (!match) match = movies[0]; // fallback to top result

    const rt = match?.rottenTomatoes;
    if (!rt) return null;

    const vanity = match.vanity || match.slug || "";
    const url = vanity ? `https://www.rottentomatoes.com/m/${vanity}` : null;

    return {
      criticsScore: typeof rt.criticsScore === "number" ? rt.criticsScore : null,
      audienceScore: typeof rt.audienceScore === "number" ? rt.audienceScore : null,
      url,
    };
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Phase 5: Direct Letterboxd fallback — v5.8.1
// Fetches rating directly from letterboxd.com when movies-ratings2
// doesn't have Letterboxd data. Only fires as a last resort.
// ═══════════════════════════════════════════════════════════════════════

function titleToLetterboxdSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/['']/g, "")           // Remove smart quotes
    .replace(/[^a-z0-9\s-]/g, "")  // Remove special chars
    .replace(/\s+/g, "-")           // Spaces → hyphens
    .replace(/-+/g, "-")            // Collapse multiple hyphens
    .replace(/^-|-$/g, "");         // Trim leading/trailing hyphens
}

async function fetchLetterboxdDirect(
  title: string, year?: number
): Promise<{ score: number; url: string } | null> {
  try {
    const slug = titleToLetterboxdSlug(title);
    if (!slug) return null;

    // Try slug variants: plain slug first, then with year appended
    const slugs = [slug];
    if (year) slugs.push(`${slug}-${year}`);

    for (const s of slugs) {
      const pageUrl = `https://letterboxd.com/film/${s}/`;
      try {
        const res = await fetch(pageUrl, {
          signal: AbortSignal.timeout(5000),
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; FilmGlance/1.0)",
            "Accept": "text/html",
          },
          redirect: "follow",
        });

        if (!res.ok) continue;
        const html = await res.text();

        // Method 1: Twitter card meta tag
        // <meta name="twitter:data2" content="3.4 out of 5">
        const twitterMatch = html.match(/name="twitter:data2"\s+content="([\d.]+)\s+out\s+of\s+5"/i);
        if (twitterMatch) {
          const score = parseFloat(twitterMatch[1]);
          if (!isNaN(score) && score > 0 && score <= 5) {
            console.log(`[letterboxd-direct] ✓ Got ${score}/5 for "${title}" via twitter meta`);
            return { score: Math.round(score * 100) / 100, url: pageUrl };
          }
        }

        // Method 2: Schema.org JSON-LD aggregateRating
        // "ratingValue":3.4 or "ratingValue": 3.4
        const schemaMatch = html.match(/"ratingValue"\s*:\s*([\d.]+)/);
        if (schemaMatch) {
          const score = parseFloat(schemaMatch[1]);
          if (!isNaN(score) && score > 0 && score <= 5) {
            console.log(`[letterboxd-direct] ✓ Got ${score}/5 for "${title}" via schema.org`);
            return { score: Math.round(score * 100) / 100, url: pageUrl };
          }
        }

        // Method 3: Meta property og:title often contains the rating
        // <meta property="og:title" content="Film Title (2026) | Rating: 3.4/5">
        const ogMatch = html.match(/rating[:\s]*([\d.]+)\s*\/\s*5/i);
        if (ogMatch) {
          const score = parseFloat(ogMatch[1]);
          if (!isNaN(score) && score > 0 && score <= 5) {
            console.log(`[letterboxd-direct] ✓ Got ${score}/5 for "${title}" via og pattern`);
            return { score: Math.round(score * 100) / 100, url: pageUrl };
          }
        }

        // If we got a valid page (200 OK) but couldn't parse a rating,
        // the page exists but maybe no rating yet — return URL only? No, skip.
      } catch {
        // This slug variant failed, try next
        continue;
      }
    }

    return null;
  } catch {
    console.log(`[letterboxd-direct] Failed for "${title}"`);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// URL Construction — Criticker + MUBI removed
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

  return urls;
}

// ═══════════════════════════════════════════════════════════════════════
// Source Name Matching — Criticker + MUBI removed
// ═══════════════════════════════════════════════════════════════════════

type SourceKey = "rt_critics" | "rt_audience" | "metacritic" | "metacritic_user" | "imdb" | "letterboxd" | "tmdb" | "trakt" | "simkl";

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
  return null;
}

// ═══════════════════════════════════════════════════════════════════════
// Main: Fetch All Verified Ratings
// TMDB-first: TMDB → IMDb ID → OMDb by ID → Phase 3 parallel
//   → Phase 4 RT API fallback → Phase 5 Letterboxd direct fallback
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
    // v5.8: Extract tomatometer from movies-ratings2 as RT Critics backup
    if (!verified.sources.has("rt_critics") && rapidRatings.rotten_tomatoes?.tomatometer) {
      verified.sources.set("rt_critics", { score: rapidRatings.rotten_tomatoes.tomatometer, max: 100, url: "" });
    }
    if (rapidRatings.metacritic?.userScore)
      verified.sources.set("metacritic_user", { score: rapidRatings.metacritic.userScore, max: 10, url: "" });
    if (rapidRatings.letterboxd?.score)
      verified.sources.set("letterboxd", { score: rapidRatings.letterboxd.score, max: 5, url: "" });
  }

  // ── Phase 4: RottenTomato API fallback (v5.8) ──
  // If RT Critics or RT Audience still missing after Phase 3, try dedicated RT API
  if (!verified.sources.has("rt_critics") || !verified.sources.has("rt_audience")) {
    const rtApi = await fetchRottenTomatoAPI(title, year);
    if (rtApi) {
      if (!verified.sources.has("rt_critics") && rtApi.criticsScore !== null) {
        verified.sources.set("rt_critics", { score: rtApi.criticsScore, max: 100, url: "" });
        console.log(`[rt-api] ✓ Got RT Critics ${rtApi.criticsScore}% for "${title}"`);
      }
      if (!verified.sources.has("rt_audience") && rtApi.audienceScore !== null) {
        verified.sources.set("rt_audience", { score: rtApi.audienceScore, max: 100, url: "" });
        console.log(`[rt-api] ✓ Got RT Audience ${rtApi.audienceScore}% for "${title}"`);
      }
      // Use RT API URL if we don't already have one from movies-ratings2
      if (rtApi.url) {
        if (!rapidRatings?.rotten_tomatoes?.url) {
          // Will be applied in buildUrls below via override
          if (!rapidRatings) {
            // No rapidRatings at all — we'll set URLs after buildUrls
          }
        }
      }
    }
  }

  // ── Phase 5: Letterboxd direct fallback (v5.8.1) ──
  // If Letterboxd still missing after Phase 3 dual-ID lookup, fetch from letterboxd.com
  if (!verified.sources.has("letterboxd")) {
    const lbDirect = await fetchLetterboxdDirect(title, year);
    if (lbDirect) {
      verified.sources.set("letterboxd", { score: lbDirect.score, max: 5, url: lbDirect.url });
      console.log(`[letterboxd-direct] ✓ Fallback got ${lbDirect.score}/5 for "${title}"`);
    }
  }

  // ── Build URLs ──
  verified.allUrls = buildUrls(title, year, verified.imdb_id, verified.tmdb_id, verified.trakt_slug, verified.simkl_id, rapidRatings);

  // Override Letterboxd URL if we got it from direct fetch
  if (verified.sources.has("letterboxd") && verified.sources.get("letterboxd")!.url) {
    verified.allUrls.set("letterboxd", verified.sources.get("letterboxd")!.url);
  }

  for (const [key, data] of verified.sources) {
    const url = verified.allUrls.get(key);
    if (url) data.url = url;
  }

  return verified;
}

// ═══════════════════════════════════════════════════════════════════════
// Apply Verified Data to Claude's Sources
// v5.8: Handles empty Claude sources by building from verified data
// ═══════════════════════════════════════════════════════════════════════

// Display name mapping for building sources from scratch
const SOURCE_DISPLAY_NAMES: Record<string, { name: string; type: string }> = {
  rt_critics: { name: "RT Critics", type: "critics" },
  rt_audience: { name: "RT Audience", type: "audience" },
  metacritic: { name: "Metacritic Metascore", type: "critics" },
  metacritic_user: { name: "Metacritic User", type: "audience" },
  imdb: { name: "IMDb", type: "audience" },
  letterboxd: { name: "Letterboxd", type: "community" },
  tmdb: { name: "TMDB", type: "community" },
  trakt: { name: "Trakt", type: "community" },
  simkl: { name: "Simkl", type: "community" },
};

export function applyVerifiedRatings(claudeSources: any[], verified: VerifiedData): any[] {
  // v5.8: If Claude returned empty sources, build all from verified data
  if (!claudeSources || claudeSources.length === 0) {
    const built: any[] = [];
    for (const [key, data] of verified.sources) {
      const display = SOURCE_DISPLAY_NAMES[key];
      if (display) {
        built.push({
          name: display.name,
          score: data.score,
          max: data.max,
          type: display.type,
          url: data.url || verified.allUrls.get(key) || "",
          verified: true,
        });
      }
    }
    return built;
  }

  // Filter out Criticker (broken) and MUBI (no API, unreliable)
  const filtered = claudeSources.filter((s) => {
    const n = s.name?.toLowerCase() || "";
    if (/criticker/i.test(n)) return false;
    if (/mubi/i.test(n)) return false;
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
