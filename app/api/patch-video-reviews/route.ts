// app/api/patch-video-reviews/route.ts — v5.5
// Lightweight endpoint to backfill video_reviews on existing cached movies.
//
// This does NOT re-run Claude, TMDB, or ratings. It only:
//   1. Finds cached movies missing video_reviews (or with empty array)
//   2. Fetches video reviews via RapidAPI (primary) → YouTube (fallback)
//   3. Patches the cached movie data with the new video_reviews field
//
// Usage:
//   POST /api/patch-video-reviews                → patch up to 100 movies (default)
//   POST /api/patch-video-reviews?limit=500      → patch up to 500 movies
//   POST /api/patch-video-reviews?limit=50&offset=0  → paginate through batches
//
// RapidAPI Pro: 1,000,000 requests/month. At 1 req/movie, can patch all 10K in one run.
// Rate: 0.5s delay between requests (conservative, well under RapidAPI limits).

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { fetchVideoReviews } from "@/lib/tmdb";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  // Parse params
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 2000);
  const offset = parseInt(url.searchParams.get("offset") || "0");

  // Fetch cached movies — we'll filter for missing video_reviews in JS
  // (JSONB filtering for empty arrays is unreliable across Supabase versions)
  const { data: movies, error: fetchErr } = await supabaseAdmin
    .from("movie_cache")
    .select("search_key, data")
    .order("hit_count", { ascending: false })
    .range(offset, offset + limit * 3); // Over-fetch since we'll filter

  if (fetchErr) {
    return NextResponse.json({ error: "Database error", details: fetchErr.message }, { status: 500 });
  }

  if (!movies || movies.length === 0) {
    return NextResponse.json({ patched: 0, message: "No movies found" });
  }

  // Filter to movies missing video_reviews
  const needsPatch = movies
    .filter((m: any) => {
      const data = m.data;
      if (!data || !data.title) return false;
      const vr = data.video_reviews;
      return !vr || !Array.isArray(vr) || vr.length === 0;
    })
    .slice(0, limit);

  console.log(`[patch-vr] Found ${needsPatch.length} movies needing video reviews (offset=${offset}, limit=${limit})`);

  if (needsPatch.length === 0) {
    return NextResponse.json({ patched: 0, skipped: movies.length, message: "All movies already have video reviews" });
  }

  let patched = 0;
  let failed = 0;
  let noResults = 0;
  const results: { title: string; status: string }[] = [];

  for (let i = 0; i < needsPatch.length; i++) {
    const entry = needsPatch[i];
    const movieData = entry.data as any;
    const title = movieData.title;
    const year = movieData.year;

    try {
      const videoReviews = await fetchVideoReviews(title, year, 3);

      if (videoReviews.length > 0) {
        // Patch the cached data with video reviews
        const updatedData = { ...movieData, video_reviews: videoReviews };

        const { error: updateErr } = await supabaseAdmin
          .from("movie_cache")
          .update({ data: updatedData })
          .eq("search_key", entry.search_key);

        if (updateErr) {
          results.push({ title, status: `db error: ${updateErr.message}` });
          failed++;
        } else {
          results.push({ title, status: `patched (${videoReviews.length} reviews)` });
          patched++;
        }
      } else {
        results.push({ title, status: "no reviews found" });
        noResults++;
      }
    } catch (err: any) {
      results.push({ title, status: `error: ${err.message}` });
      failed++;
    }

    // Progress log every 50 movies
    if ((i + 1) % 50 === 0) {
      console.log(`[patch-vr] Progress: ${i + 1}/${needsPatch.length} (patched=${patched}, noResults=${noResults}, failed=${failed})`);
    }

    // 0.5s delay between requests (well under RapidAPI rate limits)
    await delay(500);
  }

  console.log(`[patch-vr] Complete: patched=${patched}, noResults=${noResults}, failed=${failed}`);

  return NextResponse.json({
    summary: {
      total_checked: movies.length,
      needed_patch: needsPatch.length,
      patched,
      no_results: noResults,
      failed,
      offset,
      limit,
    },
    results,
  });
}
