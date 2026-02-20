// lib/tmdb.ts
// TMDB API integration for verified movie poster and cast images.
// Called by /api/search after getting movie data from Claude.
// This ensures all images are REAL TMDB paths, not guessed ones.
//
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

export interface TMDBEnrichment {
  poster_path: string | null;
  cast: { name: string; character: string; profile_path: string | null }[];
}

/**
 * Search TMDB for a movie by title and optional year.
 * Returns the best-matching movie ID and poster_path.
 */
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

    // If year provided, prefer exact year match
    if (year) {
      const exactYear = results.find(
        (r) => r.release_date && r.release_date.startsWith(String(year))
      );
      if (exactYear) return exactYear;
    }

    // Otherwise return the first (most relevant) result
    return results[0];
  } catch {
    return null;
  }
}

/**
 * Fetch cast/credits for a TMDB movie ID.
 * Returns the top cast members with verified profile_path.
 */
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
 * Enrich a movie result with verified TMDB images.
 * Takes the movie data from Claude (title, year, cast names)
 * and returns real TMDB poster_path and cast profile_paths.
 *
 * This is the main function called by /api/search.
 */
export async function enrichWithTMDB(
  title: string,
  year?: number,
  claudeCast?: { name: string; character: string }[]
): Promise<TMDBEnrichment> {
  const result: TMDBEnrichment = { poster_path: null, cast: [] };

  if (!TMDB_KEY) return result;

  try {
    // 1. Search for the movie
    const movie = await searchMovie(title, year);
    if (!movie) return result;

    // 2. Set verified poster path
    result.poster_path = movie.poster_path;

    // 3. Fetch credits for verified cast images
    const credits = await fetchCredits(movie.id, 8);

    if (credits.length > 0 && claudeCast && claudeCast.length > 0) {
      // Match Claude's cast data with TMDB credits by name
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
      // No Claude cast — use TMDB credits directly
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
