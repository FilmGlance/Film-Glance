// scripts/tmdb-popularity-deep.ts
//
// Cache-growth Phase C-4. Extends Phase B (bulk-seed.ts) with the next
// two vote_count tiers TMDB Discover can serve — 100 and 50 — sorted by
// popularity.desc instead of vote_count.desc. The two changes work
// together: at vote_count >= 50 there are too many films to page through
// exhaustively, so popularity.desc surfaces the ones most likely to pass
// the >=5-sources data-quality gate (and most worth the per-film spend).
//
// Phase B used [10000, 5000, 2000, 1000, 500, 200] sorted by
// vote_count.desc and exhausted that grid (~8,400 net new films, hard
// ceiling). This script picks up at the next layer down.
//
// Run on VPS (after BOM-deep seed-from-bom.ts completes — don't run in
// parallel; both share Anthropic tier-1 quota at concurrency=5):
//   cd ~/film-glance-bulk-seed
//   git pull origin staging
//   nohup npx tsx scripts/tmdb-popularity-deep.ts > ~/tmdb-pop-deep.log 2>&1 &
//   tail -f ~/tmdb-pop-deep.log
//
// Optional flags:
//   --dry-run           // print bucket previews, no API calls
//   --limit=N           // stop after N films added
//
// Required env (loaded from .env.local at project root):
//   ANTHROPIC_API_KEY, TMDB_API_KEY, RAPIDAPI_KEY, OMDB_API_KEY,
//   SIMKL_CLIENT_ID, TRAKT_CLIENT_ID,
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// State: ~/.tmdb-popularity-deep-state.json (resumable)
// Failures: ~/.tmdb-popularity-deep-failures.log (non-fatal)

import { readFileSync, writeFileSync, existsSync } from "node:fs";
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
const TMDB_PAGE_DELAY_MS = 250;   // 4 req/s (TMDB allows 40/10s burst)
const MAX_PAGES_PER_BUCKET = 50;  // TMDB caps at 500 but yields drop sharply after ~50
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_KEY = process.env.TMDB_API_KEY!;
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const STATE_PATH = join(homedir(), ".tmdb-popularity-deep-state.json");
const FAILURE_LOG = join(homedir(), ".tmdb-popularity-deep-failures.log");

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

interface State {
  processedTmdbIds: number[];
  bucketIdx: number;
  pageIdx: number;
  totalAdded: number;
  estCostUsd: number;
}

function loadState(): State {
  if (existsSync(STATE_PATH)) {
    try {
      return JSON.parse(readFileSync(STATE_PATH, "utf8"));
    } catch { /* fallthrough */ }
  }
  return { processedTmdbIds: [], bucketIdx: 0, pageIdx: 1, totalAdded: 0, estCostUsd: 0 };
}

function saveState(s: State): void {
  writeFileSync(STATE_PATH, JSON.stringify(s, null, 2));
}

function logFailure(line: string): void {
  writeFileSync(FAILURE_LOG, line + "\n", { flag: "a" });
}

// ─── Stratification grid ───────────────────────────────────────────────
//
// Two new vote_count tiers below Phase B's floor of 200, paired with the
// same 9 year-ranges Phase B used so the grid stays consistent. 18 total
// buckets. popularity.desc sort surfaces the films most likely to have
// rich enough metadata to pass the ≥5-sources gate.
const VOTE_BUCKETS = [100, 50];
const YEAR_RANGES: Array<[number, number]> = [
  [2020, 2026], [2010, 2019], [2000, 2009],
  [1990, 1999], [1980, 1989], [1970, 1979],
  [1960, 1969], [1940, 1959], [1888, 1939],
];
const STRAT_GRID: Array<{ minVotes: number; startYear: number; endYear: number }> = [];
for (const v of VOTE_BUCKETS) {
  for (const [s, e] of YEAR_RANGES) {
    STRAT_GRID.push({ minVotes: v, startYear: s, endYear: e });
  }
}

