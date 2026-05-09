// scripts/seed-from-bom.ts
//
// One-shot: take every distinct title in `box_office_metrics`, set-diff
// against `movie_cache` (by both search_key AND tmdb_id), and run only the
// MISSING films through the canonical full pipeline. Hard dedup before any
// paid API call — no duplicate scraping.
//
// Run on VPS (after bom-deep-rescrape.ts has populated topN=100 rows):
//   cd ~/film-glance-bulk-seed
//   git pull origin main
//   nohup npx tsx scripts/seed-from-bom.ts > ~/seed-from-bom.log 2>&1 &
//   tail -f ~/seed-from-bom.log
//
// Optional flags:
//   --dry-run                  // print the gap, do not call pipeline
//   --limit=N                  // process at most N candidates (testing)
//
// Required env (loaded from .env.local at project root):
//   ANTHROPIC_API_KEY, TMDB_API_KEY, RAPIDAPI_KEY, OMDB_API_KEY,
//   SIMKL_CLIENT_ID, TRAKT_CLIENT_ID,
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// State: ~/.seed-from-bom-state.json (resumable). Failures appended to
// ~/.seed-from-bom-failures.log; failures don't stop the run.

import { readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// ─── Env loading (must run before any lib import) ───────────────────────
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
  "ANTHROPIC_API_KEY", "TMDB_API_KEY", "RAPIDAPI_KEY",
  "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY",
];
for (const k of REQUIRED) {
  if (!process.env[k]) {
    console.error(`Missing required env var: ${k}`);
    process.exit(1);
  }
}

// Lib imports run AFTER env is loaded — assigned inside main() so we don't
// rely on top-level await (tsx defaults to CJS where TLA is a parse error).
let runFullPipeline!: typeof import("../lib/search-pipeline.js")["runFullPipeline"];
let writeCacheEntries!: typeof import("../lib/search-pipeline.js")["writeCacheEntries"];

// ─── CLI flags ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const limitArg = args.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? parseInt(limitArg.split("=")[1], 10) : Infinity;

// ─── Tunables ──────────────────────────────────────────────────────────
const CONCURRENCY = 5;            // Anthropic tier-1 default cap
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const STATE_PATH = join(homedir(), ".seed-from-bom-state.json");
const FAILURE_LOG = join(homedir(), ".seed-from-bom-failures.log");

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

interface State {
  processedKeys: string[]; // search_keys we've completed in this run
  totalAdded: number;
  estCostUsd: number;
}

interface Candidate {
  search_key: string;
  title: string;
  release_year: number | null;
  tmdb_id: number | null;
}

function loadState(): State {
  if (existsSync(STATE_PATH)) {
    try {
      return JSON.parse(readFileSync(STATE_PATH, "utf8"));
    } catch {
      // fallthrough
    }
  }
  return { processedKeys: [], totalAdded: 0, estCostUsd: 0 };
}

function saveState(s: State): void {
  writeFileSync(STATE_PATH, JSON.stringify(s, null, 2));
}

// ─── Supabase REST helpers ─────────────────────────────────────────────
async function sbGet(query: string, range?: { from: number; to: number }): Promise<any[]> {
  const headers: Record<string, string> = {
    apikey: SB_KEY,
    authorization: `Bearer ${SB_KEY}`,
  };
  if (range) {
    headers["Range"] = `${range.from}-${range.to}`;
    headers["Range-Unit"] = "items";
  }
  const r = await fetch(`${SB_URL}/rest/v1/${query}`, { headers });
  if (!r.ok) {
    throw new Error(`Supabase GET ${query} → ${r.status}: ${await r.text()}`);
  }
  return r.json();
}

// Page through a query that may exceed PostgREST's 1000-row default cap.
async function sbGetAll<T>(query: string): Promise<T[]> {
  const PAGE = 1000;
  const out: T[] = [];
  for (let page = 0; page < 1000; page++) {
    const from = page * PAGE;
    const rows = await sbGet(query, { from, to: from + PAGE - 1 });
    out.push(...(rows as T[]));
    if (rows.length < PAGE) break;
  }
  return out;
}

// ─── Gap computation ───────────────────────────────────────────────────

async function loadCacheKeys(): Promise<{ keys: Set<string>; tmdbIds: Set<number> }> {
  console.log("[seed-from-bom] loading movie_cache search_keys + tmdb_ids…");
  const rows = await sbGetAll<{ search_key: string; tmdb_id: number | null }>(
    "movie_cache?select=search_key,tmdb_id",
  );
  const keys = new Set<string>();
  const tmdbIds = new Set<number>();
  for (const r of rows) {
    keys.add(r.search_key);
    if (typeof r.tmdb_id === "number") tmdbIds.add(r.tmdb_id);
  }
  return { keys, tmdbIds };
}

