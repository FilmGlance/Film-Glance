// app/api/search/route.ts — v5.9
// Semi-public search endpoint with 5-API verified ratings pipeline.
//
// v5.7 CHANGES:
//   - Release date gate: TMDB release date checked BEFORE Claude is called.
//     Unreleased movies return "Coming Soon" with TMDB data only (no hallucinated scores).
//     Saves Anthropic API calls. Cache expires on release date for automatic refresh.
//
// v5.6 CHANGES:
//   - Video review backfill: cache hits with empty video_reviews trigger
//     background fetch via RapidAPI (primary) → Piped API → Invidious API
//   - YouTube Data API v3 removed from fallback chain
//   - Patched reviews persist to cache so subsequent searches serve from cache
//
// v5.4 CHANGES:
//   - Anonymous search: auth no longer required (daily limit instead)
//   - 15 searches/day for unauthenticated users (tracked by IP in Supabase)
//   - Signed-in users get unlimited searches
//   - check_anonymous_limit() RPC for atomic daily count
//
// v5.3 CHANGES:
//   - Stale-while-revalidate: expired cache returns instantly, background refresh
//   - Parallel pipeline: Claude + TMDB + Verified Ratings in Promise.all()
//   - 30-day cache TTL (was 14 days)
//   - Dual/triple key caching (original query + resolved title + official title)
//   - Shared runFullPipeline() / writeCacheEntries() functions
//   - [perf] timing logs
//
// EXECUTION ORDER:
//   1. Auth (optional — sets user or proceeds as anonymous)
//   2. Rate limit (by user ID or IP)
//   3. Sanitize + injection detection
//   4a. Anonymous daily limit check (15/day per IP)
//   4b. [DORMANT] Pricing check
//   5. Cache lookup (ANY entry, no expiry filter)
//      → Valid cache: return instantly
//      → Stale cache: return instantly + background refresh
//      → No cache: continue to pipeline
//   5.5. Sequel resolution via TMDB (fast, ~200ms)
//   5.75. Release date gate — if unreleased, return Coming Soon (v5.7)
//   6. Parallel: Claude + TMDB + Verified Ratings (Promise.all)
//   7. Assembly + cache write (fire-and-forget)

import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { supabaseAdmin } from "@/lib/supabase-server";
import { calcScore } from "@/lib/score";
import { rateLimit, SEARCH_LIMIT } from "@/lib/rate-limit";
import { enrichWithTMDB, fetchVideoReviews, getMovieReleaseInfo, fetchComingSoonDetails, findExactTitleCandidates } from "@/lib/tmdb";
import { fetchVerifiedRatings, applyVerifiedRatings, resolveSequelTitle, RATINGS_DISCLAIMER } from "@/lib/ratings";
import { sanitizeQuery } from "@/lib/sanitize";
import {
  runFullPipeline,
  buildComingSoonResponse,
  writeCacheEntries,
} from "@/lib/search-pipeline";

// v5.11.0: Edge runtime cuts cold-start latency by ~450ms vs Node serverless.
// All deps verified edge-safe — supabase-js v2 (fetch-based), pure-fetch lib/*,
// in-memory rate-limit Map (per-isolate scope, same per-instance semantics).
export const runtime = "edge";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const ANONYMOUS_DAILY_LIMIT = 15;

// ── Utilities ────────────────────────────────────────────────────────────────

function looksLikeInjection(q: string): boolean {
  const patterns = [
    /ignore\s+(all\s+)?(previous|prior|above)/i,
    /system\s*prompt/i,
    /you\s+are\s+(now|a)\s/i,
    /act\s+as\s/i,
    /pretend\s+(to\s+be|you)/i,
    /reveal\s+(your|the)\s+(instructions|prompt|system)/i,
    /override\s/i, /disregard\s/i,
    /\bdo\s+not\s+follow\b/i,
    /jailbreak/i, /dan\s+mode/i,
  ];
  return patterns.some((p) => p.test(q));
}

// v5.11.0: waitUntil guarantees background work completes after the response
// has been sent. Previous fire-and-forget could be cut short when the function
// instance went idle on Node serverless — cache writes occasionally lost.
function runInBackground(fn: () => Promise<any>, label: string) {
  waitUntil(fn().catch((err) => console.error(`[${label}]`, err)));
}

