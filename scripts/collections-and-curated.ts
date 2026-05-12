// scripts/collections-and-curated.ts
//
// Cache-growth Phase C-6. Final headroom layer designed to definitively
// clear the 30k cache target if C-3+C-4+C-5 land short. Three TMDB-native
// source pools, all FREE TMDB API calls (Anthropic + ratings APIs only
// fire on candidates that survive dedup, so cost stays low):
//
//   1. /movie/top_rated paginated         — TMDB's globally top-rated films
//   2. /movie/popular paginated           — TMDB's globally most-popular films
//   3. /discover/movie?with_companies=N   — major studios (Pixar, Ghibli,
//                                            Marvel Studios, Lucasfilm, DC,
//                                            Walt Disney Pictures, Warner Bros)
//   4. /collection/{id} for a curated set — major franchises with multiple
//                                            films likely to have tail entries
//                                            missing from cache
//
// Estimated +1,500-3,500 net adds / ~$20-50 / ~1h. Heavy overlap with
// C-3/C-4/C-5 expected — the 5-consecutive-all-cached-pages early-exit
// will trigger quickly on top_rated/popular tails. The collections + minor
// company filmographies have low absolute counts (most franchises ≤ 30
// films) so they finish fast.
//
// Run on VPS (after C-4 + C-5 complete; do not run in parallel — shares
// Anthropic tier-1 quota at concurrency=5):
//   cd ~/film-glance-bulk-seed
//   git pull origin staging
//   nohup npx tsx scripts/collections-and-curated.ts > ~/c6.log 2>&1 &
//   tail -f ~/c6.log
//
// Optional flags:
//   --dry-run            // print source/page previews, no API calls
//   --limit=N            // stop after N films added (use with --dry-run)
//
// Required env (loaded from .env.local at project root):
//   ANTHROPIC_API_KEY, TMDB_API_KEY, RAPIDAPI_KEY, OMDB_API_KEY,
//   SIMKL_CLIENT_ID, TRAKT_CLIENT_ID,
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// State: ~/.collections-and-curated-state.json (resumable; tracks
//        sourceIdx + pageIdx so a kill-and-restart picks up mid-source)
// Failures: ~/.collections-and-curated-failures.log (non-fatal)

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

// ─── Tunables ──────────────────────────────────────────────────────────
const CONCURRENCY = 5;
const TMDB_PAGE_DELAY_MS = 250;
const MAX_PAGES_PER_SOURCE = 500;
const EARLY_EXIT_AFTER_N_EMPTY_PAGES = 5;
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_KEY = process.env.TMDB_API_KEY!;
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const STATE_PATH = join(homedir(), ".collections-and-curated-state.json");
const FAILURE_LOG = join(homedir(), ".collections-and-curated-failures.log");

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

// ─── Source registry ──────────────────────────────────────────────────
//
// Major production company IDs (verified against TMDB's stable internal
// IDs). Each yields the company's filmography via Discover, sorted by
// popularity.desc.
const COMPANY_IDS: Array<{ id: number; name: string }> = [
  { id: 3,     name: "Pixar" },
  { id: 10342, name: "Studio Ghibli" },
  { id: 420,   name: "Marvel Studios" },
  { id: 1,     name: "Lucasfilm" },
  { id: 9993,  name: "DC Entertainment" },
  { id: 2,     name: "Walt Disney Pictures" },
  { id: 174,   name: "Warner Bros." },
  { id: 33,    name: "Universal Pictures" },
  { id: 4,     name: "Paramount" },
  { id: 25,    name: "20th Century Fox" },
  { id: 5,     name: "Columbia Pictures" },
  { id: 7,     name: "DreamWorks Animation" },
  { id: 21,    name: "Metro-Goldwyn-Mayer" },
  { id: 41,    name: "A24" },
  { id: 491,   name: "Working Title Films" },
  { id: 6125,  name: "Focus Features" },
  { id: 1632,  name: "Lionsgate" },
];

