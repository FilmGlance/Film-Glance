// scripts/genre-decade-fill.ts
//
// Cache-growth Phase C-5. Iterates the cartesian product of TMDB's 19
// official movie genres × 9 decade ranges (171 cells), querying each
// with vote_count >= 30 sorted by popularity.desc and hard-deduping
// against the current cache. Cells already well-covered yield few new
// films (and skip after 3 consecutive all-cached pages); thin cells —
// older horror, foreign-language drama, niche genre × decade combos —
// yield the most.
//
// Run on VPS (after tmdb-popularity-deep.ts completes — they share
// Anthropic tier-1 quota at concurrency=5 so don't run in parallel):
//   cd ~/film-glance-bulk-seed
//   git pull origin staging
//   nohup npx tsx scripts/genre-decade-fill.ts > ~/genre-decade-fill.log 2>&1 &
//   tail -f ~/genre-decade-fill.log
//
// Optional flags:
//   --dry-run                  // print cell previews, no API calls
//   --limit=N                  // stop after N films added
//   --min-cell-size=N          // pre-flight: estimate per-cell cache fill
//                                 and process cells with <N rows first.
//                                 Default 0 (no pre-flight; process in
//                                 declared genre × decade order). Set 100
//                                 to bias toward thin cells.
//
// Required env (loaded from .env.local at project root):
//   ANTHROPIC_API_KEY, TMDB_API_KEY, RAPIDAPI_KEY, OMDB_API_KEY,
//   SIMKL_CLIENT_ID, TRAKT_CLIENT_ID,
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// State: ~/.genre-decade-fill-state.json (resumable)
// Failures: ~/.genre-decade-fill-failures.log (non-fatal)

import { readFileSync, writeFileSync, existsSync } from "node:fs";
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
  "ANTHROPIC_API_KEY", "TMDB_API_KEY", "RAPIDAPI_KEY",
  "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY",
];
for (const k of REQUIRED) {
  if (!process.env[k]) {
    console.error(`Missing required env var: ${k}`);
    process.exit(1);
  }
}

let runFullPipeline!: typeof import("../lib/search-pipeline.js")["runFullPipeline"];
let writeCacheEntries!: typeof import("../lib/search-pipeline.js")["writeCacheEntries"];

// ─── CLI flags ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const limitArg = args.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? parseInt(limitArg.split("=")[1], 10) : Infinity;
const minCellArg = args.find((a) => a.startsWith("--min-cell-size="));
const MIN_CELL_SIZE = minCellArg ? parseInt(minCellArg.split("=")[1], 10) : 0;

// ─── Tunables ──────────────────────────────────────────────────────────
const CONCURRENCY = 5;            // Anthropic tier-1 default cap
const TMDB_PAGE_DELAY_MS = 250;   // 4 req/s
const MAX_PAGES_PER_CELL = 30;    // genre × decade tail drops faster than year-only
const VOTE_FLOOR = 30;            // permissive — most films at vote_count 30+ pass ≥5-sources gate
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_KEY = process.env.TMDB_API_KEY!;
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const STATE_PATH = join(homedir(), ".genre-decade-fill-state.json");
const FAILURE_LOG = join(homedir(), ".genre-decade-fill-failures.log");

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

