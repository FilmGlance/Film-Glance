// lib/tmdb.ts
// TMDB API integration for movie data: poster, cast, streaming, trailer, recommendations.
// YouTube Data API integration for video reviews.
// Called by /api/search and /api/enrich.

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_KEY = process.env.TMDB_API_KEY;
const YOUTUBE_KEY = process.env.YOUTUBE_API_KEY;

interface TMDBMovie {
  id: number;
  title: string;
  poster_path: string | null;
  release_date: string;
}

interface TMDBCastMember {
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
}

interface TMDBCredits {
  cast: TMDBCastMember[];
}

export interface StreamingOption {
  platform: string;
  url: string;
  type: "stream" | "rent" | "buy";
  logo_path: string | null;
}

export interface Recommendation {
  title: string;
  year: number;
  poster_path: string | null;
  vote_average: number;
}

export interface VideoReview {
  video_id: string;
  title: string;
  channel: string;
  thumbnail: string;
}

export interface TMDBEnrichment {
  poster_path: string | null;
  cast: { name: string; character: string; profile_path: string | null }[];
  streaming: StreamingOption[];
  trailer_key: string | null;
  recommendations: Recommendation[];
  video_reviews: VideoReview[];
}

// ─── Search Movie ──────────────────────────────────────────────────────────

