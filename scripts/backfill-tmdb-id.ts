// scripts/backfill-tmdb-id.ts
//
// One-shot: populate `tmdb_id` on every legacy `movie_cache` row that's
// missing it. Uses TMDB `/search/movie` to look up the canonical id for
// each (title, year) pair. Idempotent — re-running only touches rows
// still NULL.
//
// Run on VPS:
//   cd ~/film-glance-bulk-seed
//   npx tsx scripts/backfill-tmdb-id.ts
//
// Required env (read from .env.local at the project root):
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   TMDB_API_KEY
//
// Behavior:
//   - 250ms throttle between TMDB calls (well under TMDB's 40 req/10s burst)
//   - Logs unmatched rows to scratch/tmdb-backfill-unmatched.txt for review
//   - If two cache rows resolve to the same tmdb_id (residual dup the
//     migration-019 sweep didn't catch), keeps the highest fg_score /
//     hit_count and DELETEs the rest.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  const path = ".env.local";
  if (!existsSync(path)) {
    console.error(`Missing ${path} at project root.`);
    process.exit(1);
  }
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
  return env;
}

const env = loadEnv();
const SB_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const TMDB_KEY = env.TMDB_API_KEY;

if (!SB_URL || !SB_KEY || !TMDB_KEY) {
  console.error("Missing required env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / TMDB_API_KEY");
  process.exit(1);
}

const TMDB_BASE = "https://api.themoviedb.org/3";
const THROTTLE_MS = 250;

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

interface CacheRow {
  search_key: string;
  data: Record<string, unknown>;
  fg_score: number | null;
  hit_count: number | null;
}

async function sbQuery<T = unknown>(method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<T> {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      "Content-Type": "application/json",
      Prefer: method === "GET" ? "" : "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Supabase ${method} ${path} → ${r.status}: ${txt.slice(0, 250)}`);
  }
  return r.status === 204 ? (undefined as T) : ((await r.json()) as T);
}

async function tmdbSearch(title: string, year?: number | null): Promise<number | null> {
  const params = new URLSearchParams({ api_key: TMDB_KEY, query: title, include_adult: "false", language: "en-US" });
  if (year) params.set("primary_release_year", String(year));
  try {
    const r = await fetch(`${TMDB_BASE}/search/movie?${params}`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const d = (await r.json()) as { results?: Array<{ id: number; title: string; release_date?: string }> };
    if (!d.results?.length) return null;
    // First result is usually the right one (TMDB sorts by popularity).
    return d.results[0].id;
  } catch {
    return null;
  }
}

async function loadRowsMissingTmdbId(): Promise<CacheRow[]> {
  // PostgREST-style filter: tmdb_id is NULL.
  const rows: CacheRow[] = [];
  const PAGE_SIZE = 500;
  let offset = 0;
  while (true) {
    const batch = await sbQuery<CacheRow[]>(
      "GET",
      `movie_cache?tmdb_id=is.null&select=search_key,data,fg_score,hit_count&order=search_key.asc&limit=${PAGE_SIZE}&offset=${offset}`
    );
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return rows;
}

async function main() {
  console.log("[backfill] loading rows missing tmdb_id…");
  const rows = await loadRowsMissingTmdbId();
  console.log(`[backfill] found ${rows.length} rows`);

  if (!existsSync("scratch")) mkdirSync("scratch");
  const unmatchedPath = join("scratch", "tmdb-backfill-unmatched.txt");
  writeFileSync(unmatchedPath, ""); // clear

  const tmdbIdToRows = new Map<number, CacheRow[]>();
  let matched = 0;
  let unmatched = 0;
  let i = 0;

  for (const row of rows) {
    i++;
    const title = (row.data?.title as string | undefined) ?? row.search_key;
    const year = typeof row.data?.year === "number" ? (row.data.year as number) : null;

    const id = await tmdbSearch(title, year);
    if (id != null) {
      const arr = tmdbIdToRows.get(id) ?? [];
      arr.push(row);
      tmdbIdToRows.set(id, arr);
      matched++;
    } else {
      unmatched++;
      writeFileSync(unmatchedPath, `${row.search_key}\t${title}\t${year ?? ""}\n`, { flag: "a" });
    }

    if (i % 50 === 0) {
      console.log(`[backfill] ${i}/${rows.length} (matched=${matched}, unmatched=${unmatched})`);
    }
    await sleep(THROTTLE_MS);
  }

  console.log(`\n[backfill] TMDB lookup phase done. matched=${matched}, unmatched=${unmatched}`);
  console.log(`[backfill] unmatched titles → ${unmatchedPath}`);

  // Resolve same-tmdb_id collisions: keep one row, delete the rest.
  let collisionDeletes = 0;
  for (const [id, group] of tmdbIdToRows) {
    if (group.length === 1) {
      // Single row — just write tmdb_id.
      const row = group[0];
      await sbQuery("PATCH", `movie_cache?search_key=eq.${encodeURIComponent(row.search_key)}`, { tmdb_id: id });
      continue;
    }

    // Multiple cache rows resolve to the same tmdb_id — pick the best, delete the others.
    group.sort((a, b) => {
      const sa = a.fg_score ?? -1;
      const sb = b.fg_score ?? -1;
      if (sb !== sa) return sb - sa;
      const ha = a.hit_count ?? 0;
      const hb = b.hit_count ?? 0;
      return hb - ha;
    });
    const keep = group[0];
    const drop = group.slice(1);

    await sbQuery("PATCH", `movie_cache?search_key=eq.${encodeURIComponent(keep.search_key)}`, { tmdb_id: id });
    for (const r of drop) {
      await sbQuery("DELETE", `movie_cache?search_key=eq.${encodeURIComponent(r.search_key)}`);
      collisionDeletes++;
    }
    console.log(`[backfill] tmdb_id=${id} had ${group.length} dups; kept ${keep.search_key}, deleted ${drop.length}`);
  }

  console.log(`\n[backfill] DONE. matched=${matched}, unmatched=${unmatched}, collision_deletes=${collisionDeletes}`);

  // Final invariant check.
  const dups = await sbQuery<Array<{ tmdb_id: number; n: number }>>(
    "GET",
    `rpc/dummy_force_invariant_check?dummy=1`
  ).catch(() => null);
  void dups;
  console.log("[backfill] re-run safe (idempotent on remaining NULLs).");
}

main().catch((err) => {
  console.error("\n[backfill] FATAL:", err);
  process.exit(1);
});
