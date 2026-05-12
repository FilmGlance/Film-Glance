// lib/bom-scraper.ts
//
// Direct cheerio-based scraper for Box Office Mojo's chart pages. Used by:
//   • app/api/cron/box-office/refresh — Tuesday weekly cron, scrapes the
//     most-recently-completed week + refreshes month/season/year totals
//   • app/api/admin/backfill-bom — one-shot historical scrape, walks
//     1984..present-1 across all 4 period types
//
// URL patterns (confirmed against live BOM 2026-04-30):
//   /year/{YYYY}/                            → Top 200 of the calendar year
//   /month/{january|february|...}/{YYYY}/    → Top 100 of that month
//   /season/{winter|spring|summer|fall}/{YYYY}/  → Top ~150 of that season
//   /weekly/{YYYY}W{NN}/                     → Top ~70 of that ISO-style week
//   /weekly/by-year/{YYYY}/                  → Index of all weeks in a year
//
// Output normalization: gross stored as DOLLARS (number) here; the cron/upsert
// converts to cents at insert time (schema is bigint cents). Titles are kept
// raw — `search_key` is computed by the caller via lib/sanitize.ts so the
// search_key matches movie_cache exactly.

import * as cheerio from "cheerio";

export type PeriodType = "weekly" | "monthly" | "seasonal" | "yearly";
export type SeasonName = "winter" | "spring" | "summer" | "fall";
export type MonthName =
  | "january" | "february" | "march" | "april" | "may" | "june"
  | "july" | "august" | "september" | "october" | "november" | "december";

export interface BomRow {
  rank: number;
  title: string;
  bomReleaseId: string | null;     // 'rl3638199041' from /release/rl3638199041/
  gross: number;                    // dollars
  theaters: number | null;
  pta: number | null;               // per-theater average (only weekly chart provides directly)
  totalGross: number | null;
  weeksReleased: number | null;
  // weekly-only signals
  rankLastWeek: number | null;
  changePctLastWeek: number | null;
  // periodic-chart signals
  releaseDate: string | null;       // BOM displays month-day for current year
  distributor: string | null;
  budget: number | null;
  runtimeRaw: string | null;
  genre: string | null;
}