async function searchMovie(
  title: string,
  year?: number
): Promise<TMDBMovie | null> {
  if (!TMDB_KEY) return null;
  try {
    const params = new URLSearchParams({
      api_key: TMDB_KEY,
      query: title,
      include_adult: "false",
    });
    // Use primary_release_year for strict matching (avoids sequels)
    if (year && year > 1900) params.set("primary_release_year", String(year));

    const res = await fetch(`${TMDB_BASE}/search/movie?${params}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;

    const data = await res.json();
    let results = data.results as TMDBMovie[];
    if (!results || results.length === 0) {
      // Retry without year constraint if strict search found nothing
      if (year) {
        const params2 = new URLSearchParams({ api_key: TMDB_KEY, query: title, include_adult: "false" });
        const res2 = await fetch(`${TMDB_BASE}/search/movie?${params2}`, { signal: AbortSignal.timeout(5000) });
        if (res2.ok) {
          const data2 = await res2.json();
          results = data2.results as TMDBMovie[];
        }
      }
      if (!results || results.length === 0) return null;
    }

    // Prefer exact year match
    if (year) {
      const exactYear = results.find(
        (r) => r.release_date && r.release_date.startsWith(String(year))
      );
      if (exactYear) return exactYear;
    }
    return results[0];
  } catch {
    return null;
  }
}

// ─── Credits ───────────────────────────────────────────────────────────────

async function fetchCredits(
  movieId: number,
  maxCast: number = 8
): Promise<TMDBCastMember[]> {
  if (!TMDB_KEY) return [];
  try {
    const res = await fetch(
      `${TMDB_BASE}/movie/${movieId}/credits?api_key=${TMDB_KEY}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as TMDBCredits;
    return (data.cast || []).slice(0, maxCast);
  } catch {
    return [];
  }
}

// ─── Trailer (TMDB Videos) ────────────────────────────────────────────────

async function fetchTrailer(movieId: number): Promise<string | null> {
  if (!TMDB_KEY) return null;
  try {
    const res = await fetch(
      `${TMDB_BASE}/movie/${movieId}/videos?api_key=${TMDB_KEY}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const videos = data.results || [];

    // Prefer official YouTube trailers, then teasers
    const trailer =
      videos.find(
        (v: any) =>
          v.site === "YouTube" && v.type === "Trailer" && v.official === true
      ) ||
      videos.find(
        (v: any) => v.site === "YouTube" && v.type === "Trailer"
      ) ||
      videos.find(
        (v: any) => v.site === "YouTube" && v.type === "Teaser"
      );

    return trailer ? trailer.key : null;
  } catch {
    return null;
  }
}

// ─── Recommendations (TMDB) ───────────────────────────────────────────────

async function fetchRecommendations(
  movieId: number,
  max: number = 3
): Promise<Recommendation[]> {
  if (!TMDB_KEY) return [];
  try {
    // Try recommendations first
    let res = await fetch(
      `${TMDB_BASE}/movie/${movieId}/recommendations?api_key=${TMDB_KEY}&language=en-US&page=1`,
      { signal: AbortSignal.timeout(5000) }
    );
    let results: any[] = [];
    if (res.ok) {
      const data = await res.json();
      results = data.results || [];
    }

    // Fallback to /similar if recommendations is empty
    if (results.length === 0) {
      res = await fetch(
        `${TMDB_BASE}/movie/${movieId}/similar?api_key=${TMDB_KEY}&language=en-US&page=1`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (res.ok) {
        const data = await res.json();
        results = data.results || [];
      }
    }

    return results.slice(0, max).map((r: any) => ({
      title: r.title,
      year: r.release_date ? parseInt(r.release_date.substring(0, 4)) : 0,
      poster_path: r.poster_path,
      vote_average: r.vote_average || 0,
    }));
  } catch {
    return [];
  }
}

// ─── YouTube Video Reviews ────────────────────────────────────────────────

/**
 * Check if a video title is relevant to the movie we're looking for.
 * Requires the movie title (or significant words) to appear in the video title.
 */
function isRelevantReview(videoTitle: string, movieTitle: string): boolean {
  const vt = videoTitle.toLowerCase();
  const mt = movieTitle.toLowerCase();
  
  // Check if the full movie title appears
  if (vt.includes(mt)) return true;
  
  // Check if significant words from movie title appear (3+ char words)
  const stopWords = new Set(["the", "and", "for", "from", "with", "that", "this"]);
  const words = mt.split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
  if (words.length === 0) return vt.includes(mt);
  
  // All significant words must appear
  return words.every(w => vt.includes(w));
}

async function fetchYouTubeReviews(
  movieTitle: string,
  movieYear?: number,
  max: number = 3
): Promise<VideoReview[]> {
  if (!YOUTUBE_KEY) return [];
  
  // Try multiple query strategies
  const yearStr = movieYear ? ` ${movieYear}` : "";
  const queries = [
    `${movieTitle}${yearStr} movie review`,
    `${movieTitle} film review${yearStr}`,
  ];

  for (const query of queries) {
    try {
      const params = new URLSearchParams({
        part: "snippet",
        q: query,
        type: "video",
        maxResults: "20",
        order: "relevance",
        relevanceLanguage: "en",
        videoEmbeddable: "true",
        key: YOUTUBE_KEY,
      });

      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?${params}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (!res.ok) continue;

      const data = await res.json();

      const all = (data.items || [])
        .map((item: any) => ({
          video_id: item.id?.videoId || "",
          title: item.snippet?.title || "",
          channel: item.snippet?.channelTitle || "",
          thumbnail: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || "",
          published: item.snippet?.publishedAt || "",
        }))
        .filter((v: any) => v.video_id);

      // Strict: "review" in title + movie title words match
      const reviewWords = ["review", "reaction", "breakdown", "critique", "analysis"];
      const items = all
        .filter((v: any) => {
          const t = v.title.toLowerCase();
          const hasReviewWord = reviewWords.some((w: string) => t.includes(w));
          if (!hasReviewWord) return false;
          return isRelevantReview(v.title, movieTitle);
        })
        .slice(0, max);

      if (items.length > 0) return items;
      // If no results from this query, try the next one
    } catch {
      continue;
    }
  }

  // No verified results found with any query — show nothing
  return [];
}

// ─── Platform Search URLs ─────────────────────────────────────────────────

function platformSearchUrl(providerName: string, movieTitle: string): string {
  const t = encodeURIComponent(movieTitle);
  const p = providerName.toLowerCase();
  if (p.includes("netflix")) return `https://www.netflix.com/search?q=${t}`;
  if (p.includes("disney")) return `https://www.disneyplus.com/search/${t}`;
  if (p.includes("amazon") || p.includes("prime")) return `https://www.amazon.com/s?k=${t}&i=instant-video`;
  if (p.includes("crave")) return `https://www.crave.ca/en/search/${t}`;
  if (p.includes("apple")) return `https://tv.apple.com/search?term=${t}`;
  if (p.includes("hulu")) return `https://www.hulu.com/search?q=${t}`;
  if (p.includes("max") || p.includes("hbo")) return `https://play.max.com/search?q=${t}`;
  if (p.includes("paramount")) return `https://www.paramountplus.com/search/${t}/`;
  if (p.includes("peacock")) return `https://www.peacocktv.com/search?q=${t}`;
  if (p.includes("tubi")) return `https://tubitv.com/search/${t}`;
  if (p.includes("google play")) return `https://play.google.com/store/search?q=${t}&c=movies`;
  if (p.includes("youtube")) return `https://www.youtube.com/results?search_query=${t}+full+movie`;
  if (p.includes("vudu") || p.includes("fandango")) return `https://www.vudu.com/content/movies/search?searchString=${t}`;
  if (p.includes("mubi")) return `https://mubi.com/search?query=${t}`;
  if (p.includes("pluto")) return `https://pluto.tv/search/details/${t}`;
  if (p.includes("starz")) return `https://www.starz.com/search?q=${t}`;
  return `https://www.justwatch.com/ca/search?q=${t}`;
}

// ─── Watch Providers ──────────────────────────────────────────────────────

async function fetchWatchProviders(
  movieId: number,
  movieTitle: string,
  region: string = "CA"
): Promise<StreamingOption[]> {
  if (!TMDB_KEY) return [];
  try {
    const res = await fetch(
      `${TMDB_BASE}/movie/${movieId}/watch/providers?api_key=${TMDB_KEY}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return [];

    const data = await res.json();
    const results = data.results || {};
    const regionData = results[region] || results["US"];
    if (!regionData) return [];

    const streaming: StreamingOption[] = [];
    const seen = new Set<string>();

    if (regionData.flatrate) {
      for (const p of regionData.flatrate) {
        if (seen.has(p.provider_name)) continue;
        seen.add(p.provider_name);
        streaming.push({
          platform: p.provider_name,
          url: platformSearchUrl(p.provider_name, movieTitle),
          type: "stream",
          logo_path: p.logo_path,
        });
      }
    }

    if (regionData.rent) {
      for (const p of regionData.rent.slice(0, 3)) {
        if (seen.has(p.provider_name)) continue;
        seen.add(p.provider_name);
        streaming.push({
          platform: p.provider_name,
          url: platformSearchUrl(p.provider_name, movieTitle),
          type: "rent",
          logo_path: p.logo_path,
        });
      }
    }

    if (regionData.buy) {
      for (const p of regionData.buy.slice(0, 2)) {
        if (seen.has(p.provider_name)) continue;
        seen.add(p.provider_name);
        streaming.push({
          platform: p.provider_name,
          url: platformSearchUrl(p.provider_name, movieTitle),
          type: "buy",
          logo_path: p.logo_path,
        });
      }
    }

    return streaming;
  } catch {
    return [];
  }
}

// ─── Person Search (fallback for cast photos) ────────────────────────────

async function searchPerson(name: string): Promise<string | null> {
  if (!TMDB_KEY) return null;
  try {
    const params = new URLSearchParams({
      api_key: TMDB_KEY,
      query: name,
    });
    const res = await fetch(`${TMDB_BASE}/search/person?${params}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const results = data.results || [];
    if (results.length === 0) return null;
    // Prefer exact name match, else take the first result (highest popularity)
    const exact = results.find(
      (p: any) => p.name.toLowerCase().trim() === name.toLowerCase().trim()
    );
    return (exact || results[0])?.profile_path || null;
  } catch {
    return null;
  }
}

// ─── Main Enrichment Function ─────────────────────────────────────────────

export async function enrichWithTMDB(
  title: string,
  year?: number,
  claudeCast?: { name: string; character: string }[],
  options?: { skipYouTube?: boolean }
): Promise<TMDBEnrichment> {
  const result: TMDBEnrichment = {
    poster_path: null,
    cast: [],
    streaming: [],
    trailer_key: null,
    recommendations: [],
    video_reviews: [],
  };

  if (!TMDB_KEY) return result;

  try {
    const movie = await searchMovie(title, year);
    if (!movie) return result;

    result.poster_path = movie.poster_path;

    // Fetch everything in parallel for speed
    const [credits, streaming, trailerKey, recommendations, videoReviews] =
      await Promise.all([
        fetchCredits(movie.id, 20),
        fetchWatchProviders(movie.id, title),
        fetchTrailer(movie.id),
        fetchRecommendations(movie.id, 3),
        options?.skipYouTube ? Promise.resolve([]) : fetchYouTubeReviews(title, year, 3),
      ]);

    result.streaming = streaming;
    result.trailer_key = trailerKey;
    result.recommendations = recommendations;
    result.video_reviews = videoReviews;

    // Cast — match TMDB credits to Claude's cast data, with person search fallback
    if (credits.length > 0 && claudeCast && claudeCast.length > 0) {
      const usedIndices = new Set<number>();
      
      // Phase 1: Name matching (exact, fuzzy, positional)
      const castWithMatches = claudeCast.map((cc, idx) => {
        const ccLower = cc.name.toLowerCase().trim();
        const ccParts = ccLower.split(/\s+/);
        const ccLast = ccParts[ccParts.length - 1];
        const ccFirst = ccParts[0];
        
        // Try exact match
        let tmdbMatch = credits.find(
          (tc, i) => !usedIndices.has(i) && tc.name.toLowerCase().trim() === ccLower
        );
        // Try last name + first initial
        if (!tmdbMatch) {
          tmdbMatch = credits.find((tc, i) => {
            if (usedIndices.has(i)) return false;
            const tcLower = tc.name.toLowerCase().trim();
            const tcParts = tcLower.split(/\s+/);
            const tcLast = tcParts[tcParts.length - 1];
            return tcLast === ccLast && tcParts[0][0] === ccParts[0][0];
          });
        }
        // Try unique last name
        if (!tmdbMatch) {
          const lastNameMatches = credits.filter((tc, i) => {
            if (usedIndices.has(i)) return false;
            const tcLast = tc.name.toLowerCase().trim().split(/\s+/).pop();
            return tcLast === ccLast;
          });
          if (lastNameMatches.length === 1) tmdbMatch = lastNameMatches[0];
        }
        // Try partial name matching (first name + similar last name, or one contains other)
        if (!tmdbMatch) {
          tmdbMatch = credits.find((tc, i) => {
            if (usedIndices.has(i)) return false;
            const tcLower = tc.name.toLowerCase().trim();
            const tcParts = tcLower.split(/\s+/);
            const tcFirst = tcParts[0];
            const tcLast = tcParts[tcParts.length - 1];
            if (tcFirst === ccFirst && ccLast.length >= 3 && tcLast.length >= 3 && 
                (tcLast.startsWith(ccLast.substring(0, 3)) || ccLast.startsWith(tcLast.substring(0, 3)))) return true;
            if (tcLower.includes(ccLower) || ccLower.includes(tcLower)) return true;
            return false;
          });
        }
        // Positional fallback — use TMDB credit at same billing position
        if (!tmdbMatch && idx < credits.length && !usedIndices.has(idx) && credits[idx].profile_path) {
          tmdbMatch = credits[idx];
        }
        
        if (tmdbMatch) {
          const matchIdx = credits.indexOf(tmdbMatch);
          if (matchIdx >= 0) usedIndices.add(matchIdx);
        }
        
        return {
          name: cc.name,
          character: cc.character,
          profile_path: tmdbMatch?.profile_path || null,
        };
      });

      // Phase 2: For any cast still missing photos, search TMDB person API directly
      const needsLookup = castWithMatches
        .map((c, i) => ({ ...c, idx: i }))
        .filter(c => !c.profile_path);
      
      if (needsLookup.length > 0) {
        const lookups = await Promise.all(
          needsLookup.map(c => searchPerson(c.name))
        );
        for (let i = 0; i < needsLookup.length; i++) {
          if (lookups[i]) {
            castWithMatches[needsLookup[i].idx].profile_path = lookups[i];
          }
        }
      }

      result.cast = castWithMatches;
    } else if (credits.length > 0) {
      result.cast = credits.map((tc) => ({
        name: tc.name,
        character: tc.character,
        profile_path: tc.profile_path,
      }));
    }

    return result;
  } catch {
    return result;
  }
}
