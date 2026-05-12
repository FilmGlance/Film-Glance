// scripts/backfill-fallback-rows.ts
//
// Post-Phase-C cleanup. Phase C-3/C-4/C-5/C-6 added ~20,769 cache rows but
// ~22% (~4,500) hit the runFullPipeline FALLBACK path (Claude said
// not_a_movie OR title-search missed) and were written WITHOUT
// poster/cast/recommendations/video_reviews/streaming/trailer/backdrop.
// Plus 0 of 24,915 rows have backdrop_path or popularity (the cinematic
// hero on /discover + the Hidden Gems filter both depend on them).
//
// This script identifies rows missing TMDB enrichment, calls the new
// `enrichByTmdbId` helper (added in v6.7.0 — bypasses title-search,
// uses tmdb_id directly), and updates the cache row's `data` JSONB
// in-place.
//
// FREE: only TMDB API calls (no Anthropic, no RapidAPI for already-
// enriched rows; one RapidAPI YouTube call per row for video_reviews).
// Real cost: ~$0.001 per row × ~4,500 rows = ~$5 total at most.
//
// Run on VPS:
//   cd ~/film-glance-bulk-seed
//   git pull origin staging
//   nohup npx tsx scripts/backfill-fallback-rows.ts > ~/backfill.log 2>&1 &
//   tail -f ~/backfill.log
//
// Optional flags:
//   --dry-run                  // print candidates, no API/DB writes
//   --limit=N                  // process at most N rows (use with --dry-run)
//   --backdrop-only            // only fill backdrop+popularity (skip rows
//                                 that have cast already — fast pass for
//                                 the cinematic hero unblock)
//
// Required env (loaded from .env.local at project root):
//   ANTHROPIC_API_KEY (unused but loaded for parity), TMDB_API_KEY,
//   RAPIDAPI_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// State: ~/.backfill-fallback-rows-state.json (resumable)
// Failures: ~/.backfill-fallback-rows-failures.log (non-fatal)

import { readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// ─── Env loading ────────────────────────────────────────────────────────
function loadEnv(): void {
  const path = ".env.local";
  if (!existsSync(path)) {
    console.error(`Missing ${path} at project root.`);
    process.exit(1);
  }
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
}
loadEnv();

const REQUIRED = [
  "TMDB_API_KEY", "RAPIDAPI_KEY",
  "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY",
];
for (const k of REQUIRED) {
  if (!process.env[k]) {
    console.error(`Missing required env var: ${k}`);
    process.exit(1);
  }
}

let enrichByTmdbId!: typeof import("../lib/tmdb.js")["enrichByTmdbId"];

// ─── CLI flags ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const BACKDROP_ONLY = args.includes("--backdrop-only");
const limitArg = args.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? parseInt(limitArg.split("=")[1], 10) : Infinity;

// ─── Tunables ──────────────────────────────────────────────────────────
const CONCURRENCY = 5;
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const STATE_PATH = join(homedir(), ".backfill-fallback-rows-state.json");
const FAILURE_LOG = join(homedir(), ".backfill-fallback-rows-failures.log");

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

interface State {
  processedTmdbIds: number[];
  totalUpdated: number;
  totalSkipped: number;
  estCostUsd: number;
}

interface Candidate {
  search_key: string;
  tmdb_id: number;
  data: any;
}

function loadState(): State {
  if (existsSync(STATE_PATH)) {
    try { return JSON.parse(readFileSync(STATE_PATH, "utf8")); }
    catch { /* fallthrough */ }
  }
  return { processedTmdbIds: [], totalUpdated: 0, totalSkipped: 0, estCostUsd: 0 };
}

function saveState(s: State): void {
  writeFileSync(STATE_PATH, JSON.stringify(s, null, 2));
}

// ─── Supabase ─────────────────────────────────────────────────────────
async function sbGet<T = any>(query: string, range?: { from: number; to: number }): Promise<T[]> {
  const headers: Record<string, string> = {
    apikey: SB_KEY,
    authorization: `Bearer ${SB_KEY}`,
  };
  if (range) {
    headers["Range"] = `${range.from}-${range.to}`;
    headers["Range-Unit"] = "items";
  }
  const r = await fetch(`${SB_URL}/rest/v1/${query}`, { headers });
  if (!r.ok) throw new Error(`Supabase GET ${query} → ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

async function sbGetAll<T>(query: string): Promise<T[]> {
  const PAGE = 1000;
  const out: T[] = [];
  for (let page = 0; page < 1000; page++) {
    const from = page * PAGE;
    const rows = await sbGet<T>(query, { from, to: from + PAGE - 1 });
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

// PATCH a single cache row by search_key (write back the full data blob)
async function sbPatch(searchKey: string, dataField: any): Promise<void> {
  const url = `${SB_URL}/rest/v1/movie_cache?search_key=eq.${encodeURIComponent(searchKey)}`;
  const r = await fetch(url, {
    method: "PATCH",
    headers: {
      apikey: SB_KEY,
      authorization: `Bearer ${SB_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ data: dataField }),
  });
  if (!r.ok) {
    throw new Error(`PATCH ${searchKey} → ${r.status}: ${(await r.text()).slice(0, 200)}`);
  }
}