async function loadBomCandidates(): Promise<Candidate[]> {
  // Pull every distinct (search_key, title, release_year, tmdb_id) tuple
  // from box_office_metrics. We dedupe by search_key client-side, taking the
  // most recent occurrence (newest period_start) so the title spelling
  // matches the latest BOM canonical form.
  console.log("[seed-from-bom] loading box_office_metrics distinct films…");
  const rows = await sbGetAll<{
    search_key: string;
    title: string;
    release_year: number | null;
    tmdb_id: number | null;
    period_start: string;
  }>(
    "box_office_metrics?select=search_key,title,release_year,tmdb_id,period_start&region=eq.domestic&order=period_start.desc",
  );
  const byKey = new Map<string, Candidate>();
  for (const r of rows) {
    if (!byKey.has(r.search_key)) {
      byKey.set(r.search_key, {
        search_key: r.search_key,
        title: r.title,
        release_year: r.release_year ?? null,
        tmdb_id: r.tmdb_id ?? null,
      });
    }
  }
  return [...byKey.values()];
}

function computeGap(
  bomCandidates: Candidate[],
  cacheKeys: Set<string>,
  cacheTmdbIds: Set<number>,
): Candidate[] {
  // Hard dedup: skip if EITHER search_key matches a cached row OR tmdb_id
  // matches. Both checks because some legacy cache rows have NULL tmdb_id.
  return bomCandidates.filter((c) => {
    if (cacheKeys.has(c.search_key)) return false;
    if (c.tmdb_id != null && cacheTmdbIds.has(c.tmdb_id)) return false;
    return true;
  });
}

// ─── Per-candidate worker ──────────────────────────────────────────────

