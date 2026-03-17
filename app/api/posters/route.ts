// app/api/posters/route.ts — v5.9.1
// Returns unique poster_path values from cached movies for the homepage crawl effect.
// Lightweight, no auth required — only returns poster paths, no sensitive data.
// Response is a flat array of TMDB poster_path strings (e.g. "/q6y0Go1ts...jpg").
// Client prepends "https://image.tmdb.org/t/p/w200" to each.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

// Cache the result in-memory for 1 hour to avoid repeated DB queries
let cachedPosters: string[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function GET() {
  try {
    // Return cached if fresh
    if (cachedPosters && Date.now() - cacheTimestamp < CACHE_TTL) {
      return NextResponse.json(cachedPosters, {
        headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" },
      });
    }

    const { data, error } = await supabaseAdmin
      .from("movie_cache")
      .select("data->poster_path")
      .not("data->poster_path", "is", null)
      .limit(600);

    if (error) {
      console.error("[posters] DB error:", error);
      return NextResponse.json([], { status: 500 });
    }

    // Extract unique poster_path strings, filter out nulls and empties
    const seen = new Set<string>();
    const posters: string[] = [];
    for (const row of data || []) {
      const path = (row as any).poster_path;
      if (path && typeof path === "string" && path.startsWith("/") && !seen.has(path)) {
        seen.add(path);
        posters.push(path);
      }
    }

    // Shuffle using Fisher-Yates
    for (let i = posters.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [posters[i], posters[j]] = [posters[j], posters[i]];
    }

    // Take up to 500 unique posters
    const result = posters.slice(0, 500);

    // Cache in memory
    cachedPosters = result;
    cacheTimestamp = Date.now();

    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" },
    });
  } catch (err) {
    console.error("[posters] Error:", err);
    return NextResponse.json([], { status: 500 });
  }
}