// ─── Candidate identification ─────────────────────────────────────────
//
// A row needs the full re-enrichment when:
//   - tmdb_id is non-null AND
//   - cast is empty (no profile_paths, no names) AND
//   - recommendations is empty
// (signature of the fallback-path bare row)
//
// A row needs JUST backdrop+popularity backfill when:
//   - tmdb_id is non-null AND
//   - cast/recs are populated AND
//   - data.backdrop_path is missing or data.popularity is null
//   (--backdrop-only mode targets these)

function isBareFallback(row: { data: any }): boolean {
  const d = row.data || {};
  return (!Array.isArray(d.cast) || d.cast.length === 0) &&
         (!Array.isArray(d.recommendations) || d.recommendations.length === 0);
}

function needsBackdropOrPopularity(row: { data: any }): boolean {
  const d = row.data || {};
  return !d.backdrop_path || d.popularity == null;
}

// ─── Per-candidate worker ──────────────────────────────────────────────
async function processCandidate(c: Candidate): Promise<{ ok: boolean; reason?: string; updated?: boolean }> {
  try {
    if (DRY_RUN) {
      return { ok: true, reason: "dry-run", updated: false };
    }

    const title = c.data?.title || "";
    const year = typeof c.data?.year === "number" ? c.data.year : undefined;

    const enriched = await enrichByTmdbId(c.tmdb_id, title, year).catch(() => null);
    if (!enriched) {
      return { ok: false, reason: "enrichByTmdbId returned null" };
    }

    // Build the merged data object — preserve everything in the existing
    // cache row's data, only OVERWRITE fields that were missing/empty.
    const newData = { ...c.data };
    let touched = false;

    if (!c.data?.poster_path && enriched.poster_path) {
      newData.poster_path = enriched.poster_path;
      newData.poster = `https://image.tmdb.org/t/p/w500${enriched.poster_path}`;
      touched = true;
    }
    if (!c.data?.backdrop_path && enriched.backdrop_path) {
      newData.backdrop_path = enriched.backdrop_path;
      touched = true;
    }
    if (c.data?.popularity == null && enriched.popularity != null) {
      newData.popularity = enriched.popularity;
      touched = true;
    }
    // For cast/recs/streaming/trailer/video_reviews, only overwrite if
    // existing is empty/null — never clobber populated fields.
    if (!BACKDROP_ONLY) {
      if ((!Array.isArray(c.data?.cast) || c.data.cast.length === 0) && enriched.cast.length > 0) {
        newData.cast = enriched.cast;
        touched = true;
      }
      if ((!Array.isArray(c.data?.recommendations) || c.data.recommendations.length === 0) && enriched.recommendations.length > 0) {
        newData.recommendations = enriched.recommendations;
        touched = true;
      }
      if ((!Array.isArray(c.data?.streaming) || c.data.streaming.length === 0) && enriched.streaming.length > 0) {
        newData.streaming = enriched.streaming;
        touched = true;
      }
      if (!c.data?.trailer_key && enriched.trailer_key) {
        newData.trailer_key = enriched.trailer_key;
        touched = true;
      }
      if ((!Array.isArray(c.data?.video_reviews) || c.data.video_reviews.length === 0) && enriched.video_reviews.length > 0) {
        newData.video_reviews = enriched.video_reviews;
        touched = true;
      }
      if (!c.data?.director && enriched.director) {
        newData.director = enriched.director;
        touched = true;
      }
    }

    if (!touched) return { ok: true, reason: "nothing to update", updated: false };

    await sbPatch(c.search_key, newData);
    return { ok: true, updated: true };
  } catch (e) {
    return { ok: false, reason: `exception: ${(e as Error).message}` };
  }
}