// ─── Supabase service-role helpers ──────────────────────────────────────
async function sbGet<T = unknown>(path: string): Promise<T> {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
  });
  if (!r.ok) throw new Error(`Supabase GET ${path} → ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (await r.json()) as T;
}

async function loadExistingTmdbIds(): Promise<Set<number>> {
  const ids = new Set<number>();
  const PAGE = 1000;
  let offset = 0;
  while (true) {
    const rows = await sbGet<Array<{ tmdb_id: number | null }>>(
      `movie_cache?tmdb_id=not.is.null&select=tmdb_id&limit=${PAGE}&offset=${offset}`
    );
    for (const r of rows) if (r.tmdb_id != null) ids.add(r.tmdb_id);
    if (rows.length < PAGE) break;
    offset += PAGE;
  }
  return ids;
}

async function loadCacheCount(): Promise<number> {
  const r = await fetch(`${SB_URL}/rest/v1/movie_cache?select=search_key&limit=1`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, Prefer: "count=exact" },
  });
  const range = r.headers.get("content-range") ?? "";
  const m = range.match(/\/(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}

// ─── TMDB Discover ──────────────────────────────────────────────────────
interface DiscoverHit {
  id: number;
  title: string;
  year: number | null;
  vote_count: number;
  popularity: number;
}

async function tmdbDiscoverPage(
  bucket: { minVotes: number; startYear: number; endYear: number },
  page: number,
): Promise<DiscoverHit[]> {
  const params = new URLSearchParams({
    api_key: TMDB_KEY,
    sort_by: "popularity.desc",
    "vote_count.gte": String(bucket.minVotes),
    "primary_release_date.gte": `${bucket.startYear}-01-01`,
    "primary_release_date.lte": `${bucket.endYear}-12-31`,
    include_adult: "false",
    language: "en-US",
    page: String(page),
  });
  const r = await fetch(`${TMDB_BASE}/discover/movie?${params}`, { signal: AbortSignal.timeout(10000) });
  if (!r.ok) return [];
  const d = (await r.json()) as { results?: Array<{ id: number; title: string; release_date?: string; vote_count: number; popularity?: number }> };
  return (d.results ?? []).map((m) => ({
    id: m.id,
    title: m.title,
    year: m.release_date ? parseInt(m.release_date.substring(0, 4), 10) : null,
    vote_count: m.vote_count ?? 0,
    popularity: m.popularity ?? 0,
  }));
}

// ─── Per-candidate worker ──────────────────────────────────────────────
async function processCandidate(c: DiscoverHit): Promise<{ ok: boolean; cost: number; reason?: string }> {
  const queryForClaude = c.year ? `${c.title} ${c.year}` : c.title;
  const queryForRatings = c.title;
  try {
    if (DRY_RUN) {
      return { ok: true, cost: 0, reason: "dry-run" };
    }
    // Pass tmdb_id-based releaseInfo so the pipeline can skip TMDB title-
    // search entirely. Mirrors the d16ce8f fix in seed-from-bom.ts that
    // lifted success rate from ~5% to ~70% for niche-titled films. Phase B
    // didn't need this (its films had enough votes that title search worked
    // fine); at vote_count >= 50, generic-titled films become common and
    // the ID-based bypass matters.
    const releaseInfo = {
      tmdbId: c.id,
      officialTitle: c.title,
      releaseDate: c.year ? `${c.year}-01-01` : null,
      overview: "",
      posterPath: null,
    };
    const mv = await runFullPipeline(queryForClaude, queryForRatings, c.year ?? undefined, releaseInfo);
    // Per the seed-from-bom learning (94e38f9): do NOT reject on Claude
    // not_a_movie. TMDB Discover surfacing it = it's a real film. Claude's
    // training cutoff (Jan 2026) misses recent niche releases that TMDB
    // has cataloged.
    if (!mv || !mv.title) {
      return { ok: false, cost: 0.005, reason: "no title from pipeline" };
    }
    if (!Array.isArray(mv.sources) || mv.sources.length < 5) {
      return { ok: false, cost: 0.012, reason: `low source_count=${mv.sources?.length ?? 0}` };
    }
    if (mv.error === "not_a_movie") delete mv.error;
    if (typeof mv.tmdb_id !== "number") mv.tmdb_id = c.id;
    const normalize = (s: string) => s.toLowerCase().trim()
      .replace(/^(the|a|an)\s+/i, "")
      .replace(/[''`:;!?.,"()]/g, "").replace(/\s+/g, " ").trim();
    const searchKey = normalize(mv.title);
    await writeCacheEntries(searchKey, mv.title, mv.title, mv, null, "127.0.0.1", "tmdb-popularity-deep");
    return { ok: true, cost: 0.014 };
  } catch (e) {
    return { ok: false, cost: 0, reason: `exception: ${(e as Error).message}` };
  }
}