/**
 * v5.6: Backfill video_reviews on cached entries that have none.
 * Fetches reviews via RapidAPI (primary) → YouTube Data API (fallback),
 * then patches just the video_reviews field in the cached data.
 */
function backfillVideoReviews(cacheKey: string, movieData: Record<string, unknown>) {
  const title = (movieData.title as string) || "";
  const year = (movieData.year as number) || undefined;
  if (!title) return;

  runInBackground(async () => {
    const reviews = await fetchVideoReviews(title, year, 3);
    if (reviews.length === 0) return; // Both sources exhausted or no reviews found

    // Patch the cached data with video reviews
    const updatedData = { ...movieData, video_reviews: reviews };
    await supabaseAdmin
      .from("movie_cache")
      .update({ data: updatedData })
      .eq("search_key", cacheKey);
    console.log(`[video-backfill] ✓ Patched ${reviews.length} reviews for "${title}"`);
  }, "video-backfill");
}


// ── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // 1. Auth check — OPTIONAL (anonymous users get daily limit)
    const authHeader = req.headers.get("Authorization");
    let user: any = null;

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      try {
        const { data, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (!authError && data?.user) {
          user = data.user;
        }
      } catch (authErr) {
        console.error("Auth check failed:", authErr);
        // Continue as anonymous rather than failing
      }
    }

    // 2. Rate limit — user ID if authenticated, IP if anonymous
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
    {
      const rl = await rateLimit(`search:${user?.id || `anon:${ip}`}`, SEARCH_LIMIT);
      if (!rl.allowed) {
        return NextResponse.json(
          { error: "Too many requests. Please slow down." },
          { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
        );
      }
    }

    // 3. Parse & sanitize
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const query = sanitizeQuery(body.query || "");
    if (!query || query.length < 1) {
      return NextResponse.json({ error: "Search query is required" }, { status: 400 });
    }

    if (looksLikeInjection(body.query || "")) {
      return NextResponse.json({ error: "Invalid search query" }, { status: 400 });
    }

    // Parse trailing year as a search hint while keeping `query` as the cache
    // key. Lets users disambiguate same-titled films — e.g., "michael 2026"
    // picks the 2026 MJ biopic instead of the 1996 Nora Ephron comedy that
    // TMDB's popularity ranking would surface first.
    let searchTitle = query;
    let userYearHint: number | undefined;
    const yearMatch = query.match(/^(.+?)\s+\(?(\d{4})\)?\s*$/);
    if (yearMatch) {
      const yr = parseInt(yearMatch[2]);
      if (yr >= 1900 && yr <= 2100) {
        searchTitle = yearMatch[1].trim();
        userYearHint = yr;
      }
    }

    // 4a. Anonymous daily limit check (15 searches/day per IP)
    if (!user) {
      try {
        const { data: limitCheck, error: limitErr } = await supabaseAdmin.rpc(
          "check_anonymous_limit",
          { p_ip: ip, p_limit: ANONYMOUS_DAILY_LIMIT }
        );

        if (limitErr) {
          console.error("Anonymous limit check failed:", limitErr);
          return NextResponse.json(
            { error: "Unable to verify search quota. Please sign in for unlimited access.", code: "LIMIT_CHECK_FAILED" },
            { status: 500 }
          );
        }

        if (limitCheck && !limitCheck.allowed) {
          return NextResponse.json({
            error: "You've used all 15 free searches for today. Sign up for free to unlock unlimited searches!",
            code: "DAILY_LIMIT_REACHED",
            searches_used: limitCheck.searches_used,
            daily_limit: limitCheck.daily_limit,
          }, { status: 429 });
        }
      } catch (limitErr) {
        console.error("Anonymous limit check exception:", limitErr);
      }
    }

    // 4b. [DORMANT — PRICING DISABLED]
    const PRICING_ENABLED = false;
    if (PRICING_ENABLED) {
      const { data: quotaData, error: quotaError } = await supabaseAdmin.rpc("increment_search", { p_user_id: user.id });
      if (quotaError) return NextResponse.json({ error: "Failed to check search quota" }, { status: 500 });
      const quota = quotaData?.[0] || quotaData;
      if (quota?.at_limit) {
        return NextResponse.json({
          error: "Monthly search limit reached. Upgrade to Pro for unlimited searches.",
          code: "SEARCH_LIMIT_REACHED",
          searches_used: quota.searches_used,
          search_limit: quota.search_limit,
        }, { status: 403 });
      }
    }

    // 4.5. Exact-title ambiguity check (v5.12.7 — promoted before cache).
    //      When 2+ released films share the EXACT canonical title (Carrie
    //      1976/2002/2013, Pet Sematary 1989/2019, Michael 1924/1996/2026,
    //      etc.) and the user didn't type a year hint, surface a picker.
    //      MUST fire before the cache lookup at point 5: otherwise once any
    //      user searches "michael" and the pipeline picks one (say 2026),
    //      that result caches under search_key="michael" and ALL subsequent
    //      "michael" searches hit cache → bypass the picker → broken UX.
    //      v5.12.3 had this check at point 5.7 (after cache lookup); v5.12.7
    //      moves it to point 4.5 to fix the cache-lock-in bug. Cost: ~80-
    //      150ms TMDB call on every no-year-hint search; ambiguous queries
    //      never write to cache (they short-circuit before the pipeline).
    //      Skipped entirely when user typed a year ("michael 1996") since
    //      that already disambiguates.
    if (!userYearHint) {
      const ambigCandidates = await findExactTitleCandidates(searchTitle).catch(() => null);
      if (ambigCandidates && ambigCandidates.length >= 2) {
        console.log(`[ambiguity] "${query}" → ${ambigCandidates.length} same-title films, returning picker`);
        return NextResponse.json({
          ambiguous: true,
          query,
          candidates: ambigCandidates,
          _source: "ambiguity-picker",
        });
      }
    }

    // 5. Cache lookup — Stale-While-Revalidate
    //    ANY cached entry returns instantly (no expiry filter).
    //    If expired, fire background refresh.
    let cached: any = null;
    let supabaseAvailable = true;
    try {
      const { data, error } = await supabaseAdmin
        .from("movie_cache")
        .select("data, hit_count, expires_at, cached_at")
        .eq("search_key", query)
        .single();
      if (!error && data) cached = data;
    } catch (cacheErr) {
      console.error("Cache lookup failed:", cacheErr);
      supabaseAvailable = false;
    }

    if (cached) {
      const isStale = new Date(cached.expires_at) < new Date();

      // v5.12.5 — always-refresh-on-read with two gates:
      //   • cache_age > 1 hour: prevents identical queries from triggering N
      //     parallel refreshes; bounds Anthropic spend.
      //   • sources < 6 (underpopulated): forces immediate retry even within
      //     the dedup window. Catches the "newly-released movie cached
      //     with sparse APIs at write time" case (Michael 2026 had only
      //     TMDB / Simkl / Letterboxd; IMDb / RT / Metacritic / Trakt
      //     showed up days later but the cache was stuck).
      // Healthy non–Coming-Soon entries have 9 sources; 6 means at least
      // two-thirds populated. Some genuinely-rare films may never reach 6,
      // which is fine — the 1-hour dedup keeps cost bounded even in that
      // pathological case.
      const ONE_HOUR_MS = 60 * 60 * 1000;
      const ONE_DAY_MS = 24 * 60 * 60 * 1000;
      const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;
      const NINETY_DAYS_MS = 90 * ONE_DAY_MS;
      const SOURCE_FLOOR = 6;
      const cacheAgeMs = cached.cached_at
        ? Date.now() - new Date(cached.cached_at).getTime()
        : Number.POSITIVE_INFINITY;
      const sourceCount = ((cached.data as any)?.sources as any[] | undefined)?.length ?? 0;
      const isComingSoon = (cached.data as any)?.coming_soon === true;
      const isUnderpopulated = !isComingSoon && sourceCount < SOURCE_FLOOR;
      const isPastHourly = cacheAgeMs > ONE_HOUR_MS;

      // v5.13.1 — recently-released-movies-need-box-office-refresh trigger.
      // For films released between 7 and 90 days ago, opening-weekend +
      // theaters + initial run numbers become available in the wild within
      // 1-2 weeks of release. Claude's training cutoff may or may not
      // include them — but a fresh pipeline call is the only way to find
      // out. Force refresh whenever boxOffice is missing/empty for these
      // movies so the data fills in as it becomes public. Skip if cache_at
      // is already within an hour (1h dedup still applies).
      const releaseDateStr = (cached.data as any)?.release_date as string | undefined;
      let isPostReleaseBoxOfficeGap = false;
      if (releaseDateStr) {
        const releaseMs = new Date(releaseDateStr).getTime();
        if (!isNaN(releaseMs)) {
          const sinceRelease = Date.now() - releaseMs;
          const inWindow = sinceRelease >= SEVEN_DAYS_MS && sinceRelease <= NINETY_DAYS_MS;
          const noBoxOffice = !(cached.data as any)?.boxOffice ||
            Object.keys((cached.data as any).boxOffice || {}).length === 0;
          if (inWindow && noBoxOffice && cacheAgeMs > ONE_HOUR_MS) {
            isPostReleaseBoxOfficeGap = true;
          }
        }
      }

      const shouldRefresh = isStale || isUnderpopulated || isPastHourly || isPostReleaseBoxOfficeGap;

      // Fire-and-forget: update hit count + log
      runInBackground(async () => {
        await Promise.all([
          Promise.resolve(supabaseAdmin.from("movie_cache").update({ hit_count: (cached.hit_count || 0) + 1 }).eq("search_key", query)).then(() => {}),
          Promise.resolve(supabaseAdmin.from("search_log").insert({ user_id: user?.id || null, query, source: isStale ? "swr" : "cache", ip_address: ip })).then(() => {}),
        ]);
      }, "cache-hit-log");

      // Always-refresh-on-read SWR. Fires when stale, underpopulated, or
      // > 1h since last refresh. Background; zero user-latency impact.
      if (shouldRefresh && ANTHROPIC_API_KEY) {
        runInBackground(async () => {
          if (isComingSoon) {
            // Re-check release date — movie might have released since last cache
            const freshRelease = await getMovieReleaseInfo(
              ((cached.data as any).title as string) || query, ((cached.data as any).year as number) || undefined
            ).catch(() => null);
            if (freshRelease && !freshRelease.isReleased) {
              // Still unreleased — refresh Coming Soon data with fresh TMDB info
              const freshMv = await buildComingSoonResponse(query, freshRelease, ((cached.data as any).year as number) || undefined);
              const releaseExpiry = freshRelease.releaseDate
                ? new Date(freshRelease.releaseDate).toISOString()
                : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
              await supabaseAdmin.from("movie_cache").upsert({
                search_key: query,
                data: freshMv,
                source: "coming-soon",
                hit_count: (cached.hit_count || 0),
                cached_at: new Date().toISOString(),
                expires_at: releaseExpiry,
              });
              console.log(`[bg-refresh] ✓ Coming soon "${query}" refreshed, still unreleased until ${releaseExpiry}`);
              return;
            }
            // Movie is now released! Fall through to full pipeline
            console.log(`[bg-refresh] "${query}" has released — running full pipeline`);
          }
          console.log(`[bg-refresh] Starting for "${query}"`);
          const start = Date.now();
          // v5.13.3 — pass cached year as yearHint so the runFullPipeline
          // releaseInfo backfill resolves the correct movie (Michael 1996
          // vs 2026 etc.) instead of TMDB's popularity-default pick.
          const cachedYear = typeof (cached.data as any)?.year === "number"
            ? (cached.data as any).year
            : undefined;
          const mv = await runFullPipeline(query, query, cachedYear);
          if (mv) {
            await writeCacheEntries(query, null, mv.title, mv, user?.id || null, ip, "swr-refresh");
            console.log(`[bg-refresh] ✓ "${query}" refreshed in ${Date.now() - start}ms`);
          }
        }, "bg-refresh");
      }

      const movieData = cached.data as Record<string, unknown>;

      // v5.6: Backfill video reviews if cached entry has none
      const vr = movieData.video_reviews as any[] | undefined;
      if (!vr || vr.length === 0) {
        backfillVideoReviews(query, movieData);
      }

      return NextResponse.json({
        ...movieData,
        ...(!(movieData as any).coming_soon && {
          score: calcScore((movieData.sources as any[]) || []),
          disclaimer: RATINGS_DISCLAIMER,
        }),
        _source: (movieData as any).coming_soon ? "coming-soon" : (isStale ? "swr" : "cache"),
      });
    }

    // 5.5. Sequel resolution
    let resolvedTitle: string = query;
    let resolvedYear: number | undefined;

    const sequelResolution = await resolveSequelTitle(searchTitle).catch(() => null);
    if (sequelResolution) {
      resolvedTitle = sequelResolution.title;
      resolvedYear = sequelResolution.year;
      console.log(`[sequel] "${query}" → "${resolvedTitle}" (${resolvedYear})`);

      // Check cache with resolved title (SWR logic)
      try {
        const resolvedKey = sanitizeQuery(resolvedTitle);
        const { data, error } = await supabaseAdmin
          .from("movie_cache")
          .select("data, hit_count, expires_at, cached_at")
          .eq("search_key", resolvedKey)
          .single();

        if (!error && data) {
          const isStale = new Date(data.expires_at) < new Date();
          // v5.12.5 — same always-refresh-on-read gates as the primary
          // cache hit path: 1h dedup + sources<6 underpopulated bypass.
          const ONE_HOUR_MS = 60 * 60 * 1000;
          const SOURCE_FLOOR = 6;
          const cacheAgeMs = data.cached_at
            ? Date.now() - new Date(data.cached_at).getTime()
            : Number.POSITIVE_INFINITY;
          const sourceCount = ((data.data as any)?.sources as any[] | undefined)?.length ?? 0;
          const isComingSoon = (data.data as any)?.coming_soon === true;
          const shouldRefresh =
            isStale ||
            (!isComingSoon && sourceCount < SOURCE_FLOOR) ||
            cacheAgeMs > ONE_HOUR_MS;

          runInBackground(async () => {
            await Promise.all([
              Promise.resolve(supabaseAdmin.from("movie_cache").update({ hit_count: (data.hit_count || 0) + 1 }).eq("search_key", resolvedKey)).then(() => {}),
              Promise.resolve(supabaseAdmin.from("search_log").insert({ user_id: user?.id || null, query, source: isStale ? "swr" : "cache", ip_address: ip })).then(() => {}),
            ]);
          }, "sequel-cache-hit-log");

          if (shouldRefresh && ANTHROPIC_API_KEY) {
            runInBackground(async () => {
              const mv = await runFullPipeline(resolvedTitle, resolvedTitle, resolvedYear);
              if (mv) await writeCacheEntries(resolvedKey, resolvedTitle, mv.title, mv, user?.id || null, ip, "swr-refresh");
            }, "sequel-bg-refresh");
          }

          const movieData = data.data as Record<string, unknown>;

          // v5.6: Backfill video reviews if cached entry has none
          const vrSequel = movieData.video_reviews as any[] | undefined;
          if (!vrSequel || vrSequel.length === 0) {
            backfillVideoReviews(resolvedKey, movieData);
          }

          return NextResponse.json({
            ...movieData,
            ...(!(movieData as any).coming_soon && {
              score: calcScore((movieData.sources as any[]) || []),
              disclaimer: RATINGS_DISCLAIMER,
            }),
            _source: (movieData as any).coming_soon ? "coming-soon" : (isStale ? "swr" : "cache"),
          });
        }
      } catch { /* continue to API */ }
    }

    // (v5.12.7: ambiguity check was here at 5.7; moved to 4.5 — before
    // cache lookup — to prevent cache lock-in on bare ambiguous titles.)

    // 5.75. Release date gate — check if movie is unreleased (v5.7)
    //       If TMDB knows the movie but it hasn't been released yet,
    //       return a "Coming Soon" response with TMDB data only.
    //       This prevents Claude from hallucinating ratings for unreleased films.
    const releaseTitle = sequelResolution ? resolvedTitle : searchTitle;
    const releaseInfo = await getMovieReleaseInfo(releaseTitle, userYearHint || resolvedYear).catch(() => null);

    if (releaseInfo && !releaseInfo.isReleased) {
      console.log(`[coming-soon] "${releaseTitle}" releases ${releaseInfo.releaseDate} — skipping Claude`);

      const comingSoonMv = await buildComingSoonResponse(releaseTitle, releaseInfo, resolvedYear);

      // Cache with TTL set to release date (auto-expires when movie releases)
      if (supabaseAvailable) {
        const releaseExpiry = releaseInfo.releaseDate
          ? new Date(releaseInfo.releaseDate).toISOString()
          : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days fallback

        runInBackground(async () => {
          const cacheData = {
            data: comingSoonMv,
            source: "coming-soon",
            hit_count: 0,
            cached_at: new Date().toISOString(),
            expires_at: releaseExpiry,
          };

          const normalize = (s: string) => s.toLowerCase().trim()
            .replace(/^(the|a|an)\s+/i, "")
            .replace(/[''`:;!?.,"()]/g, "").replace(/\s+/g, " ").trim();

          const keys = new Set<string>();
          keys.add(query);
          if (sequelResolution) keys.add(normalize(resolvedTitle));
          keys.add(normalize(releaseInfo.officialTitle));

          const writes: Promise<any>[] = [];
          for (const key of keys) {
            writes.push(
              Promise.resolve(supabaseAdmin.from("movie_cache").upsert({ search_key: key, ...cacheData })).then(() => {})
            );
          }
          writes.push(
            Promise.resolve(supabaseAdmin.from("search_log").insert({ user_id: user?.id || null, query, source: "coming-soon", ip_address: ip })).then(() => {})
          );
          await Promise.all(writes);
          console.log(`[coming-soon] ✓ Cached "${releaseInfo.officialTitle}" until ${releaseExpiry}`);
        }, "coming-soon-cache");
      }

      return NextResponse.json({
        ...comingSoonMv,
        _source: "coming-soon",
      });
    }

    // 5.8. Title validation gate — prevent hallucinated results for misspelled queries (v5.9)
    //      If TMDB found a movie but the official title doesn't closely match the query,
    //      either redirect to the correct title or return 404 for suggestions.
    //      This prevents Claude from hallucinating data for "avatarrr", "forsss gump", etc.
    let pipelineTitle = sequelResolution ? resolvedTitle : searchTitle;
    let pipelineYear = userYearHint || resolvedYear;

    if (releaseInfo && releaseInfo.officialTitle) {
      // Year-mismatch guard: when the user explicitly typed a year (e.g.
      // "michael 2026"), TMDB's strict year filter may have failed and the
      // searchMovie fallback returned a popular but wrong-year film
      // (Michael 1996 in that case). The title gate's similarity check would
      // then accept the wrong film as a "close match" and redirect the
      // pipeline to it, silently ignoring the user's year intent. Reject
      // year mismatches > 1 year and let the Did-You-Mean path surface
      // candidates the user can choose from.
      if (userYearHint && releaseInfo.releaseDate) {
        const tmdbYear = parseInt(releaseInfo.releaseDate.substring(0, 4));
        if (!isNaN(tmdbYear) && Math.abs(tmdbYear - userYearHint) > 1) {
          console.log(`[title-gate] Year mismatch: query year=${userYearHint} vs TMDB result "${releaseInfo.officialTitle}" year=${tmdbYear} — returning 404 for suggestions`);
          return NextResponse.json({ error: "Movie not found" }, { status: 404 });
        }
      }

      const normQ = query.replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
      const normT = releaseInfo.officialTitle.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();

      if (normQ === normT) {
        // Exact (case-insensitive) match — adopt TMDB's official title casing
        // and seed the year from the release date so Claude has the
        // disambiguation needed to pick the right film. Without this, queries
        // like "fargo" went to Claude with no year hint and returned
        // not_a_movie because multiple "Fargo" titles exist (1996 film, 2003
        // film, 2014 TV series, etc).
        pipelineTitle = releaseInfo.officialTitle;
        pipelineYear = releaseInfo.releaseDate
          ? parseInt(releaseInfo.releaseDate.substring(0, 4))
          : pipelineYear;
      } else {
        // Check similarity. Three complementary heuristics:
        //
        //   (a) Substring containment with close length — handles "the matrix"
        //       vs "Matrix" or short typos where the user dropped/added a few
        //       characters but the bulk of the string matches.
        //
        //   (b) ORDERED word-subsequence — handles "lord rings fellowship"
        //       vs "The Lord of the Rings: The Fellowship of the Ring" where
        //       every query word appears in the title in the same order.
        //
        //   (c) Stripped-whitespace containment (v5.12.4) — handles the case
        //       where TMDB stores a canonical title concatenated with no
        //       spaces ("EverAfter") while the user types the longer human-
        //       readable form ("Ever After: A Cinderella Story"). Strip ALL
        //       spaces and check if either side is a substring of the other.
        //       Min-length 5 guard prevents 2-3-char coincidences. This
        //       sidesteps the lenRatio gate for the "user typed full
        //       canonical title; TMDB has shorthand" case.
        //
        // v5.12.2 swap from set-based wordMatch → ordered-subsequence: the
        // old heuristic accepted any 75%+ word overlap regardless of order,
        // which mismatched "ever after" (1998) → "After Ever Happy" (2022).
        // Both query words appear in the TMDB title (overlap=2/2=100%) but
        // not in the right order, so it should NOT match. Ordered subsequence
        // catches this: "after, ever, happy" never satisfies "ever, after"
        // because once we pass "ever" we'd need "after" to come AFTER it.
        const lenRatio = Math.min(normQ.length, normT.length) / Math.max(normQ.length, normT.length);
        const isCloseSubstring = (normT.includes(normQ) || normQ.includes(normT)) && lenRatio >= 0.75;

        const qWords = normQ.split(" ").filter(w => w.length > 1);
        const tWords = normT.split(" ").filter(w => w.length > 1);
        let qIdx = 0;
        for (const tw of tWords) {
          if (qIdx < qWords.length && tw === qWords[qIdx]) qIdx++;
        }
        const isOrderedSubsequence = qWords.length > 0 && qIdx === qWords.length;

        const sQ = normQ.replace(/\s+/g, "");
        const sT = normT.replace(/\s+/g, "");
        const minStrippedLen = Math.min(sQ.length, sT.length);
        const isStrippedContains =
          minStrippedLen >= 5 && (sQ.includes(sT) || sT.includes(sQ));

        if (isCloseSubstring || isOrderedSubsequence || isStrippedContains) {
          // Close enough — redirect pipeline to use the correct TMDB title
          console.log(`[title-gate] Redirecting "${query}" → "${releaseInfo.officialTitle}" (close match)`);
          pipelineTitle = releaseInfo.officialTitle;
          pipelineYear = releaseInfo.releaseDate ? parseInt(releaseInfo.releaseDate.substring(0, 4)) : pipelineYear;
        } else {
          // Too different — return 404 so frontend shows "Did you mean?" suggestions
          console.log(`[title-gate] Query "${query}" doesn't match TMDB title "${releaseInfo.officialTitle}" — returning 404 for suggestions`);
          return NextResponse.json({ error: "Movie not found" }, { status: 404 });
        }
      }
    }

    // 6. Full pipeline — Claude + TMDB + Verified Ratings in parallel
    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "Movie API not configured" }, { status: 503 });
    }

    const start = Date.now();

    try {
      const mv = await runFullPipeline(
        pipelineTitle,
        pipelineTitle,
        pipelineYear,
        releaseInfo
      );

      if (!mv) {
        return NextResponse.json({ error: "Movie not found" }, { status: 404 });
      }

      console.log(`[perf] Total search pipeline for "${query}": ${Date.now() - start}ms`);

      // 7. Fire-and-forget cache write + log
      if (supabaseAvailable) {
        runInBackground(async () => {
          await writeCacheEntries(query, pipelineTitle !== query ? pipelineTitle : null, mv.title, mv, user?.id || null, ip, "api");
        }, "cache-write");
      }

      return NextResponse.json({
        ...mv,
        score: calcScore(mv.sources),
        disclaimer: RATINGS_DISCLAIMER,
        _source: "api",
      });
    } catch (apiErr) {
      console.error("Pipeline error:", apiErr);
      return NextResponse.json({ error: "Movie search timed out. Please try again." }, { status: 504 });
    }
  } catch (err) {
    console.error("Search route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
