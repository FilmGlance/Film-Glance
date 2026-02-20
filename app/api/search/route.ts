// app/api/search/route.ts
// Protected search endpoint. Proxies Anthropic server-side + enriches with real TMDB images.
//
// Flow:
// 1. Validate auth (Supabase JWT)
// 2. Check rate limit (burst protection)
// 3. Check monthly search quota (plan enforcement)
// 4. Check server-side movie cache
// 5. If miss → call Anthropic API for movie data
// 6. Enrich with REAL TMDB images (poster + cast headshots)
// 7. Cache enriched result, log search, return data

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { calcScore } from "@/lib/score";
import { rateLimit, SEARCH_LIMIT } from "@/lib/rate-limit";
import { enrichWithTMDB } from "@/lib/tmdb";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

function sanitizeQuery(q: string): string {
  return q.trim().toLowerCase().replace(/[^\w\s:'\-&.]/g, "").slice(0, 200);
}

export async function POST(req: NextRequest) {
  try {
    // 1. Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.split(" ")[1];
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // 2. Rate limit (burst)
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
    const rl = rateLimit(`search:${user.id}`, SEARCH_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
      );
    }

    // 3. Parse & validate
    const body = await req.json();
    const query = sanitizeQuery(body.query || "");
    if (!query) {
      return NextResponse.json({ error: "Search query is required" }, { status: 400 });
    }

    // 4. [DORMANT — PRICING DISABLED FOR LAUNCH]
    // Monthly quota enforcement is bypassed. All users have unlimited access.
    // To re-enable: uncomment the block below and remove the bypass flag.
    const PRICING_ENABLED = false;
    if (PRICING_ENABLED) {
      const { data: quotaData, error: quotaError } = await supabaseAdmin.rpc("increment_search", { p_user_id: user.id });
      if (quotaError) {
        console.error("Quota check failed:", quotaError);
        return NextResponse.json({ error: "Failed to check search quota" }, { status: 500 });
      }
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

    // 5. Check server cache
    const { data: cached } = await supabaseAdmin
      .from("movie_cache")
      .select("data, hit_count, expires_at")
      .eq("search_key", query)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (cached) {
      await supabaseAdmin.from("movie_cache").update({ hit_count: (cached.hit_count || 0) + 1 }).eq("search_key", query);
      await supabaseAdmin.from("search_log").insert({ user_id: user.id, query, source: "cache", ip_address: ip });
      const movieData = cached.data as Record<string, unknown>;
      return NextResponse.json({ ...movieData, score: calcScore((movieData.sources as any[]) || []), _source: "cache" });
    }

    // 6. Anthropic API call
    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "Movie API not configured" }, { status: 503 });
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 18000);

    try {
      const apiRes = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
        signal: ctrl.signal,
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          system: "You are a movie database. Return ONLY valid JSON. No markdown fences. No explanation.",
          messages: [{
            role: "user",
            content: `Movie: "${query}"\n\nIMPORTANT: Return data for this EXACT movie title. If it is a sequel, return data for THAT specific sequel, NOT the original.\n\nReturn JSON with: title, year, genre, director, runtime, tagline, description, cast (6-8 with name and character), sources (all 10: RT Critics, RT Audience, Metacritic Metascore, Metacritic User, IMDb, Letterboxd, TMDB, Trakt, Criticker, MUBI — each with name/score/max/type/url), streaming (platform/url), boxOffice (budget, budgetRank, openingWeekend, openingRank, pta, domestic, domesticRank, international, worldwide, worldwideRank, roi, theaterCount, daysInTheater — ranks as all-time like #1, #54, never N/A, estimate if needed), awards (award/result/detail for Oscar, Globe, BAFTA, SAG, Cannes etc). ONLY JSON.`
          }],
        }),
      });
      clearTimeout(timer);

      if (!apiRes.ok) throw new Error(`Anthropic API error: ${apiRes.status}`);

      const d = await apiRes.json();
      const txt = (d.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim();
      const match = txt.match(/\{[\s\S]*\}/);
      if (!match) return NextResponse.json({ error: "Movie not found" }, { status: 404 });

      const mv = JSON.parse(match[0]);
      if (!mv.title || !mv.sources || mv.sources.length === 0) {
        return NextResponse.json({ error: "Movie not found" }, { status: 404 });
      }

      // 7. Enrich with REAL TMDB images
      // Claude guesses TMDB paths — they're often wrong.
      // We call the actual TMDB API to get verified poster + cast headshot paths.
      const tmdb = await enrichWithTMDB(
        mv.title,
        mv.year,
        mv.cast?.map((c: any) => ({ name: c.name, character: c.character }))
      );

      if (tmdb.poster_path) mv.poster_path = tmdb.poster_path;
      if (tmdb.cast && tmdb.cast.length > 0) {
        mv.cast = tmdb.cast.map((tc) => ({
          name: tc.name,
          character: tc.character,
          profile_path: tc.profile_path,
        }));
      }

      // 8. Cache the enriched result (30-day TTL)
      await supabaseAdmin.from("movie_cache").upsert({
        search_key: query,
        data: mv,
        source: "api",
        hit_count: 0,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });

      // 9. Log search
      await supabaseAdmin.from("search_log").insert({ user_id: user.id, query, source: "api", ip_address: ip });

      return NextResponse.json({ ...mv, score: calcScore(mv.sources), _source: "api" });
    } catch (apiErr) {
      clearTimeout(timer);
      console.error("Anthropic API error:", apiErr);
      return NextResponse.json({ error: "Movie search timed out. Please try again." }, { status: 504 });
    }
  } catch (err) {
    console.error("Search route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