// ─── Genres × Decades grid ─────────────────────────────────────────────
//
// TMDB's 19 official movie genre IDs (stable since 2017 — safe to hard-
// code). Names match TMDB's canonical strings exactly, which matters
// because the optional pre-flight cell-size estimator does an ilike
// against `data->>genres` in cache rows (the pipeline writes TMDB's
// canonical names via fetchComingSoonDetails). E.g. "Science Fiction",
// not "Sci-Fi".
const GENRES: Array<{ id: number; name: string }> = [
  { id: 28, name: "Action" }, { id: 12, name: "Adventure" }, { id: 16, name: "Animation" },
  { id: 35, name: "Comedy" }, { id: 80, name: "Crime" }, { id: 99, name: "Documentary" },
  { id: 18, name: "Drama" }, { id: 10751, name: "Family" }, { id: 14, name: "Fantasy" },
  { id: 36, name: "History" }, { id: 27, name: "Horror" }, { id: 10402, name: "Music" },
  { id: 9648, name: "Mystery" }, { id: 10749, name: "Romance" }, { id: 878, name: "Science Fiction" },
  { id: 10770, name: "TV Movie" }, { id: 53, name: "Thriller" }, { id: 10752, name: "War" },
  { id: 37, name: "Western" },
];
// Same 9 decade buckets used by Phase B / tmdb-popularity-deep so the
// stratification stays consistent across cache-growth phases.
const DECADES: Array<[number, number]> = [
  [2020, 2026], [2010, 2019], [2000, 2009],
  [1990, 1999], [1980, 1989], [1970, 1979],
  [1960, 1969], [1940, 1959], [1888, 1939],
];

interface Cell {
  genreId: number;
  genreName: string;
  startYear: number;
  endYear: number;
  cachedCount?: number;
}

const CELLS: Cell[] = [];
for (const g of GENRES) {
  for (const [s, e] of DECADES) {
    CELLS.push({ genreId: g.id, genreName: g.name, startYear: s, endYear: e });
  }
}

// ─── State ─────────────────────────────────────────────────────────────
interface State {
  processedTmdbIds: number[];
  cellIdx: number;
  pageIdx: number;
  totalAdded: number;
  estCostUsd: number;
}

function loadState(): State {
  if (existsSync(STATE_PATH)) {
    try { return JSON.parse(readFileSync(STATE_PATH, "utf8")); }
    catch { /* fallthrough */ }
  }
  return { processedTmdbIds: [], cellIdx: 0, pageIdx: 1, totalAdded: 0, estCostUsd: 0 };
}

function saveState(s: State): void {
  writeFileSync(STATE_PATH, JSON.stringify(s, null, 2));
}

function logFailure(line: string): void {
  writeFileSync(FAILURE_LOG, line + "\n", { flag: "a" });
}

// ─── Supabase ─────────────────────────────────────────────────────────
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

// Optional pre-flight: estimate per-cell cache fill so we can prioritize
// thin cells. Filters cache rows whose data->>genres contains the genre
// name AND data->>year falls in the decade range. Approximate (cache
// stores genres as " · "-separated string, so substring match catches
// multi-genre rows correctly). Worst case if estimates are noisy: cells
// process in suboptimal order — the script still terminates correctly.
async function estimateCellSize(cell: Cell): Promise<number> {
  try {
    const params = new URLSearchParams({
      select: "data",
      "data->>genres": `ilike.*${cell.genreName}*`,
      limit: "1000",
    });
    const r = await fetch(`${SB_URL}/rest/v1/movie_cache?${params}`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
    });
    if (!r.ok) return 0;
    const rows = (await r.json()) as Array<{ data?: { year?: number | string } }>;
    let count = 0;
    for (const row of rows) {
      const y = parseInt(String(row.data?.year ?? ""), 10);
      if (Number.isFinite(y) && y >= cell.startYear && y <= cell.endYear) count++;
    }
    return count;
  } catch {
    return 0;
  }
}

// ─── TMDB Discover ──────────────────────────────────────────────────────
interface DiscoverHit {
  id: number;
  title: string;
  year: number | null;
  popularity: number;
}