async function processCandidate(c: Candidate): Promise<{ ok: boolean; cost: number; reason?: string }> {
  const queryForClaude = c.release_year ? `${c.title} ${c.release_year}` : c.title;
  const queryForRatings = c.title;
  try {
    if (DRY_RUN) {
      return { ok: true, cost: 0, reason: "dry-run" };
    }
    const mv = await runFullPipeline(queryForClaude, queryForRatings, c.release_year ?? undefined);
    // BOM-sourced candidates: BOM presence is proof of real-movie status.
    // We deliberately DO NOT reject when Claude says "not_a_movie" — its
    // training cutoff (Jan 2026) misses recent niche releases that BOM has
    // already verified by charting them. runFullPipeline runs Claude / TMDB
    // / RapidAPI in parallel; even when Claude returns not_a_movie, TMDB
    // and ratings calls already returned real data, so mv.title (TMDB-
    // sourced) and mv.sources (RapidAPI) are still populated.
    //
    // Reject only when:
    //   1. The pipeline returned nothing usable (no title at all).
    //   2. Verified ratings sources are below the data-quality floor.
    //      The ≥5-sources gate stays — it's a signal that the film is
    //      well-known enough to score reliably. BOM long-tail films
    //      below this floor would produce a fragile fg_score.
    if (!mv || !mv.title) {
      return { ok: false, cost: 0.005, reason: "no title from pipeline" };
    }
    if (!Array.isArray((mv as any).sources) || (mv as any).sources.length < 5) {
      return { ok: false, cost: 0.012, reason: `low source_count=${(mv as any).sources?.length ?? 0}` };
    }
    // If Claude flagged not_a_movie but TMDB/ratings provided enough data
    // to pass the gates, clear the error flag so it doesn't poison the
    // cached row's data shape.
    if ((mv as any).error === "not_a_movie") {
      delete (mv as any).error;
    }
    // Defense — runFullPipeline should already set tmdb_id from TMDB lookup,
    // but if BOM had it pre-resolved, prefer that.
    if (typeof (mv as any).tmdb_id !== "number" && c.tmdb_id != null) {
      (mv as any).tmdb_id = c.tmdb_id;
    }
    const normalize = (s: string) => s.toLowerCase().trim()
      .replace(/^(the|a|an)\s+/i, "")
      .replace(/[''`:;!?.,"()]/g, "").replace(/\s+/g, " ").trim();
    const searchKey = normalize(mv.title);
    await writeCacheEntries(searchKey, mv.title, mv.title, mv as any, null, "127.0.0.1", "seed-from-bom");
    return { ok: true, cost: 0.014 };
  } catch (e) {
    return { ok: false, cost: 0, reason: `exception: ${(e as Error).message}` };
  }
}

// Concurrent worker pool: process queue with at-most CONCURRENCY in-flight.
async function runWithConcurrency(
  queue: Candidate[],
  state: State,
  onResult: (c: Candidate, r: { ok: boolean; cost: number; reason?: string }) => void,
): Promise<void> {
  const inFlight: Promise<void>[] = [];
  let nextIdx = 0;

  async function worker(): Promise<void> {
    while (nextIdx < queue.length) {
      const idx = nextIdx++;
      const c = queue[idx];
      const result = await processCandidate(c);
      onResult(c, result);
      state.estCostUsd += result.cost;
      if (result.ok) {
        state.totalAdded++;
        state.processedKeys.push(c.search_key);
      } else {
        appendFileSync(
          FAILURE_LOG,
          `${new Date().toISOString()}\t${c.search_key}\t${c.title}\t${result.reason ?? ""}\n`,
        );
      }
      // Save state every 10 candidates
      if ((state.totalAdded + (state.processedKeys.length % 10)) === 0) {
        saveState(state);
      }
    }
  }

  for (let i = 0; i < CONCURRENCY; i++) inFlight.push(worker());
  await Promise.all(inFlight);
}

// ─── Main ──────────────────────────────────────────────────────────────
async function main() {
  console.log(`[seed-from-bom] DRY_RUN=${DRY_RUN} LIMIT=${LIMIT === Infinity ? "∞" : LIMIT} CONCURRENCY=${CONCURRENCY}`);

  // Load lib AFTER env is loaded.
  const pipeline = await import("../lib/search-pipeline.js");
  runFullPipeline = pipeline.runFullPipeline;
  writeCacheEntries = pipeline.writeCacheEntries;

  // Step 1: compute the gap.
  const [{ keys: cacheKeys, tmdbIds: cacheTmdbIds }, bomCandidates] = await Promise.all([
    loadCacheKeys(),
    loadBomCandidates(),
  ]);
  console.log(
    `[seed-from-bom] cache: ${cacheKeys.size} search_keys, ${cacheTmdbIds.size} tmdb_ids`,
  );
  console.log(`[seed-from-bom] BOM distinct films: ${bomCandidates.length}`);

  const gap = computeGap(bomCandidates, cacheKeys, cacheTmdbIds);
  console.log(`[seed-from-bom] gap (films to seed): ${gap.length}`);
  console.log(`[seed-from-bom] est. budget: ~$${(gap.length * 0.014).toFixed(2)} at $0.014/film`);

  // Step 2: resume support — drop any keys we've already processed in
  // a previous run.
  const state = loadState();
  const processedSet = new Set(state.processedKeys);
  const remaining = gap.filter((c) => !processedSet.has(c.search_key));
  if (state.processedKeys.length > 0) {
    console.log(
      `[seed-from-bom] resume: ${state.processedKeys.length} already processed (${remaining.length} remaining)`,
    );
  }

  // Step 3: respect --limit.
  const queue = remaining.slice(0, LIMIT === Infinity ? remaining.length : LIMIT);
  console.log(`[seed-from-bom] processing ${queue.length} films`);

  if (DRY_RUN) {
    console.log("[seed-from-bom] DRY-RUN sample (first 20):");
    queue.slice(0, 20).forEach((c, i) => {
      console.log(`  ${i + 1}. ${c.title} (${c.release_year ?? "?"}) [tmdb=${c.tmdb_id ?? "?"}]`);
    });
    console.log("[seed-from-bom] DRY-RUN — no API calls, no writes. Exiting.");
    return;
  }

  // Step 4: run with concurrency. Progress every 25 results.
  const startTime = Date.now();
  let count = 0;
  await runWithConcurrency(queue, state, (c, r) => {
    count++;
    if (count % 25 === 0 || !r.ok) {
      const elapsed = Date.now() - startTime;
      const rate = count / (elapsed / 1000);
      const remainingCt = queue.length - count;
      const etaSec = remainingCt / Math.max(rate, 0.001);
      const etaH = Math.floor(etaSec / 3600);
      const etaM = Math.floor((etaSec % 3600) / 60);
      const tag = r.ok ? "✓" : `✗ ${r.reason}`;
      console.log(
        `[seed-from-bom] ${count}/${queue.length} ${tag} "${c.title}" | ` +
        `added=${state.totalAdded} cost~$${state.estCostUsd.toFixed(2)} ` +
        `rate=${rate.toFixed(2)}/s ETA=${etaH}h${etaM}m`,
      );
      saveState(state);
    }
  });

  saveState(state);
  const elapsedH = ((Date.now() - startTime) / 3600000).toFixed(2);
  console.log(
    `\n[seed-from-bom] DONE in ${elapsedH}h. ` +
    `added=${state.totalAdded}, cost~$${state.estCostUsd.toFixed(2)}, ` +
    `failures=${queue.length - state.totalAdded}`,
  );
}

main().catch((err) => {
  console.error("[seed-from-bom] fatal:", err);
  process.exit(1);
});