// Curated franchise collection IDs. These are TMDB's stable collection
// IDs for major multi-film franchises — the long-tail entries (Halloween
// 12, Land Before Time XIII, Bond #18) are exactly the films most likely
// to have escaped Phase B/C-3/C-4/C-5. ~30 collections × ~10 films avg =
// ~300 candidates, with most already cached.
const COLLECTION_IDS: Array<{ id: number; name: string }> = [
  { id: 10,     name: "Star Wars" },
  { id: 86311,  name: "The Avengers" },
  { id: 263,    name: "The Dark Knight" },
  { id: 645,    name: "James Bond" },
  { id: 119,    name: "The Lord of the Rings" },
  { id: 121938, name: "The Hobbit" },
  { id: 1241,   name: "Harry Potter" },
  { id: 87359,  name: "Mission: Impossible" },
  { id: 9485,   name: "The Fast and the Furious" },
  { id: 31562,  name: "The Bourne" },
  { id: 528,    name: "The Terminator" },
  { id: 1228,   name: "Indiana Jones" },
  { id: 328,    name: "Jurassic Park" },
  { id: 87096,  name: "Avatar" },
  { id: 295,    name: "Pirates of the Caribbean" },
  { id: 748,    name: "X-Men" },
  { id: 8917,   name: "Toy Story" },
  { id: 1565,   name: "Die Hard" },
  { id: 8945,   name: "Mad Max" },
  { id: 1733,   name: "The Mummy" },
  { id: 1241,   name: "Harry Potter (dup-safe)" },  // dedup catches this anyway
  { id: 1709,   name: "Beverly Hills Cop" },
  { id: 2980,   name: "Ghostbusters" },
  { id: 9744,   name: "Halloween" },
  { id: 1731,   name: "Rocky" },
  { id: 9292,   name: "Rambo" },
  { id: 304,    name: "Ocean's" },
  { id: 433,    name: "Predator" },
  { id: 230,    name: "The Godfather" },
  { id: 8650,   name: "Transformers" },
];

interface DiscoverHit {
  id: number;
  title: string;
  year: number | null;
  popularity?: number;
}

// Each source is a function that fetches one page (1-indexed) and returns
// a DiscoverHit[]. An empty array signals end-of-source.
interface Source {
  name: string;
  fetchPage: (page: number) => Promise<DiscoverHit[]>;
  // Some sources (collections) are flat — a single "page 1" returns all
  // members in one shot. Set true to short-circuit pagination.
  singlePage?: boolean;
}

const SOURCES: Source[] = [
  { name: "top_rated", fetchPage: (p) => tmdbListPage("/movie/top_rated", p) },
  { name: "popular",   fetchPage: (p) => tmdbListPage("/movie/popular", p) },
  ...COMPANY_IDS.map((c) => ({
    name: `company:${c.name}`,
    fetchPage: (p: number) => tmdbCompanyPage(c.id, p),
  })),
  ...COLLECTION_IDS.map((c) => ({
    name: `collection:${c.name}`,
    fetchPage: (_p: number) => tmdbCollectionMembers(c.id),
    singlePage: true,
  })),
];

// ─── State ─────────────────────────────────────────────────────────────
interface State {
  processedTmdbIds: number[];
  sourceIdx: number;
  pageIdx: number;
  totalAdded: number;
  estCostUsd: number;
}

