// lib/tmdb.ts
// TMDB API integration for verified movie poster, cast images, and streaming availability.
// Called by /api/search and /api/enrich.
// Free API key: https://www.themoviedb.org/settings/api (v3 auth)

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_KEY = process.env.TMDB_API_KEY;

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

interface WatchProvider {
  provider_name: string;
  provider_id: number;
  logo_path: string | null;
}

export interface StreamingOption {
  platform: string;
  url: string;
  type: "stream" | "rent" | "buy";
  logo_path: string | null;
}

export interface TMDBEnrichment {
  poster_path: string | null;
  cast: { name: string; character: string; profile_path: string | null }[];
  streaming: StreamingOption[];
}

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
    if (year) params.set("year", String(year));

    const res = await fetch(`${TMDB_BASE}/search/movie?${params}`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const results = data.results as TMDBMovie[];

    if (!results || results.length === 0) return null;

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

/**
 * Fetch watch/streaming providers for a TMDB movie ID.
 * Uses TMDB's /watch/providers endpoint which gives real, current availability.
 * Returns providers for US region by default, with link to TMDB watch page.
 */
async function fetchWatchProviders(
  movieId: number,
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

    // Try requested region first, then fall back to US
    const regionData = results[region] || results["US"];
    if (!regionData) return [];

    const tmdbLink = regionData.link || `https://www.themoviedb.org/movie/${movieId}/watch`;
    const streaming: StreamingOption[] = [];

    // Flatrate = subscription streaming (Netflix, Disney+, etc.)
    if (regionData.flatrate) {
      for (const p of regionData.flatrate) {
        streaming.push({
          platform: p.provider_name,
          url: tmdbLink,
          type: "stream",
          logo_path: p.logo_path,
        });
      }
    }

    // Rent
    if (regionData.rent) {
      for (const p of regionData.rent.slice(0, 3)) {
        // Skip if already in streaming
        if (streaming.some(s => s.platform === p.provider_name)) continue;
        streaming.push({
          platform: p.provider_name,
          url: tmdbLink,
          type: "rent",
          logo_path: p.logo_path,
        });
      }
    }

    // Buy (limit to 2)
    if (regionData.buy) {
      for (const p of regionData.buy.slice(0, 2)) {
        if (streaming.some(s => s.platform === p.provider_name)) continue;
        streaming.push({
          platform: p.provider_name,
          url: tmdbLink,
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

export async function enrichWithTMDB(
  title: string,
  year?: number,
  claudeCast?: { name: string; character: string }[]
): Promise<TMDBEnrichment> {
  const result: TMDBEnrichment = { poster_path: null, cast: [], streaming: [] };

  if (!TMDB_KEY) return result;

  try {
    const movie = await searchMovie(title, year);
    if (!movie) return result;

    result.poster_path = movie.poster_path;

    // Fetch credits and watch providers in parallel
    const [credits, streaming] = await Promise.all([
      fetchCredits(movie.id, 8),
      fetchWatchProviders(movie.id),
    ]);

    // Streaming
    result.streaming = streaming;

    // Cast
    if (credits.length > 0 && claudeCast && claudeCast.length > 0) {
      result.cast = claudeCast.map((cc) => {
        const tmdbMatch = credits.find(
          (tc) => tc.name.toLowerCase() === cc.name.toLowerCase()
        );
        return {
          name: cc.name,
          character: cc.character,
          profile_path: tmdbMatch?.profile_path || null,
        };
      });
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