export interface BomChartResult {
  rows: BomRow[];
  // Period descriptors (some scraped from page header, some inferred)
  periodLabel: string;              // e.g. "2024", "January 2024", "Winter 2024", "Apr 26-28, 2024"
  periodStart: string;              // YYYY-MM-DD (inferred for some chart types)
  periodEnd: string;                // YYYY-MM-DD
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const BOM = "https://www.boxofficemojo.com";

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html,*/*" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`BOM fetch ${url} → ${res.status}`);
  return res.text();
}

// ── Cell parsers ────────────────────────────────────────────────────────────

function parseDollar(s: string | undefined | null): number | null {
  if (!s) return null;
  const m = s.replace(/[,\s$]/g, "").match(/^-?\d+/);
  return m ? parseInt(m[0], 10) : null;
}

function parseInteger(s: string | undefined | null): number | null {
  if (!s) return null;
  const m = s.replace(/[,\s]/g, "").match(/^-?\d+/);
  return m ? parseInt(m[0], 10) : null;
}

function parsePctChange(s: string | undefined | null): number | null {
  if (!s) return null;
  const m = s.match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

function txt(s: string | undefined | null): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

function extractReleaseId(href: string | undefined | null): string | null {
  if (!href) return null;
  const m = href.match(/\/release\/(rl\w+)/);
  return m ? m[1] : null;
}

// ── Header → column-index map ───────────────────────────────────────────────
//
// BOM's chart pages share most column names but vary slightly between chart
// types. We build a map from canonical header name → column index by reading
// the first <tr>'s <th> labels. Then per row we pull cells by name. This is
// resilient to minor column-order changes.

type ColumnMap = Record<string, number>;

function buildColumnMap($: cheerio.CheerioAPI): ColumnMap {
  const map: ColumnMap = {};
  $("tr")
    .first()
    .find("th")
    .each((i, el) => {
      const h = txt($(el).text()).toLowerCase();
      if (h) map[h] = i;
    });
  return map;
}

function cellByHeader(
  row: cheerio.Cheerio<any>,
  $: cheerio.CheerioAPI,
  map: ColumnMap,
  header: string
): cheerio.Cheerio<any> | null {
  const idx = map[header.toLowerCase()];
  if (idx === undefined) return null;
  return row.find("td").eq(idx);
}

// ── Row parsers per chart type ──────────────────────────────────────────────

/**
 * Parse a periodic chart (yearly/monthly/seasonal). All three share the
 * same column layout:
 *   Rank | Release | Genre | Budget | Running Time | Gross | Theaters
 *        | Total Gross | Release Date | Distributor | Estimated
 */
function parsePeriodicRow(
  $: cheerio.CheerioAPI,
  row: cheerio.Cheerio<any>,
  map: ColumnMap
): BomRow | null {
  const rank = parseInteger(txt(cellByHeader(row, $, map, "rank")?.text()));
  if (rank === null) return null;

  const releaseCell = cellByHeader(row, $, map, "release");
  const link = releaseCell?.find("a").first();
  const title = txt(link?.text());
  if (!title) return null;
  const bomReleaseId = extractReleaseId(link?.attr("href"));

  const grossDollars = parseDollar(txt(cellByHeader(row, $, map, "gross")?.text()));
  if (grossDollars === null) return null;

  return {
    rank,
    title,
    bomReleaseId,
    gross: grossDollars,
    theaters: parseInteger(txt(cellByHeader(row, $, map, "theaters")?.text())),
    pta: null, // periodic charts don't include per-theater avg directly
    totalGross: parseDollar(txt(cellByHeader(row, $, map, "total gross")?.text())),
    weeksReleased: null,
    rankLastWeek: null,
    changePctLastWeek: null,
    releaseDate: txt(cellByHeader(row, $, map, "release date")?.text()) || null,
    distributor: txt(cellByHeader(row, $, map, "distributor")?.text()) || null,
    budget: parseDollar(txt(cellByHeader(row, $, map, "budget")?.text())),
    runtimeRaw: txt(cellByHeader(row, $, map, "running time")?.text()) || null,
    genre: txt(cellByHeader(row, $, map, "genre")?.text()) || null,
  };
}

/**
 * Parse a weekly chart row.
 * Columns: Rank | LW | Release | Gross | %± LW | Theaters | Change | Average
 *        | Total Gross | Weeks
 */
function parseWeeklyRow(
  $: cheerio.CheerioAPI,
  row: cheerio.Cheerio<any>,
  map: ColumnMap
): BomRow | null {
  const rank = parseInteger(txt(cellByHeader(row, $, map, "rank")?.text()));
  if (rank === null) return null;

  const releaseCell = cellByHeader(row, $, map, "release");
  const link = releaseCell?.find("a").first();
  const title = txt(link?.text());
  if (!title) return null;
  const bomReleaseId = extractReleaseId(link?.attr("href"));

  const grossDollars = parseDollar(txt(cellByHeader(row, $, map, "gross")?.text()));
  if (grossDollars === null) return null;

  return {
    rank,
    title,
    bomReleaseId,
    gross: grossDollars,
    theaters: parseInteger(txt(cellByHeader(row, $, map, "theaters")?.text())),
    pta: parseDollar(txt(cellByHeader(row, $, map, "average")?.text())),
    totalGross: parseDollar(txt(cellByHeader(row, $, map, "total gross")?.text())),
    weeksReleased: parseInteger(txt(cellByHeader(row, $, map, "weeks")?.text())),
    rankLastWeek: parseInteger(txt(cellByHeader(row, $, map, "lw")?.text())),
    changePctLastWeek: parsePctChange(txt(cellByHeader(row, $, map, "%± lw")?.text())),
    releaseDate: null,
    distributor: null,
    budget: null,
    runtimeRaw: null,
    genre: null,
  };
}

// ── Public scrapers ─────────────────────────────────────────────────────────

const MONTH_NAMES: MonthName[] = [
  "january","february","march","april","may","june",
  "july","august","september","october","november","december",
];

const MONTH_LAST_DAY: Record<MonthName, (year: number) => number> = {
  january: () => 31, february: y => (isLeap(y) ? 29 : 28),
  march: () => 31, april: () => 30, may: () => 31, june: () => 30,
  july: () => 31, august: () => 31, september: () => 30,
  october: () => 31, november: () => 30, december: () => 31,
};

function isLeap(y: number) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function pad2(n: number) { return n.toString().padStart(2, "0"); }

function monthIndex(name: MonthName): number {
  return MONTH_NAMES.indexOf(name);
}

// BOM season convention (verified by inspection): Winter Q1, Spring Q2,
// Summer Q3, Fall Q4. Approximate boundaries — the scraper falls back to
// 3-month chunks but BOM's actual page may show slightly different ranges.
const SEASON_BOUNDS: Record<SeasonName, [number, number, number, number]> = {
  winter: [1, 1, 3, 31],   // Jan 1 - Mar 31
  spring: [4, 1, 6, 30],   // Apr 1 - Jun 30
  summer: [7, 1, 9, 30],   // Jul 1 - Sep 30
  fall:   [10, 1, 12, 31], // Oct 1 - Dec 31
};

export async function scrapeYearChart(
  year: number,
  topN: number = 100
): Promise<BomChartResult> {
  const url = `${BOM}/year/${year}/`;
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  const map = buildColumnMap($);
  const rows: BomRow[] = [];
  $("tr").each((_, el) => {
    if (rows.length >= topN) return false;
    const r = parsePeriodicRow($, $(el), map);
    if (r) rows.push(r);
  });
  return {
    rows,
    periodLabel: `${year}`,
    periodStart: `${year}-01-01`,
    periodEnd: `${year}-12-31`,
  };
}

export async function scrapeMonthChart(
  year: number,
  month: MonthName,
  topN: number = 100
): Promise<BomChartResult> {
  const url = `${BOM}/month/${month}/${year}/`;
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  const map = buildColumnMap($);
  const rows: BomRow[] = [];
  $("tr").each((_, el) => {
    if (rows.length >= topN) return false;
    const r = parsePeriodicRow($, $(el), map);
    if (r) rows.push(r);
  });
  const mIdx = monthIndex(month);
  const lastDay = MONTH_LAST_DAY[month](year);
  return {
    rows,
    periodLabel: `${capitalize(month)} ${year}`,
    periodStart: `${year}-${pad2(mIdx + 1)}-01`,
    periodEnd: `${year}-${pad2(mIdx + 1)}-${pad2(lastDay)}`,
  };
}

export async function scrapeSeasonChart(
  year: number,
  season: SeasonName,
  topN: number = 100
): Promise<BomChartResult> {
  const url = `${BOM}/season/${season}/${year}/`;
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  const map = buildColumnMap($);
  const rows: BomRow[] = [];
  $("tr").each((_, el) => {
    if (rows.length >= topN) return false;
    const r = parsePeriodicRow($, $(el), map);
    if (r) rows.push(r);
  });
  const [m1, d1, m2, d2] = SEASON_BOUNDS[season];
  return {
    rows,
    periodLabel: `${capitalize(season)} ${year}`,
    periodStart: `${year}-${pad2(m1)}-${pad2(d1)}`,
    periodEnd: `${year}-${pad2(m2)}-${pad2(d2)}`,
  };
}

export async function scrapeWeekChart(
  year: number,
  weekNumber: number,
  topN: number = 100
): Promise<BomChartResult> {
  // BOM uses ISO-style week IDs in URLs: /weekly/2024W17/
  const wid = `${year}W${pad2(weekNumber)}`;
  const url = `${BOM}/weekly/${wid}/`;
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  const map = buildColumnMap($);
  const rows: BomRow[] = [];
  $("tr").each((_, el) => {
    if (rows.length >= topN) return false;
    const r = parseWeeklyRow($, $(el), map);
    if (r) rows.push(r);
  });
  // Compute approximate Mon-Sun boundaries from ISO week
  const { start, end } = isoWeekBoundaries(year, weekNumber);
  // Period label formatted from page if possible, else generated
  const headerLabel = txt($("h1").first().text()) || `Week ${weekNumber}, ${year}`;
  return {
    rows,
    periodLabel: headerLabel,
    periodStart: start,
    periodEnd: end,
  };
}

/**
 * Discover the most-recent completed week available on BOM by reading
 * `/weekly/by-year/{year}/`. Returns the first (most recent) week ID found.
 * Used by the weekly cron when it doesn't know the current week number.
 */
export async function discoverLatestWeek(year: number): Promise<{ year: number; week: number } | null> {
  const url = `${BOM}/weekly/by-year/${year}/`;
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  // Each Dates cell has an anchor like /weekly/2024W17/
  let found: { year: number; week: number } | null = null;
  $("a[href*='/weekly/']").each((_, el) => {
    if (found) return false;
    const href = $(el).attr("href") || "";
    const m = href.match(/\/weekly\/(\d{4})W(\d{2})\//);
    if (m) found = { year: parseInt(m[1], 10), week: parseInt(m[2], 10) };
  });
  return found;
}

// ── ISO-week helpers ────────────────────────────────────────────────────────

/**
 * Map (year, ISO week number) → { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }
 * for Monday-through-Sunday. BOM uses ISO weeks.
 */
function isoWeekBoundaries(
  year: number,
  weekNumber: number
): { start: string; end: string } {
  // Jan 4 is always in ISO week 1
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Dow = jan4.getUTCDay() || 7; // Sun=0 → 7
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Dow - 1));
  const targetMonday = new Date(week1Monday);
  targetMonday.setUTCDate(week1Monday.getUTCDate() + (weekNumber - 1) * 7);
  const targetSunday = new Date(targetMonday);
  targetSunday.setUTCDate(targetMonday.getUTCDate() + 6);
  return { start: fmtUTC(targetMonday), end: fmtUTC(targetSunday) };
}

function fmtUTC(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Convenience exports ─────────────────────────────────────────────────────

export const ALL_MONTHS: MonthName[] = MONTH_NAMES;
export const ALL_SEASONS: SeasonName[] = ["winter", "spring", "summer", "fall"];