function loadState(): State {
  if (existsSync(STATE_PATH)) {
    try { return JSON.parse(readFileSync(STATE_PATH, "utf8")); }
    catch { /* fallthrough */ }
  }
  return { processedTmdbIds: [], sourceIdx: 0, pageIdx: 1, totalAdded: 0, estCostUsd: 0 };
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

// ─── TMDB fetchers ─────────────────────────────────────────────────────

// Generic /movie/top_rated and /movie/popular handler — same response
// shape (paginated with `results: [{id, title, release_date, ...}]`).
async function tmdbListPage(endpoint: string, page: number): Promise<DiscoverHit[]> {
  const params = new URLSearchParams({
    api_key: TMDB_KEY,
    language: "en-US",
    page: String(page),
  });
  const r = await fetch(`${TMDB_BASE}${endpoint}?${params}`, { signal: AbortSignal.timeout(10000) });
  if (!r.ok) return [];
  const d = (await r.json()) as { results?: Array<{ id: number; title: string; release_date?: string; popularity?: number }> };
  return (d.results ?? []).map((m) => ({
    id: m.id,
    title: m.title,
    year: m.release_date ? parseInt(m.release_date.substring(0, 4), 10) : null,
    popularity: m.popularity ?? 0,
  }));
}

// Company filmography via Discover. include_adult=false for consistency
// with the rest of the cache; sort by popularity.desc to surface the most
// representative entries first.
async function tmdbCompanyPage(companyId: number, page: number): Promise<DiscoverHit[]> {
  const params = new URLSearchParams({
    api_key: TMDB_KEY,
    sort_by: "popularity.desc",
    with_companies: String(companyId),
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

// Collection endpoint returns `parts: [...]` — the full member list in
// one response. No pagination; the source iterator's singlePage flag
// short-circuits after a single fetchPage call.
async function tmdbCollectionMembers(collectionId: number): Promise<DiscoverHit[]> {
  const params = new URLSearchParams({
    api_key: TMDB_KEY,
    language: "en-US",
  });
  const r = await fetch(`${TMDB_BASE}/collection/${collectionId}?${params}`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) return [];
  const d = (await r.json()) as { parts?: Array<{ id: number; title: string; release_date?: string }> };
  return (d.parts ?? []).map((m) => ({
    id: m.id,
    title: m.title,
    year: m.release_date ? parseInt(m.release_date.substring(0, 4), 10) : null,
  }));
}

// ─── Per-candidate worker (mirrors C-4/C-5) ────────────────────────────
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
    await writeCacheEntries(searchKey, mv.title, mv.title, mv, null, "127.0.0.1", "collections-and-curated");
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

// ─── Source iterator ────────────────────────────────────────────────────
// Returns { stopRequested: true } when LIMIT is hit so main() can exit
// the entire source loop, not just the current source.
async function iterateSource(
  source: Source,
  sourceIdx: number,
  state: State,
  seen: Set<number>,
  startPage: number,
  startTime: number,
): Promise<{ stopRequested: boolean }> {
  let consecutiveEmptyPages = 0;
  const maxPages = source.singlePage ? 1 : MAX_PAGES_PER_SOURCE;

  for (let page = startPage; page <= maxPages; page++) {
    const hits = await source.fetchPage(page);
    if (hits.length === 0) {
      if (source.singlePage) break;
      // Pagination exhausted — TMDB returns empty results past total_pages.
      break;
    }
    const fresh = hits.filter((h) => !seen.has(h.id));
    if (fresh.length === 0) {
      consecutiveEmptyPages++;
      if (source.singlePage || consecutiveEmptyPages >= EARLY_EXIT_AFTER_N_EMPTY_PAGES) {
        if (!source.singlePage) {
          console.log(`[c6] ${source.name} page ${page}: ${EARLY_EXIT_AFTER_N_EMPTY_PAGES} consecutive all-cached pages, advancing source.`);
        }
        break;
      }
      await sleep(TMDB_PAGE_DELAY_MS);
      continue;
    }
    consecutiveEmptyPages = 0;

    if (DRY_RUN) {
      console.log(`[c6] ${source.name} page ${page}: ${fresh.length} fresh (sample: ${fresh.slice(0, 3).map(h => `${h.title} ${h.year ?? "?"}`).join(", ")})`);
    }

    const { added, cost, failures } = await processBatchConcurrent(fresh);
    for (const h of fresh) seen.add(h.id);
    state.processedTmdbIds = [...seen];
    state.sourceIdx = sourceIdx;
    state.pageIdx = page + 1;
    state.totalAdded += added;
    state.estCostUsd += cost;
    saveState(state);

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`[c6] ${source.name} page ${page}: +${added}/-${failures} (run-total +${state.totalAdded}, ~$${state.estCostUsd.toFixed(2)}, elapsed ${Math.floor(elapsed/3600)}h${Math.floor((elapsed%3600)/60)}m)`);

    if (state.totalAdded >= LIMIT) {
      console.log(`[c6] hit --limit=${LIMIT}, stopping.`);
      return { stopRequested: true };
    }
    await sleep(TMDB_PAGE_DELAY_MS);
  }
  return { stopRequested: false };
}

// ─── Main ──────────────────────────────────────────────────────────────
async function main() {
  console.log(`[c6] DRY_RUN=${DRY_RUN} LIMIT=${LIMIT === Infinity ? "∞" : LIMIT} CONCURRENCY=${CONCURRENCY}`);
  console.log(`[c6] sources: ${SOURCES.length} (2 lists + ${COMPANY_IDS.length} companies + ${COLLECTION_IDS.length} collections)`);

  const pipeline = await import("../lib/search-pipeline.js");
  runFullPipeline = pipeline.runFullPipeline;
  writeCacheEntries = pipeline.writeCacheEntries;

  console.log("[c6] loading existing tmdb_ids from cache…");
  const seen = await loadExistingTmdbIds();
  const startCount = await loadCacheCount();
  console.log(`[c6] cache size: ${startCount}, tmdb_ids known: ${seen.size}`);

  const state = loadState();
  state.processedTmdbIds.forEach((id) => seen.add(id));
  console.log(`[c6] resume from source=${state.sourceIdx} page=${state.pageIdx} totalAdded=${state.totalAdded}`);

  const startTime = Date.now();

  for (let sIdx = state.sourceIdx; sIdx < SOURCES.length; sIdx++) {
    const source = SOURCES[sIdx];
    const startPage = sIdx === state.sourceIdx ? state.pageIdx : 1;
    console.log(`\n[c6] source ${sIdx + 1}/${SOURCES.length}: ${source.name}`);

    const result = await iterateSource(source, sIdx, state, seen, startPage, startTime);
    if (result.stopRequested) break;

    state.sourceIdx = sIdx + 1;
    state.pageIdx = 1;
    saveState(state);
  }

  console.log(`\n[c6] DONE. added=${state.totalAdded}, cost~$${state.estCostUsd.toFixed(2)}, final cache size ~${startCount + state.totalAdded}`);
}

main().catch((err) => {
  console.error("\n[c6] FATAL:", err);
  process.exit(1);
});