// ─── Main ──────────────────────────────────────────────────────────────
async function main() {
  console.log(`[backfill] DRY_RUN=${DRY_RUN} BACKDROP_ONLY=${BACKDROP_ONLY} LIMIT=${LIMIT === Infinity ? "∞" : LIMIT} CONCURRENCY=${CONCURRENCY}`);

  const tmdbMod = await import("../lib/tmdb.js");
  enrichByTmdbId = tmdbMod.enrichByTmdbId;

  console.log("[backfill] loading cache rows with non-null tmdb_id…");
  const allRows = await sbGetAll<{ search_key: string; tmdb_id: number; data: any }>(
    "movie_cache?tmdb_id=not.is.null&select=search_key,tmdb_id,data"
  );
  console.log(`[backfill] loaded ${allRows.length} candidate rows`);

  const candidates: Candidate[] = allRows.filter((r) => {
    if (BACKDROP_ONLY) return needsBackdropOrPopularity(r);
    return isBareFallback(r) || needsBackdropOrPopularity(r);
  });
  console.log(`[backfill] qualifying for backfill: ${candidates.length}`);

  const state = loadState();
  const seen = new Set(state.processedTmdbIds);
  const remaining = candidates.filter((c) => !seen.has(c.tmdb_id));
  if (state.processedTmdbIds.length > 0) {
    console.log(`[backfill] resume: ${state.processedTmdbIds.length} already processed (${remaining.length} remaining)`);
  }

  const queue = remaining.slice(0, LIMIT === Infinity ? remaining.length : LIMIT);
  console.log(`[backfill] processing ${queue.length} rows`);

  if (DRY_RUN) {
    console.log("[backfill] DRY-RUN sample (first 20):");
    queue.slice(0, 20).forEach((c, i) => {
      const d = c.data || {};
      const tags: string[] = [];
      if (!d.poster_path) tags.push("noPoster");
      if (!d.backdrop_path) tags.push("noBackdrop");
      if (d.popularity == null) tags.push("noPopularity");
      if (!Array.isArray(d.cast) || d.cast.length === 0) tags.push("noCast");
      if (!Array.isArray(d.recommendations) || d.recommendations.length === 0) tags.push("noRecs");
      console.log(`  ${i + 1}. tmdb=${c.tmdb_id} "${d.title}" (${d.year ?? "?"}) [${tags.join(",")}]`);
    });
    console.log("[backfill] DRY-RUN — no API/DB writes. Exiting.");
    return;
  }

  const startTime = Date.now();
  let processed = 0;
  let inFlight: Promise<void>[] = [];

  async function worker(): Promise<void> {
    while (true) {
      const c = queue.shift();
      if (!c) return;
      const r = await processCandidate(c);
      processed++;
      seen.add(c.tmdb_id);
      state.processedTmdbIds.push(c.tmdb_id);
      if (r.ok && r.updated) {
        state.totalUpdated++;
        state.estCostUsd += 0.001; // ~1 TMDB call + 1 RapidAPI YouTube call
      } else if (r.ok) {
        state.totalSkipped++;
      } else {
        appendFileSync(
          FAILURE_LOG,
          `${new Date().toISOString()}\t${c.tmdb_id}\t${c.data?.title}\t${r.reason ?? ""}\n`
        );
      }

      if (processed % 25 === 0) {
        const elapsed = Date.now() - startTime;
        const rate = processed / (elapsed / 1000);
        const remainingCt = queue.length;
        const etaSec = remainingCt / Math.max(rate, 0.001);
        const etaH = Math.floor(etaSec / 3600);
        const etaM = Math.floor((etaSec % 3600) / 60);
        const tag = r.ok ? (r.updated ? "✓" : "skip") : `✗ ${r.reason}`;
        console.log(
          `[backfill] ${processed}/${processed + remainingCt} ${tag} "${c.data?.title}" | ` +
          `updated=${state.totalUpdated} skipped=${state.totalSkipped} ` +
          `cost~$${state.estCostUsd.toFixed(2)} rate=${rate.toFixed(2)}/s ETA=${etaH}h${etaM}m`
        );
        saveState(state);
      }
    }
  }

  for (let i = 0; i < CONCURRENCY; i++) inFlight.push(worker());
  await Promise.all(inFlight);

  saveState(state);
  const elapsedH = ((Date.now() - startTime) / 3600000).toFixed(2);
  console.log(
    `\n[backfill] DONE in ${elapsedH}h. ` +
    `updated=${state.totalUpdated}, skipped=${state.totalSkipped}, cost~$${state.estCostUsd.toFixed(2)}`
  );
}

main().catch((err) => {
  console.error("[backfill] fatal:", err);
  process.exit(1);
});
