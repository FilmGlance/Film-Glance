// app/api/enrich/route.ts
// Lightweight TMDB-only enrichment endpoint.
// Returns verified poster + cast headshot paths for any movie.
// No auth required — this is a free TMDB lookup, no Anthropic cost.

import { NextRequest, NextResponse } from "next/server";
import { enrichWithTMDB } from "@/lib/tmdb";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, year, cast } = body;

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    // Cast can be array of strings (names) or array of {name, character}
    const castInput = cast?.map((c: any) =>
      typeof c === "string" ? { name: c, character: "" } : { name: c.name, character: c.character || "" }
    );

    const tmdb = await enrichWithTMDB(title, year, castInput);

    return NextResponse.json(tmdb);
  } catch (err) {
    console.error("Enrich error:", err);
    return NextResponse.json({ error: "Failed to enrich" }, { status: 500 });
  }
}
