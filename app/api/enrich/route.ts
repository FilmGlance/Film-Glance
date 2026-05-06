// app/api/enrich/route.ts
// Lightweight TMDB-only enrichment endpoint.
// Returns verified poster + cast headshot paths for any movie.
// No auth required — this is a free TMDB lookup, no Anthropic cost.
// Input validated via Zod (audit Phase B — Medium 14).

import { NextRequest, NextResponse } from "next/server";
import { enrichWithTMDB } from "@/lib/tmdb";
import { EnrichRequestSchema } from "@/lib/schemas";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = EnrichRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues.map((i) => i.message) },
      { status: 400 }
    );
  }
  const { title, year, cast } = parsed.data;

  const castInput = cast?.map((c) =>
    typeof c === "string" ? { name: c, character: "" } : { name: c.name, character: c.character || "" }
  );

  try {
    const tmdb = await enrichWithTMDB(title, year, castInput);
    return NextResponse.json(tmdb);
  } catch (err) {
    console.error("Enrich error:", err);
    return NextResponse.json({ error: "Failed to enrich" }, { status: 500 });
  }
}