// ─── Concurrency-limited orchestrator ───────────────────────────────────
async function processBatchConcurrent(candidates: DiscoverHit[]): Promise<{ added: number; cost: number; failures: number }> {
  let added = 0;
  let cost = 0;
  let failures = 0;
  let idx = 0;

  async function worker(): Promise<void> {
    while (idx < candidates.length) {
      const i = idx++;
      const c = candidates[i];
      const res = await processCandidate(c);
      cost += res.cost;
      if (res.ok) added++;
      else {
        failures++;
        logFailure(`${new Date().toISOString()}\ttmdb_id=${c.id}\t${c.title} (${c.year ?? "?"})\t${res.reason ?? "?"}`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  return { added, cost, failures };
}

// ─── Main ──────────────────────────────────────────────────────────────
async function main() {
  console.log(`[tmdb-pop-deep] DRY_RUN=${DRY_RUN} LIMIT=${LIMIT === Infinity ? "∞" : LIMIT} CONCURRENCY=${CONCURRENCY}`);
  console.log(`[tmdb-pop-deep] grid: ${VOTE_BUCKETS.length} vote tiers × ${YEAR_RANGES.length} year ranges = ${STRAT_GRID.length} buckets`);

  const pipeline = await import("../lib/search-pipeline.js");
  runFullPipeline = pipeline.runFullPipeline;
  writeCacheEntries = pipeline.writeCacheEntries;

  console.log("[tmdb-pop-deep] loading existing tmdb_ids from cache…");
  const seen = await loadExistingTmdbIds();
  const startCount = await loadCacheCount();
  console.log(`[tmdb-pop-deep] cache size: ${startCount}, tmdb_ids known: ${seen.size}`);

  const state = loadState();
  state.processedTmdbIds.forEach((id) => seen.add(id));
  console.log(`[tmdb-pop-deep] resume from bucket=${state.bucketIdx} page=${state.pageIdx} totalAdded=${state.totalAdded}`);

  const startTime = Date.now();
  let processed = 0;

  for (let bIdx = state.bucketIdx; bIdx < STRAT_GRID.length; bIdx++) {
    const bucket = STRAT_GRID[bIdx];
    const startPage = bIdx === state.bucketIdx ? state.pageIdx : 1;
    console.log(`\n[tmdb-pop-deep] bucket ${bIdx + 1}/${STRAT_GRID.length}: votes>=${bucket.minVotes} years ${bucket.startYear}-${bucket.endYear}`);

    let consecutiveEmptyPages = 0;
    for (let page = startPage; page <= MAX_PAGES_PER_BUCKET; page++) {
      const hits = await tmdbDiscoverPage(bucket, page);
      if (hits.length === 0) break;
      const fresh = hits.filter((h) => !seen.has(h.id));
      if (fresh.length === 0) {
        consecutiveEmptyPages++;
        // After 3 consecutive all-cached pages, advance to next bucket.
        // The tail of this bucket is overlapping with what we already have.
        if (consecutiveEmptyPages >= 3) {
          console.log(`[tmdb-pop-deep] bucket ${bIdx + 1} page ${page}: 3 consecutive all-cached pages, advancing.`);
          break;
        }
        await sleep(TMDB_PAGE_DELAY_MS);
        continue;
      }
      consecutiveEmptyPages = 0;

      if (DRY_RUN) {
        console.log(`[tmdb-pop-deep] bucket ${bIdx + 1} page ${page}: ${fresh.length} fresh (sample: ${fresh.slice(0, 5).map(h => `${h.title} ${h.year ?? "?"}`).join(", ")})`);
      }

      const { added, cost, failures } = await processBatchConcurrent(fresh);
      for (const h of fresh) seen.add(h.id);
      state.processedTmdbIds = [...seen];
      state.bucketIdx = bIdx;
      state.pageIdx = page + 1;
      state.totalAdded += added;
      state.estCostUsd += cost;
      saveState(state);

      processed += fresh.length;
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const rate = processed / Math.max(1, elapsed);
      console.log(`[tmdb-pop-deep] bucket ${bIdx + 1} page ${page}: +${added}/-${failures} (run-total +${state.totalAdded}, ~$${state.estCostUsd.toFixed(2)}, ${rate.toFixed(1)}/s, elapsed ${Math.floor(elapsed/3600)}h${Math.floor((elapsed%3600)/60)}m)`);

      if (state.totalAdded >= LIMIT) {
        console.log(`[tmdb-pop-deep] hit --limit=${LIMIT}, stopping.`);
        return;
      }
      await sleep(TMDB_PAGE_DELAY_MS);
    }
    state.pageIdx = 1;
    saveState(state);
  }

  console.log(`\n[tmdb-pop-deep] DONE. added=${state.totalAdded}, cost~$${state.estCostUsd.toFixed(2)}, final cache size ~${startCount + state.totalAdded}`);
}

main().catch((err) => {
  console.error("\n[tmdb-pop-deep] FATAL:", err);
  process.exit(1);
});
