// scripts/bom-deep-rescrape.ts
//
// One-shot: re-scrape every period currently in box_office_metrics with
// topN=100 (was topN=10 historically) so the table contains every film
// that has charted, not just the Top 10 per period. Pure ingestion — no
// Claude/RapidAPI spend, just BOM HTTP fetches + Supabase upserts.
//
// Run on VPS:
//   cd ~/film-glance-bulk-seed
//   git pull origin main          # pull the topN=100 changes first
//   nohup npx tsx scripts/bom-deep-rescrape.ts > ~/bom-rescrape.log 2>&1 &
//   tail -f ~/bom-rescrape.log
//
// Required env (loaded from .env.local at project root):
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TMDB_API_KEY
//
// Throughput: ~1.5s/period (BOM politeness delay) × ~3,300 periods ≈ 80
// minutes minimum. With parsing/upsert overhead expect 2-3 hours total.
//
// State: ~/.bom-rescrape-state.json (periodIdx). Failures appended to
// ~/.bom-rescrape-failures.log; the run continues past per-period errors.

import { readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

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
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "TMDB_API_KEY",
];
for (const k of REQUIRED) {
  if (!process.env[k]) {
    console.error(`Missing required env var: ${k}`);
    process.exit(1);
  }
}

// Lib imports run AFTER env is loaded — assigned inside main() so we don't
// rely on top-level await (tsx defaults to CJS where TLA is a parse error).
let scrapeYearChart!: typeof import("../lib/bom-scraper.js")["scrapeYearChart"];
let scrapeMonthChart!: typeof import("../lib/bom-scraper.js")["scrapeMonthChart"];
let scrapeSeasonChart!: typeof import("../lib/bom-scraper.js")["scrapeSeasonChart"];
let scrapeWeekChart!: typeof import("../lib/bom-scraper.js")["scrapeWeekChart"];
let upsertBoxOfficeRow!: typeof import("../lib/box-office-upsert.js")["upsertBoxOfficeRow"];

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const STATE_PATH = join(homedir(), ".bom-rescrape-state.json");
const FAILURE_LOG = join(homedir(), ".bom-rescrape-failures.log");

const POLITE_DELAY_MS = 1500;
const TOP_N = 100;

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

interface State {
  periodIdx: number;
  totalPeriods: number;
  rowsUpserted: number;
  newRowsAdded: number; // rows beyond the original Top 10
  startedAt: string;
}

interface PeriodKey {
  period_type: "weekly" | "monthly" | "seasonal" | "yearly";
  period_start: string; // YYYY-MM-DD
  period_end: string;
  period_label: string;
}

function loadState(totalPeriods: number): State {
  if (existsSync(STATE_PATH)) {
    try {
      const s = JSON.parse(readFileSync(STATE_PATH, "utf8"));
      // If the period count changed, restart — safer than guessing alignment.
      if (s.totalPeriods === totalPeriods) return s;
    } catch {
      // fallthrough
    }
  }
  return {
    periodIdx: 0,
    totalPeriods,
    rowsUpserted: 0,
    newRowsAdded: 0,
    startedAt: new Date().toISOString(),
  };
}

function saveState(s: State): void {
  writeFileSync(STATE_PATH, JSON.stringify(s, null, 2));
}

