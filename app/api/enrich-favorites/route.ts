// app/api/enrich-favorites/route.ts
//
// Lazy enrichment for favourites whose director / runtime / overview columns
// are still null after the cache backfill (migration 012). Calls Claude
// Sonnet 4.6 once with a batch prompt, then writes the results back to the
// user's favorites rows.
//
// Auth: Bearer token (Supabase session). Required because we write to the
// user's data and to prevent the endpoint being used as a free Claude oracle
// — every (title, year) pair in the request is validated against the user's
// own favorites rows before the Claude call fires.
//
// Request body: { items: [{ title: string, year?: number|null }, ...] }
// Cap: 20 items per request.
//
// Response: { enriched: [{ title, year, director, runtime, overview }, ...] }
// Updated rows are also written to favorites in the same handler.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const SONNET_MODEL = "claude-sonnet-4-6";
const MAX_ITEMS = 20;

interface InputItem { title: string; year?: number | null; }
interface EnrichedItem {
  title: string;
  year: number | null;
  director: string | null;
  runtime: number | null;
  overview: string | null;
}

async function getUser(req: NextRequest) {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(auth.split(" ")[1]);
  if (error || !user) return null;
  return user;
}

function buildPrompt(items: InputItem[]): string {
  const list = items.map((it, i) =>
    `  {"i":${i},"title":${JSON.stringify(it.title)}${it.year ? `,"year":${it.year}` : ""}}`
  ).join(",\n");
  return [
    "For each movie in the list below, return its director, runtime in",
    "minutes, and a one-to-two-sentence overview (max 220 characters,",
    "spoiler-free, in present tense).",
    "",
    "Return ONLY a JSON array. No markdown fences, no preamble, no",
    "trailing commentary. Each object must have keys exactly:",
    "  i (the index from input),",
    "  director (string or null),",
    "  runtime (integer minutes or null),",
    "  overview (string or null).",
    "",
    "If you do not recognize a movie with high confidence, return null",
    "for every field on that index — do NOT fabricate.",
    "",
    "Input:",
    "[",
    list,
    "]",
  ].join("\n");
}

interface ClaudeResult { i: number; director: string | null; runtime: number | null; overview: string | null; }

function parseClaudeResponse(text: string): ClaudeResult[] {
  // Strip code fences if Sonnet adds them despite the instruction.
  const cleaned = text.trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((r) => r && typeof r === "object" && Number.isInteger(r.i))
      .map((r) => ({
        i: r.i,
        director: typeof r.director === "string" && r.director.trim() ? r.director.trim() : null,
        runtime: Number.isFinite(r.runtime) && r.runtime > 0 ? Math.round(r.runtime) : null,
        overview: typeof r.overview === "string" && r.overview.trim() ? r.overview.trim().slice(0, 600) : null,
      }));
  } catch {
    console.error("[enrich-favorites] failed to parse Claude JSON, raw text:", cleaned.slice(0, 400));
    return [];
  }
}

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });

  let body: { items?: InputItem[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const items: InputItem[] = (Array.isArray(body.items) ? body.items : [])
    .filter((it): it is InputItem => !!it && typeof it.title === "string" && it.title.trim().length > 0)
    .map((it) => ({
      title: it.title.trim().slice(0, 200),
      year: typeof it.year === "number" ? it.year : null,
    }))
    .slice(0, MAX_ITEMS);

  if (items.length === 0) return NextResponse.json({ enriched: [] });

  // Validate each (title, year) pair belongs to this user — prevents using
  // this endpoint as a free Claude oracle for arbitrary movie lookups.
  const { data: ownedRows, error: ownErr } = await supabaseAdmin
    .from("favorites")
    .select("title, year")
    .eq("user_id", user.id);
  if (ownErr) {
    console.error("[enrich-favorites] ownership query error:", ownErr);
    return NextResponse.json({ error: "Failed to validate favourites" }, { status: 500 });
  }
  const ownedKey = (t: string, y: number | null) => `${t}|${y ?? ""}`;
  const owned = new Set((ownedRows || []).map((r) => ownedKey(r.title, r.year)));
  const validItems = items.filter((it) => owned.has(ownedKey(it.title, it.year ?? null)));
  if (validItems.length === 0) return NextResponse.json({ enriched: [] });

  // Single Claude call for the whole batch.
  let claudeRes: Response;
  try {
    claudeRes = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        model: SONNET_MODEL,
        max_tokens: 1500,
        messages: [{ role: "user", content: buildPrompt(validItems) }],
      }),
    });
  } catch (err) {
    console.error("[enrich-favorites] Claude fetch failed:", err);
    return NextResponse.json({ error: "Enrichment failed" }, { status: 502 });
  }

  if (!claudeRes.ok) {
    console.error("[enrich-favorites] Claude returned", claudeRes.status);
    return NextResponse.json({ error: "Enrichment failed" }, { status: 502 });
  }

  const claudeJson = await claudeRes.json();
  const txt: string = (claudeJson.content || [])
    .filter((b: { type?: string }) => b.type === "text")
    .map((b: { text?: string }) => b.text || "")
    .join("\n");
  const results = parseClaudeResponse(txt);

  // Build the response payload + write back to favorites.
  const enriched: EnrichedItem[] = [];
  await Promise.all(results.map(async (r) => {
    const src = validItems[r.i];
    if (!src) return;
    const update: Record<string, string | number | null> = {};
    if (r.director) update.director = r.director.slice(0, 200);
    if (r.runtime) update.runtime = r.runtime;
    if (r.overview) update.overview = r.overview;
    if (Object.keys(update).length === 0) return;

    const baseQuery = supabaseAdmin
      .from("favorites")
      .update(update)
      .eq("user_id", user.id)
      .eq("title", src.title);
    const { error: updErr } = await (src.year == null
      ? baseQuery.is("year", null)
      : baseQuery.eq("year", src.year));
    if (updErr) console.error("[enrich-favorites] update error:", updErr, src.title);

    enriched.push({
      title: src.title,
      year: src.year ?? null,
      director: r.director,
      runtime: r.runtime,
      overview: r.overview,
    });
  }));

  return NextResponse.json({ enriched });
}
