// app/api/seed/route.ts
// Pre-seed the movie cache with popular titles to reduce API costs.
// 
// Usage: POST /api/seed with Authorization header (must be authenticated)
// This will process a batch of popular movies, calling Claude + TMDB for each,
// and caching the results. Skips movies that are already cached.
//
// Rate: Processes one movie every 2 seconds to avoid API rate limits.
// A full seed of 100 movies takes ~3-4 minutes and costs ~$0.90 on Haiku.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { calcScore } from "@/lib/score";
import { enrichWithTMDB } from "@/lib/tmdb";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-haiku-4-5-20251001";
const CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

// Top 100 most searched/popular movies — covers the majority of user queries
const POPULAR_MOVIES = [
  // All-time classics
  "The Shawshank Redemption", "The Godfather", "The Dark Knight", "Pulp Fiction",
  "Fight Club", "Forrest Gump", "The Matrix", "Goodfellas", "Schindler's List",
  "Inception", "The Lord of the Rings: The Fellowship of the Ring",
  "The Lord of the Rings: The Return of the King", "The Lord of the Rings: The Two Towers",
  "Star Wars: Episode IV - A New Hope", "Star Wars: Episode V - The Empire Strikes Back",
  "The Silence of the Lambs", "Se7en", "The Usual Suspects", "Saving Private Ryan",
  "Interstellar",
  // Modern favorites
  "The Social Network", "Whiplash", "Parasite", "Everything Everywhere All at Once",
  "Oppenheimer", "Barbie", "Spider-Man: Into the Spider-Verse", "Dune",
  "Dune: Part Two", "Top Gun: Maverick", "The Batman", "No Country for Old Men",
  "There Will Be Blood", "Django Unchained", "The Wolf of Wall Street",
  "Mad Max: Fury Road", "Get Out", "Arrival", "Blade Runner 2049",
  "La La Land",
  // Action & Sci-Fi
  "Gladiator", "The Departed", "Inglourious Basterds", "John Wick",
  "The Avengers", "Avengers: Endgame", "Avengers: Infinity War",
  "Iron Man", "Black Panther", "Spider-Man: No Way Home",
  "Jurassic Park", "Terminator 2: Judgment Day", "Alien", "Aliens",
  "The Terminator", "Die Hard", "Predator", "RoboCop",
  "Back to the Future", "Avatar",
  // Drama & Thriller
  "The Prestige", "Memento", "Shutter Island", "Gone Girl",
  "Zodiac", "Prisoners", "Sicario", "Nightcrawler",
  "American Psycho", "A Beautiful Mind", "Good Will Hunting",
  "The Truman Show", "Eternal Sunshine of the Spotless Mind",
  "12 Angry Men", "Rear Window", "Psycho",
  "Taxi Driver", "Raging Bull", "Casino", "Heat",
  // Comedy & Animation
  "The Big Lebowski", "Superbad", "The Hangover", "Step Brothers",
  "Groundhog Day", "Ferris Bueller's Day Off",
  "Toy Story", "Finding Nemo", "Up", "WALL-E",
  "Inside Out", "Spirited Away", "Coco", "Ratatouille",
  // Horror
  "The Shining", "Hereditary", "Midsommar", "The Exorcist",
  "A Quiet Place", "It",
  // Recent hits
  "The Holdovers", "Killers of the Flower Moon", "Past Lives",
  "Poor Things", "The Zone of Interest", "Anatomy of a Fall",
  "Civil War", "Furiosa",
  // Poker / niche (user's interests)
  "Rounders", "Molly's Game", "The Cincinnati Kid",
];

function normalizeCacheKey(q: string): string {
  let key = q.toLowerCase().trim();
  key = key.replace(/^(the|a|an)\s+/i, "");
  key = key.replace(/[''`:;!?.,"()]/g, "").replace(/\s+/g, " ").trim();
  return key;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function seedMovie(title: string): Promise<{ title: string; status: string; cached?: boolean }> {
  const cacheKey = normalizeCacheKey(title);

  // Check if already cached and not expired
  try {
    const { data } = await supabaseAdmin
      .from("movie_cache")
      .select("search_key, expires_at")
      .eq("search_key", cacheKey)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (data) {
      return { title, status: "skipped (already cached)", cached: true };
    }
  } catch {
    // Not cached — continue
  }

  // Call Claude
  try {
    const apiRes = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 2000,
        system: [
          "You are a movie database that returns structured JSON data about films.",
          "Return ONLY valid JSON. No markdown fences. No explanation.",
        ].join("\n"),
        messages: [{
          role: "user",
          content: `Movie: "${title}"\n\nReturn JSON with: title (official title), year, genre (string like "Action · Comedy"), director, runtime (string like "93 min"), tagline, description, cast (6-8 with name and character), sources (all 10: RT Critics, RT Audience, Metacritic Metascore, Metacritic User, IMDb, Letterboxd, TMDB, Trakt, Criticker, MUBI — each with name, score as NUMBER, max as NUMBER, type, url), boxOffice (budget, budgetRank, openingWeekend, openingRank, pta, domestic, domesticRank, international, worldwide, worldwideRank, roi, theaterCount, daysInTheater — ranks as all-time like #1, #54, never N/A, estimate if needed), awards (award/result/detail for Oscar, Globe, BAFTA, SAG, Cannes etc). ONLY JSON.`,
        }],
      }),
    });

    if (!apiRes.ok) {
      return { title, status: `claude error: ${apiRes.status}` };
    }

    const d = await apiRes.json();
    const txt = (d.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim();
    const match = txt.match(/\{[\s\S]*\}/);
    if (!match) return { title, status: "no JSON in response" };

    const mv = JSON.parse(match[0]);
    if (!mv.title || !mv.sources) return { title, status: "incomplete data" };

    // Enrich with TMDB
    const tmdb = await enrichWithTMDB(
      mv.title,
      mv.year,
      mv.cast?.map((c: any) => ({ name: c.name, character: c.character }))
    );

    if (tmdb.poster_path) {
      mv.poster_path = tmdb.poster_path;
      mv.poster = `https://image.tmdb.org/t/p/w500${tmdb.poster_path}`;
    }
    if (tmdb.cast && tmdb.cast.length > 0) {
      mv.cast = tmdb.cast.map((tc) => ({
        name: tc.name,
        character: tc.character,
        profile_path: tc.profile_path,
      }));
    }
    if ((tmdb as any).streaming?.length > 0) {
      mv.streaming = (tmdb as any).streaming;
    }

    // Cache it
    await supabaseAdmin.from("movie_cache").upsert({
      search_key: cacheKey,
      data: mv,
      source: "seed",
      hit_count: 0,
      cached_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
    });

    return { title, status: "seeded", cached: false };
  } catch (err: any) {
    return { title, status: `error: ${err.message}` };
  }
}

export async function POST(req: NextRequest) {
  // Auth check — only authenticated users can trigger seeding
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

  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "API not configured" }, { status: 503 });
  }

  // Process movies with delay between each to respect rate limits
  const results: { title: string; status: string }[] = [];
  let seeded = 0;
  let skipped = 0;
  let errors = 0;

  for (const title of POPULAR_MOVIES) {
    const result = await seedMovie(title);
    results.push(result);

    if (result.status === "seeded") seeded++;
    else if (result.cached) skipped++;
    else errors++;

    // 2-second delay between API calls to avoid rate limits
    if (!result.cached) await delay(2000);
  }

  return NextResponse.json({
    summary: { total: POPULAR_MOVIES.length, seeded, skipped, errors },
    results,
  });
}