async function loadAllPeriods(): Promise<PeriodKey[]> {
  // Paginate — PostgREST caps at 1000 rows/request, and we have ~3,300 boards.
  // Filter rank=1 so we get one row per period, then strip rank.
  const PAGE = 1000;
  const out: PeriodKey[] = [];
  for (let page = 0; page < 100; page++) {
    const from = page * PAGE;
    const url = `${SB_URL}/rest/v1/box_office_metrics?select=period_type,period_start,period_end,period_label&region=eq.domestic&rank=eq.1&order=period_type.asc,period_start.desc`;
    const r = await fetch(url, {
      headers: {
        apikey: SB_KEY,
        authorization: `Bearer ${SB_KEY}`,
        Range: `${from}-${from + PAGE - 1}`,
        "Range-Unit": "items",
      },
    });
    if (!r.ok) {
      throw new Error(`Supabase GET periods failed: ${r.status} ${await r.text()}`);
    }
    const rows = (await r.json()) as PeriodKey[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

// Map a PeriodKey into the right scraper call.
async function rescrapePeriod(p: PeriodKey): Promise<{ rowsAdded: number; newRows: number }> {
  const start = new Date(p.period_start + "T00:00:00Z");
  const year = start.getUTCFullYear();
  const monthIdx = start.getUTCMonth(); // 0-11

  let result: { rows: import("../lib/bom-scraper.js").BomRow[]; periodLabel: string; periodStart: string; periodEnd: string };

  if (p.period_type === "yearly") {
    result = await scrapeYearChart(year, TOP_N);
  } else if (p.period_type === "monthly") {
    const monthName = ([
      "january", "february", "march", "april", "may", "june",
      "july", "august", "september", "october", "november", "december",
    ] as const)[monthIdx];
    result = await scrapeMonthChart(year, monthName as any, TOP_N);
  } else if (p.period_type === "seasonal") {
    // Seasonal: derive season from month
    const m = monthIdx + 1;
    const season = m <= 3 ? "winter" : m <= 6 ? "spring" : m <= 9 ? "summer" : "fall";
    result = await scrapeSeasonChart(year, season as any, TOP_N);
  } else {
    // Weekly: derive ISO week number from period_start
    const week = isoWeekNumber(start);
    result = await scrapeWeekChart(year, week, TOP_N);
  }

  let rowsAdded = 0;
  let newRows = 0;
  for (const row of result.rows) {
    try {
      await upsertBoxOfficeRow({
        row,
        periodType: p.period_type,
        periodStart: p.period_start,
        periodEnd: p.period_end,
        periodLabel: p.period_label,
        region: "domestic",
        dataStatus: "historical",
        source: "bom-direct",
      });
      rowsAdded++;
      if (row.rank > 10) newRows++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      appendFileSync(
        FAILURE_LOG,
        `${new Date().toISOString()}\t${p.period_type}\t${p.period_start}\t${row.rank}\t${row.title}\t${msg}\n`,
      );
    }
  }
  return { rowsAdded, newRows };
}

function isoWeekNumber(d: Date): number {
  // ISO week: Monday-start, week 1 contains the first Thursday of the year
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  return Math.ceil(((dt.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

async function main() {
  console.log(`[bom-rescrape] starting at ${new Date().toISOString()}`);

  const scraperLib = await import("../lib/bom-scraper.js");
  scrapeYearChart = scraperLib.scrapeYearChart;
  scrapeMonthChart = scraperLib.scrapeMonthChart;
  scrapeSeasonChart = scraperLib.scrapeSeasonChart;
  scrapeWeekChart = scraperLib.scrapeWeekChart;
  const upsertLib = await import("../lib/box-office-upsert.js");
  upsertBoxOfficeRow = upsertLib.upsertBoxOfficeRow;

  console.log("[bom-rescrape] loading existing periods from box_office_metrics…");
  const periods = await loadAllPeriods();
  console.log(`[bom-rescrape] ${periods.length} periods to rescrape`);

  const state = loadState(periods.length);
  console.log(`[bom-rescrape] resume from periodIdx=${state.periodIdx}/${state.totalPeriods}`);

  const startTime = Date.now();

  for (let i = state.periodIdx; i < periods.length; i++) {
    const p = periods[i];
    try {
      const { rowsAdded, newRows } = await rescrapePeriod(p);
      state.periodIdx = i + 1;
      state.rowsUpserted += rowsAdded;
      state.newRowsAdded += newRows;

      if (i % 25 === 0 || newRows > 0) {
        const elapsed = Date.now() - startTime;
        const rate = state.periodIdx / (elapsed / 1000);
        const remaining = periods.length - state.periodIdx;
        const etaSec = remaining / rate;
        const etaH = Math.floor(etaSec / 3600);
        const etaM = Math.floor((etaSec % 3600) / 60);
        console.log(
          `[bom-rescrape] ${i + 1}/${periods.length} ${p.period_type} ${p.period_start} ` +
          `+${rowsAdded} (${newRows} new beyond Top 10) | ` +
          `total upserts=${state.rowsUpserted} new=${state.newRowsAdded} | ` +
          `rate=${rate.toFixed(2)}/s ETA=${etaH}h${etaM}m`,
        );
      }
      saveState(state);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[bom-rescrape] FAILED ${p.period_type} ${p.period_start}: ${msg}`);
      appendFileSync(
        FAILURE_LOG,
        `${new Date().toISOString()}\t${p.period_type}\t${p.period_start}\tPERIOD_FAILED\t${msg}\n`,
      );
      state.periodIdx = i + 1;
      saveState(state);
    }
    await sleep(POLITE_DELAY_MS);
  }

  const elapsedH = ((Date.now() - startTime) / 3600000).toFixed(2);
  console.log(
    `\n[bom-rescrape] DONE in ${elapsedH}h. ` +
    `total upserts=${state.rowsUpserted}, new rows beyond Top 10=${state.newRowsAdded}`,
  );
}

main().catch((err) => {
  console.error("[bom-rescrape] fatal:", err);
  process.exit(1);
});
