// lib/tmdb.ts — v5.7
// TMDB API integration for movie data: poster, cast, streaming, trailer, recommendations.
// Video reviews: RapidAPI "Youtube Search and Download" (primary) → Piped API → Invidious API.
// YouTube Data API v3 removed — replaced by free, unlimited community APIs.
// v5.7: Release date gate — getMovieReleaseInfo() + fetchComingSoonDetails() for unreleased films.
// v5.6: Video review backfill on cache hits with empty reviews (search route).
// Called by /api/search, /api/enrich, /api/seed, /api/seed/discover, /api/patch-video-reviews.

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_KEY = process.env.TMDB_API_KEY;
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_YT_HOST = "youtube-search-and-download.p.rapidapi.com";

interface TMDBMovie {
  id: number;
  title: string;
  poster_path: string | null;
  release_date: string;
  overview?: string;
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
//
// `language=en-US` makes TMDB return English-localized title/overview AND
// affects which poster TMDB ranks as primary. Without it, /search/movie can
// surface a localized poster as the default (e.g. Ever After 1998 returned
// the Dutch "Lang & Gelukkig" cover) — fix verified against the live API.

async function searchMovie(
  title: string,
  year?: number
): Promise<TMDBMovie | null> {
  if (!TMDB_KEY) return null;
  try {
    async function tmdbFetch(q: string, withYear: boolean): Promise<TMDBMovie[]> {
      const p = new URLSearchParams({
        api_key: TMDB_KEY!,
        query: q,
        include_adult: "false",
        language: "en-US",
        region: "US",
      });
      if (withYear && year && year > 1900) p.set("primary_release_year", String(year));
      const r = await fetch(`${TMDB_BASE}/search/movie?${p}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!r.ok) return [];
      const d = await r.json();
      return (d.results as TMDBMovie[]) || [];
    }

    // v5.12.2: parallel search — original query + concatenated form. TMDB
    // stores some canonical titles without spaces ("EverAfter" 1998 Drew
    // Barrymore vs the user's "Ever After"), and the spaced search returns
    // 100+ unrelated obscure results before surfacing the no-space match.
    // Concat results lead the merged list so the canonical no-space title
    // wins the "first exact match in natural order" tiebreaker — for
    // queries without whitespace this is a no-op (concat = original).
    const wantConcat = /\s/.test(title);
    const concatenated = title.replace(/\s+/g, "");
    let [rOrig, rConcat] = await Promise.all([
      tmdbFetch(title, true),
      wantConcat ? tmdbFetch(concatenated, true) : Promise.resolve([]),
    ]);

    if (rOrig.length === 0 && rConcat.length === 0 && year) {
      [rOrig, rConcat] = await Promise.all([
        tmdbFetch(title, false),
        wantConcat ? tmdbFetch(concatenated, false) : Promise.resolve([]),
      ]);
    }

    const seen = new Set<number>();
    const results: TMDBMovie[] = [];
    // Concat first so its top result leads the merge; original next.
    // Skip entries with no release_date — those are TMDB placeholders /
    // unfinished metadata records that would otherwise win the "first
    // exact match" tiebreaker (e.g. "It Follows ()" with no date).
    for (const r of [...rConcat, ...rOrig]) {
      if (!r.release_date || r.release_date.length === 0) continue;
      if (!seen.has(r.id)) {
        seen.add(r.id);
        results.push(r);
      }
    }
    if (results.length === 0) return null;

    // v5.12.2: title-match preference with NO vote_count filtering (per user
    // direction — an obscure exact-title match can be the user's real
    // intent). Tiebreaker among multiple exact matches is "first in merged
    // order", which respects TMDB's own popularity-driven ranking; the
    // concat-form search results lead the merge so canonical no-space TMDB
    // titles ("EverAfter" 1998) come ahead of the spaced-search noise.
    //
    // Two normalizations:
    //   normExact — case-insensitive, strips leading article ("The"/"A"/"An")
    //     AND all whitespace + punctuation. Lets "Ever After" match "EverAfter"
    //     and "Avengers" match "The Avengers".
    //   normWords — case-insensitive, keeps spaces. For ordered-subsequence
    //     matching where word order matters (rejects "After Ever Happy" for
    //     query "Ever After").
    //
    // STAGE 1: whitespace+article-insensitive exact match. If any exist,
    //   prefer year hint, else FIRST in merged order.
    // STAGE 2: ordered-word-subsequence. Same year/first preference.
    // STAGE 3 (fallback): TMDB's first result.
    const normExact = (s: string) =>
      (s || "")
        .toLowerCase()
        .replace(/^(the|a|an)\s+/, "")
        .replace(/[\s:.,!?\-_'"&]+/g, "");
    const normWords = (s: string) =>
      (s || "").toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();

    const queryExact = normExact(title);
    const exactMatches = results.filter((r) => normExact(r.title) === queryExact);
    if (exactMatches.length > 0) {
      if (year) {
        const yr = exactMatches.find(
          (r) => r.release_date && r.release_date.startsWith(String(year)),
        );
        if (yr) return yr;
      }
      return exactMatches[0];
    }

    const qWords = normWords(title).split(" ").filter((w) => w.length > 1);
    const orderedMatches = results.filter((r) => {
      const tWords = normWords(r.title || "").split(" ").filter((w) => w.length > 1);
      let qi = 0;
      for (const tw of tWords) {
        if (qi < qWords.length && tw === qWords[qi]) qi++;
      }
      return qWords.length > 0 && qi === qWords.length;
    });
    if (orderedMatches.length > 0) {
      if (year) {
        const yr = orderedMatches.find(
          (r) => r.release_date && r.release_date.startsWith(String(year)),
        );
        if (yr) return yr;
      }
      return orderedMatches[0];
    }

    // v5.12.4: stripped-containment match — handles the case where TMDB
    // stores a canonical title concatenated with no spaces ("EverAfter")
    // while the user types the human-readable longer form ("Ever After:
    // A Cinderella Story"). Both Stage 1 (whitespace-insensitive exact)
    // and Stage 2 (ordered word subsequence) miss this because: Stage 1
    // requires equality after stripping, and the longer query has extra
    // words; Stage 2 needs the TMDB title's words to span the query in
    // order, but TMDB's title has fewer words. Stripped-containment
    // catches it: "everafter" ⊂ "everafteracinderellastory". Min length
    // 5 guard avoids 2-3-letter coincidences.
    const containedMatches = results.filter((r) => {
      const tStripped = normExact(r.title);
      const minLen = Math.min(tStripped.length, queryExact.length);
      if (minLen < 5) return false;
      return tStripped.includes(queryExact) || queryExact.includes(tStripped);
    });
    if (containedMatches.length > 0) {
      if (year) {
        const yr = containedMatches.find(
          (r) => r.release_date && r.release_date.startsWith(String(year)),
        );
        if (yr) return yr;
      }
      return containedMatches[0];
    }

    if (year) {
      const yr = results.find(
        (r) => r.release_date && r.release_date.startsWith(String(year)),
      );
      if (yr) return yr;
    }
    return results[0];
  } catch {
    return null;
  }
}

// ─── Best English Poster ───────────────────────────────────────────────────
//
// TMDB's /movie/{id} endpoint exposes a community-curated `poster_path` that
// ignores user language preference — for some titles this is a foreign-
// language cover. Fix: fetch /movie/{id}/images with `include_image_language=
// en,null` (English-tagged posters + language-agnostic posters) and pick the
// highest-voted one. Returns null if no English poster found, so callers can
// fall back to whatever poster_path the search returned.
async function fetchBestEnglishPoster(movieId: number): Promise<string | null> {
  if (!TMDB_KEY) return null;
  try {
    const res = await fetch(
      `${TMDB_BASE}/movie/${movieId}/images?api_key=${TMDB_KEY}&include_image_language=en,null`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      posters?: Array<{ file_path: string; iso_639_1: string | null; vote_average: number }>;
    };
    const posters = data.posters || [];
    if (posters.length === 0) return null;
    // Rank: explicit `en` first, then language-agnostic (`null`), then by
    // vote_average desc as tiebreaker.
    const sorted = [...posters].sort((a, b) => {
      const aRank = a.iso_639_1 === "en" ? 2 : a.iso_639_1 == null ? 1 : 0;
      const bRank = b.iso_639_1 === "en" ? 2 : b.iso_639_1 == null ? 1 : 0;
      if (aRank !== bRank) return bRank - aRank;
      return (b.vote_average ?? 0) - (a.vote_average ?? 0);
    });
    return sorted[0]?.file_path ?? null;
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

// ─── YouTube Video Reviews (Multi-Source) ────────────────────────────────

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

/**
 * Primary source: RapidAPI "Youtube Search and Download" (h0p3rwe)
 * 1M requests/month on Pro ($5). No YouTube Data API quota burn.
 */
async function fetchVideoReviewsRapidAPI(
  movieTitle: string,
  movieYear?: number,
  max: number = 3
): Promise<VideoReview[]> {
  if (!RAPIDAPI_KEY) return [];

  const yearStr = movieYear ? ` ${movieYear}` : "";
  const query = `${movieTitle}${yearStr} movie review`;

  try {
    const params = new URLSearchParams({ query });
    const res = await fetch(
      `https://${RAPIDAPI_YT_HOST}/search?${params}`,
      {
        headers: {
          "x-rapidapi-key": RAPIDAPI_KEY,
          "x-rapidapi-host": RAPIDAPI_YT_HOST,
        },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!res.ok) return [];

    const data = await res.json();
    const items = data.contents || data.items || [];

    const reviewWords = ["review", "reaction", "breakdown", "critique", "analysis"];

    const reviews = items
      .filter((item: any) => item.video) // RapidAPI wraps in { video: {...} }
      .map((item: any) => {
        const v = item.video;
        return {
          video_id: v.videoId || "",
          title: v.title || "",
          channel: v.author || v.channelName || "",
          thumbnail: v.thumbnails?.[0]?.url || v.thumbnail || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
        };
      })
      .filter((v: VideoReview) => {
        if (!v.video_id) return false;
        const t = v.title.toLowerCase();
        const hasReviewWord = reviewWords.some((w: string) => t.includes(w));
        if (!hasReviewWord) return false;
        return isRelevantReview(v.title, movieTitle);
      })
      .slice(0, max);

    return reviews;
  } catch {
    return [];
  }
}

/**
 * Fallback source 1: Piped API (free, no API key, no quota).
 * Open-source YouTube frontend with public REST API.
 * Multiple instances for automatic failover. Self-throttle ~1 req/sec.
 */
const PIPED_INSTANCES = [
  "pipedapi.kavin.rocks",
  "pipedapi.adminforge.de",
  "pipedapi.leptons.xyz",
];

async function fetchVideoReviewsPiped(
  movieTitle: string,
  movieYear?: number,
  max: number = 3
): Promise<VideoReview[]> {
  const yearStr = movieYear ? ` ${movieYear}` : "";
  const query = `${movieTitle}${yearStr} movie review`;
  const reviewWords = ["review", "reaction", "breakdown", "critique", "analysis"];

  for (const instance of PIPED_INSTANCES) {
    try {
      const params = new URLSearchParams({ q: query, filter: "videos" });
      const res = await fetch(
        `https://${instance}/search?${params}`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) continue;

      const data = await res.json();
      const items = data.items || data.results || [];

      const reviews = items
        .map((item: any) => {
          // Piped returns url as "/watch?v=VIDEO_ID"
          const videoId = item.url?.replace("/watch?v=", "") || "";
          return {
            video_id: videoId,
            title: item.title || "",
            channel: item.uploaderName || item.uploader || "",
            thumbnail: item.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          };
        })
        .filter((v: VideoReview) => {
          if (!v.video_id) return false;
          const t = v.title.toLowerCase();
          const hasReviewWord = reviewWords.some((w: string) => t.includes(w));
          if (!hasReviewWord) return false;
          return isRelevantReview(v.title, movieTitle);
        })
        .slice(0, max);

      if (reviews.length > 0) return reviews;
    } catch {
      continue; // Try next instance
    }
  }

  return [];
}

/**
 * Fallback source 2: Invidious API (free, no API key, no quota).
 * Another open-source YouTube frontend with public REST API.
 * Returns videoId, title, author, videoThumbnails directly.
 */
const INVIDIOUS_INSTANCES = [
  "invidious.snopyta.org",
  "vid.puffyan.us",
  "invidious.nerdvpn.de",
];

async function fetchVideoReviewsInvidious(
  movieTitle: string,
  movieYear?: number,
  max: number = 3
): Promise<VideoReview[]> {
  const yearStr = movieYear ? ` ${movieYear}` : "";
  const query = `${movieTitle}${yearStr} movie review`;
  const reviewWords = ["review", "reaction", "breakdown", "critique", "analysis"];

  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const params = new URLSearchParams({ q: query, type: "video" });
      const res = await fetch(
        `https://${instance}/api/v1/search?${params}`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) continue;

      const data = await res.json();
      const items = Array.isArray(data) ? data : data.items || [];

      const reviews = items
        .map((item: any) => {
          const videoId = item.videoId || "";
          // Invidious provides videoThumbnails array
          const thumb = item.videoThumbnails?.find((t: any) => t.quality === "high")?.url
            || item.videoThumbnails?.[0]?.url
            || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
          return {
            video_id: videoId,
            title: item.title || "",
            channel: item.author || "",
            thumbnail: thumb,
          };
        })
        .filter((v: VideoReview) => {
          if (!v.video_id) return false;
          const t = v.title.toLowerCase();
          const hasReviewWord = reviewWords.some((w: string) => t.includes(w));
          if (!hasReviewWord) return false;
          return isRelevantReview(v.title, movieTitle);
        })
        .slice(0, max);

      if (reviews.length > 0) return reviews;
    } catch {
      continue; // Try next instance
    }
  }

  return [];
}

/**
 * Unified video review fetcher — 3-tier fallback chain:
 *   1. RapidAPI "YouTube Search and Download" (paid, 1M/mo)
 *   2. Piped API (free, no key, community instances)
 *   3. Invidious API (free, no key, community instances)
 *
 * YouTube Data API v3 removed — 100 searches/day was too limited.
 * Exported for use by search route backfill + patch-video-reviews endpoint.
 */
export async function fetchVideoReviews(
  movieTitle: string,
  movieYear?: number,
  max: number = 3
): Promise<VideoReview[]> {
  // 1. RapidAPI (primary — paid, reliable)
  const rapidResults = await fetchVideoReviewsRapidAPI(movieTitle, movieYear, max);
  if (rapidResults.length > 0) return rapidResults;

  // 2. Piped (free, no key, multi-instance failover)
  const pipedResults = await fetchVideoReviewsPiped(movieTitle, movieYear, max);
  if (pipedResults.length > 0) return pipedResults;

  // 3. Invidious (free, no key, multi-instance failover)
  return fetchVideoReviewsInvidious(movieTitle, movieYear, max);
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

    // Fetch everything in parallel for speed.
    // fetchBestEnglishPoster overrides movie.poster_path when TMDB has an
    // English poster — guards against the localization bug where /search
    // returns a foreign-language cover (Ever After 1998 → Dutch "Lang &
    // Gelukkig"). Falls back to the search result's poster_path when no
    // English poster exists.
    const [credits, streaming, trailerKey, recommendations, videoReviews, englishPoster] =
      await Promise.all([
        fetchCredits(movie.id, 20),
        fetchWatchProviders(movie.id, title),
        fetchTrailer(movie.id),
        fetchRecommendations(movie.id, 3),
        options?.skipYouTube ? Promise.resolve([]) : fetchVideoReviews(title, year, 3),
        fetchBestEnglishPoster(movie.id),
      ]);

    result.poster_path = englishPoster ?? movie.poster_path;
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

// ─── Exact-Title Ambiguity (v5.12.3) ─────────────────────────────────────
//
// Some queries hit multiple distinct films with the SAME canonical title
// across different decades — Carrie (1976/2002/2013), Pet Sematary
// (1989/2019), The Mummy (1932/1999/2017), Halloween (1978/2018), etc.
// silentlypicking one (even with year-earliest or first-in-merged-order)
// is guessing. v5.12.3 surfaces a picker page when 2+ "real" exact-title
// matches exist so the user disambiguates explicitly.
//
// "Real" eligibility: vote_count >= AMBIGUITY_VOTE_FLOOR. This is NOT a
// popularity ranking (the user objected to ranking by votes — an obscure
// film is a valid pick). It's a minimum-metadata-completeness floor that
// filters out TMDB placeholders / unreleased / 5-vote shorts that share
// the title by coincidence. Below 50 votes, a film is effectively unrated
// and almost never the user's intent. Tunable in one place.

const AMBIGUITY_VOTE_FLOOR = 50;

export interface AmbiguityCandidate {
  tmdb_id: number;
  title: string;
  year: number | null;
  release_date: string | null;
  poster_path: string | null;
  overview: string;
  runtime: string | null;   // formatted "2h 8m" / "98m"
  director: string | null;
}

/**
 * Detects 100%-letter-by-letter same-title collisions. Returns 2+
 * candidates if the search is genuinely ambiguous, otherwise null.
 * Uses the same parallel original+concat search as searchMovie so the
 * picker surfaces canonical no-space TMDB titles ("EverAfter") next to
 * spaced ones — but in practice EverAfter is alone and so won't trigger
 * the picker (only 1 qualifying match).
 */
export async function findExactTitleCandidates(
  title: string,
): Promise<AmbiguityCandidate[] | null> {
  if (!TMDB_KEY) return null;
  try {
    async function tmdbFetch(q: string): Promise<TMDBMovie[]> {
      const p = new URLSearchParams({
        api_key: TMDB_KEY!,
        query: q,
        include_adult: "false",
        language: "en-US",
        region: "US",
      });
      const r = await fetch(`${TMDB_BASE}/search/movie?${p}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!r.ok) return [];
      const d = await r.json();
      return (d.results as TMDBMovie[]) || [];
    }

    const wantConcat = /\s/.test(title);
    const concatenated = title.replace(/\s+/g, "");
    const [rOrig, rConcat] = await Promise.all([
      tmdbFetch(title),
      wantConcat ? tmdbFetch(concatenated) : Promise.resolve([]),
    ]);

    const seen = new Set<number>();
    const merged: TMDBMovie[] = [];
    for (const r of [...rConcat, ...rOrig]) {
      if (!r.release_date) continue;
      if (!seen.has(r.id)) {
        seen.add(r.id);
        merged.push(r);
      }
    }

    // Strict normalization for ambiguity — case-insensitive only. No
    // article-strip, no punct-strip, no whitespace-strip. The user's rule
    // is "100% letter-by-letter match" so "The Heat" does NOT collide with
    // "Heat", "Up!" does NOT collide with "Up". The silent-pick path in
    // searchMovie() uses LENIENT normalization (handles "EverAfter" /
    // "Ever After"), but the picker only fires for true title clones.
    const normStrict = (s: string) =>
      (s || "").toLowerCase().trim().replace(/\s+/g, " ");
    const queryNorm = normStrict(title);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Eligibility: strict 100%-letter-by-letter title match + vote_count
    // >= floor + already released + has a release date.
    const candidates = merged.filter((r) => {
      if (normStrict(r.title) !== queryNorm) return false;
      if (!r.release_date) return false;
      const released = new Date(r.release_date) <= today;
      if (!released) return false;
      const votes = (r as any).vote_count ?? 0;
      return votes >= AMBIGUITY_VOTE_FLOOR;
    });

    // Dedupe near-duplicates: TMDB occasionally lists the same film twice
    // with different release_dates (re-release / restored cut). If two
    // candidates have release_dates within 1 year of each other, treat as
    // one and keep the earlier-dated entry — they're the same movie.
    candidates.sort((a, b) => (a.release_date || "").localeCompare(b.release_date || ""));
    const deduped: TMDBMovie[] = [];
    for (const c of candidates) {
      const cYear = parseInt((c.release_date || "").slice(0, 4)) || 0;
      const dup = deduped.some((d) => {
        const dYear = parseInt((d.release_date || "").slice(0, 4)) || 0;
        return Math.abs(dYear - cYear) <= 1;
      });
      if (!dup) deduped.push(c);
    }

    if (deduped.length < 2) return null;

    // Sort by year ascending so picker shows oldest → newest, then cap at
    // 6 entries to keep the grid scannable.
    deduped.sort((a, b) => (a.release_date || "").localeCompare(b.release_date || ""));
    const top = deduped.slice(0, 6);

    // v5.12.6: enrich with runtime + director so picker cards match the
    // info density of the Did-You-Mean cards. One /movie/{id} call per
    // candidate, all parallel — ~150ms for 6 candidates.
    const enriched = await Promise.all(
      top.map(async (m) => {
        const out: AmbiguityCandidate = {
          tmdb_id: m.id,
          title: m.title,
          year: m.release_date ? parseInt(m.release_date.slice(0, 4)) || null : null,
          release_date: m.release_date || null,
          poster_path: m.poster_path || null,
          overview: (m as any).overview || "",
          runtime: null,
          director: null,
        };
        try {
          const res = await fetch(
            `${TMDB_BASE}/movie/${m.id}?api_key=${TMDB_KEY}&append_to_response=credits&language=en-US`,
            { signal: AbortSignal.timeout(4000) },
          );
          if (!res.ok) return out;
          const d: any = await res.json();
          if (typeof d.runtime === "number" && d.runtime > 0) {
            const h = Math.floor(d.runtime / 60);
            const mm = d.runtime % 60;
            out.runtime = h > 0 && mm > 0 ? `${h}h ${mm}m` : h > 0 ? `${h}h` : `${mm}m`;
          }
          const directors = (d.credits?.crew || [])
            .filter((c: any) => c.job === "Director")
            .map((c: any) => c.name);
          if (directors.length > 0) out.director = directors.join(", ");
        } catch { /* fall through with nulls */ }
        return out;
      }),
    );
    return enriched;
  } catch {
    return null;
  }
}

// ─── Release Date Gate (v5.7) ────────────────────────────────────────────

/**
 * Quick TMDB lookup to check if a movie has been released yet.
 * Used by the search route to gate unreleased movies before Claude is called.
 * Saves an Anthropic API call and prevents hallucinated ratings.
 */
export async function getMovieReleaseInfo(
  title: string,
  year?: number
): Promise<{
  isReleased: boolean;
  releaseDate: string | null;
  tmdbId: number;
  officialTitle: string;
  overview: string;
  posterPath: string | null;
} | null> {
  const movie = await searchMovie(title, year);
  if (!movie) return null;

  const releaseDate = movie.release_date || null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isReleased = releaseDate ? new Date(releaseDate) <= today : true; // Assume released if no date

  return {
    isReleased,
    releaseDate,
    tmdbId: movie.id,
    officialTitle: movie.title,
    overview: (movie as any).overview || "",
    posterPath: movie.poster_path,
  };
}

/**
 * Fetch detailed movie info from TMDB for Coming Soon display.
 * Gets genre, runtime, tagline, overview, and director — data that
 * normally comes from Claude but is available from TMDB for unreleased films.
 * Runs /movie/{id} and /movie/{id}/credits in parallel.
 */
export async function fetchComingSoonDetails(movieId: number): Promise<{
  genres: string;
  runtime: string | null;
  tagline: string | null;
  overview: string;
  director: string | null;
} | null> {
  if (!TMDB_KEY) return null;

  try {
    const [detailRes, creditsRes] = await Promise.all([
      fetch(`${TMDB_BASE}/movie/${movieId}?api_key=${TMDB_KEY}`, {
        signal: AbortSignal.timeout(5000),
      }),
      fetch(`${TMDB_BASE}/movie/${movieId}/credits?api_key=${TMDB_KEY}`, {
        signal: AbortSignal.timeout(5000),
      }),
    ]);

    let genres = "";
    let runtime: string | null = null;
    let tagline: string | null = null;
    let overview = "";

    if (detailRes.ok) {
      const detail = await detailRes.json();
      genres = (detail.genres || []).map((g: any) => g.name).join(" · ");
      runtime = detail.runtime ? `${detail.runtime} min` : null;
      tagline = detail.tagline || null;
      overview = detail.overview || "";
    }

    let director: string | null = null;
    if (creditsRes.ok) {
      const credits = await creditsRes.json();
      const dir = (credits.crew || []).find((c: any) => c.job === "Director");
      if (dir) director = dir.name;
    }

    return { genres, runtime, tagline, overview, director };
  } catch {
    return null;
  }
}

// ─── Box Office Enrichment (poster + backdrop + IDs) ──────────────────────
//
// Lightweight TMDB lookup used by the box-office ingestion pipeline. Returns
// just the visual + identity fields needed for `box_office_metrics` rows —
// poster_path, backdrop_path, tmdb_id, imdb_id. Does not fetch credits,
// trailers, recommendations, or video reviews (the existing `enrichWithTMDB`
// is too heavy for cron-time enrichment of 10 films per period).

export async function enrichBoxOfficeWithTMDB(
  title: string,
  year?: number
): Promise<{
  poster_path: string | null;
  backdrop_path: string | null;
  tmdb_id: number | null;
  imdb_id: string | null;
  director: string | null;
}> {
  const blank = {
    poster_path: null,
    backdrop_path: null,
    tmdb_id: null,
    imdb_id: null,
    director: null,
  };
  if (!TMDB_KEY) return blank;
  try {
    const movie = await searchMovie(title, year);
    if (!movie) return blank;
    // Single /movie/{id} call appends external_ids + credits + images so we
    // get poster + backdrop + IMDb id + director + English poster candidates
    // in one round-trip. include_image_language=en,null filters images to
    // English + language-agnostic — same logic as fetchBestEnglishPoster but
    // bundled into the existing call to avoid an extra round-trip per cron
    // run (10 movies × N period_types).
    const res = await fetch(
      `${TMDB_BASE}/movie/${movie.id}?api_key=${TMDB_KEY}&append_to_response=external_ids,credits,images&include_image_language=en,null&language=en-US`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) {
      return {
        poster_path: movie.poster_path ?? null,
        backdrop_path: null,
        tmdb_id: movie.id,
        imdb_id: null,
        director: null,
      };
    }
    const data = (await res.json()) as {
      backdrop_path?: string | null;
      poster_path?: string | null;
      external_ids?: { imdb_id?: string | null };
      credits?: { crew?: { name: string; job: string }[] };
      images?: {
        posters?: Array<{ file_path: string; iso_639_1: string | null; vote_average: number }>;
      };
    };
    const director =
      (data.credits?.crew || []).find((c) => c.job === "Director")?.name ?? null;
    // Best English poster from the appended images, ranked en > null > other,
    // then by vote_average. Fall back to data.poster_path then search result.
    const posters = data.images?.posters || [];
    let bestPoster: string | null = null;
    if (posters.length > 0) {
      const sorted = [...posters].sort((a, b) => {
        const aRank = a.iso_639_1 === "en" ? 2 : a.iso_639_1 == null ? 1 : 0;
        const bRank = b.iso_639_1 === "en" ? 2 : b.iso_639_1 == null ? 1 : 0;
        if (aRank !== bRank) return bRank - aRank;
        return (b.vote_average ?? 0) - (a.vote_average ?? 0);
      });
      bestPoster = sorted[0]?.file_path ?? null;
    }
    return {
      poster_path: bestPoster ?? data.poster_path ?? movie.poster_path ?? null,
      backdrop_path: data.backdrop_path ?? null,
      tmdb_id: movie.id,
      imdb_id: data.external_ids?.imdb_id ?? null,
      director,
    };
  } catch {
    return blank;
  }
}