async function tmdbDiscoverPage(cell: Cell, page: number): Promise<DiscoverHit[]> {
  const params = new URLSearchParams({
    api_key: TMDB_KEY,
    sort_by: "popularity.desc",
    "vote_count.gte": String(VOTE_FLOOR),
    with_genres: String(cell.genreId),
    "primary_release_date.gte": `${cell.startYear}-01-01`,
    "primary_release_date.lte": `${cell.endYear}-12-31`,
    include_adult: "false",
    language: "en-US",
    page: String(page),
  });
  const r = await fetch(`${TMDB_BASE}/discover/movie?${params}`, { signal: AbortSignal.timeout(10000) });
  if (!r.ok) return [];
  const d = (await r.json()) as { results?: Array<{ id: number; title: string; release_date?: string; popularity?: number }> };
  return (d.results ?? []).map((m) => ({
    id: m.id,
    title: m.title,
    year: m.release_date ? parseInt(m.release_date.substring(0, 4), 10) : null,
    popularity: m.popularity ?? 0,
  }));
}

// ─── Per-candidate worker (mirrors tmdb-popularity-deep) ───────────────
async function processCandidate(c: DiscoverHit): Promise<{ ok: boolean; cost: number; reason?: string }> {
  const queryForClaude = c.year ? `${c.title} ${c.year}` : c.title;
  const queryForRatings = c.title;
  try {
    if (DRY_RUN) return { ok: true, cost: 0, reason: "dry-run" };
    const releaseInfo = {
      tmdbId: c.id,
      officialTitle: c.title,
      releaseDate: c.year ? `${c.year}-01-01` : null,
      overview: "",
      posterPath: null,
    };
    const mv = await runFullPipeline(queryForClaude, queryForRatings, c.year ?? undefined, releaseInfo);
    if (!mv || !mv.title) return { ok: false, cost: 0.005, reason: "no title from pipeline" };
    if (!Array.isArray(mv.sources) || mv.sources.length < 5) {
      return { ok: false, cost: 0.012, reason: `low source_count=${mv.sources?.length ?? 0}` };
    }
    if (mv.error === "not_a_movie") delete mv.error;
    if (typeof mv.tmdb_id !== "number") mv.tmdb_id = c.id;
    const normalize = (s: string) => s.toLowerCase().trim()
      .replace(/^(the|a|an)\s+/i, "")
      .replace(/[''`:;!?.,"()]/g, "").replace(/\s+/g, " ").trim();
    const searchKey = normalize(mv.title);
    await writeCacheEntries(searchKey, mv.title, mv.title, mv, null, "127.0.0.1", "genre-decade-fill");
    return { ok: true, cost: 0.014 };
  } catch (e) {
    return { ok: false, cost: 0, reason: `exception: ${(e as Error).message}` };
  }
}

async function processBatchConcurrent(candidates: DiscoverHit[]): Promise<{ added: number; cost: number; failures: number }> {
  let added = 0; let cost = 0; let failures = 0; let idx = 0;
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
  console.log(`[gxd-fill] DRY_RUN=${DRY_RUN} LIMIT=${LIMIT === Infinity ? "∞" : LIMIT} MIN_CELL_SIZE=${MIN_CELL_SIZE} CONCURRENCY=${CONCURRENCY}`);
  console.log(`[gxd-fill] grid: ${GENRES.length} genres × ${DECADES.length} decades = ${CELLS.length} cells`);

  const pipeline = await import("../lib/search-pipeline.js");
  runFullPipeline = pipeline.runFullPipeline;
  writeCacheEntries = pipeline.writeCacheEntries;

  console.log("[gxd-fill] loading existing tmdb_ids from cache…");
  const seen = await loadExistingTmdbIds();
  const startCount = await loadCacheCount();
  console.log(`[gxd-fill] cache size: ${startCount}, tmdb_ids known: ${seen.size}`);

  // Optional pre-flight: measure per-cell fill so thin cells process first.
  if (MIN_CELL_SIZE > 0) {
    console.log(`[gxd-fill] estimating per-cell cache fill (${CELLS.length} lookups, ~30-90s)…`);
    let measured = 0;
    for (const c of CELLS) {
      c.cachedCount = await estimateCellSize(c);
      measured++;
      if (measured % 25 === 0) {
        console.log(`[gxd-fill]  ${measured}/${CELLS.length} cells measured`);
      }
    }
    // Sort: thin cells (<MIN_CELL_SIZE) first, then by descending start year
    // (newer films tend to have richer ratings coverage and pass the
    // ≥5-sources floor more often).
    CELLS.sort((a, b) => {
      const da = (a.cachedCount ?? 0) >= MIN_CELL_SIZE ? 1 : 0;
      const db = (b.cachedCount ?? 0) >= MIN_CELL_SIZE ? 1 : 0;
      if (da !== db) return da - db;
      return b.startYear - a.startYear;
    });
    const thin = CELLS.filter((c) => (c.cachedCount ?? 0) < MIN_CELL_SIZE).length;
    console.log(`[gxd-fill] thin cells (<${MIN_CELL_SIZE} rows): ${thin}/${CELLS.length}`);
  }

  const state = loadState();
  state.processedTmdbIds.forEach((id) => seen.add(id));
  console.log(`[gxd-fill] resume from cell=${state.cellIdx} page=${state.pageIdx} totalAdded=${state.totalAdded}`);

  const startTime = Date.now();
  let processed = 0;

  for (let cIdx = state.cellIdx; cIdx < CELLS.length; cIdx++) {
    const cell = CELLS[cIdx];
    const startPage = cIdx === state.cellIdx ? state.pageIdx : 1;
    const cellTag = `${cell.genreName}/${cell.startYear}-${cell.endYear}`;
    const fillTag = cell.cachedCount != null ? ` (cached~${cell.cachedCount})` : "";
    console.log(`\n[gxd-fill] cell ${cIdx + 1}/${CELLS.length}: ${cellTag}${fillTag}`);

    let consecutiveEmptyPages = 0;
    for (let page = startPage; page <= MAX_PAGES_PER_CELL; page++) {
      const hits = await tmdbDiscoverPage(cell, page);
      if (hits.length === 0) break;
      const fresh = hits.filter((h) => !seen.has(h.id));
      if (fresh.length === 0) {
        consecutiveEmptyPages++;
        if (consecutiveEmptyPages >= 3) {
          console.log(`[gxd-fill] cell ${cellTag} page ${page}: 3 consecutive all-cached pages, advancing.`);
          break;
        }
        await sleep(TMDB_PAGE_DELAY_MS);
        continue;
      }
      consecutiveEmptyPages = 0;

      if (DRY_RUN) {
        console.log(`[gxd-fill] cell ${cellTag} page ${page}: ${fresh.length} fresh (sample: ${fresh.slice(0, 5).map(h => `${h.title} ${h.year ?? "?"}`).join(", ")})`);
      }

      const { added, cost, failures } = await processBatchConcurrent(fresh);
      for (const h of fresh) seen.add(h.id);
      state.processedTmdbIds = [...seen];
      state.cellIdx = cIdx;
      state.pageIdx = page + 1;
      state.totalAdded += added;
      state.estCostUsd += cost;
      saveState(state);

      processed += fresh.length;
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const rate = processed / Math.max(1, elapsed);
      console.log(`[gxd-fill] cell ${cIdx + 1} ${cellTag} page ${page}: +${added}/-${failures} (run-total +${state.totalAdded}, ~$${state.estCostUsd.toFixed(2)}, ${rate.toFixed(1)}/s, elapsed ${Math.floor(elapsed/3600)}h${Math.floor((elapsed%3600)/60)}m)`);

      if (state.totalAdded >= LIMIT) {
        console.log(`[gxd-fill] hit --limit=${LIMIT}, stopping.`);
        return;
      }
      await sleep(TMDB_PAGE_DELAY_MS);
    }
    state.pageIdx = 1;
    saveState(state);
  }

  console.log(`\n[gxd-fill] DONE. added=${state.totalAdded}, cost~$${state.estCostUsd.toFixed(2)}, final cache size ~${startCount + state.totalAdded}`);
}

main().catch((err) => {
  console.error("\n[gxd-fill] FATAL:", err);
  process.exit(1);
});
