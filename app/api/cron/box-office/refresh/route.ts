// app/api/cron/box-office/refresh/route.ts
//
// Weekly cron — fired every Tuesday 11:00 UTC (6:00 AM ET) by Vercel Cron.
// See vercel.json for the schedule entry.
//
// What it does:
//   1. Discover the most-recently-completed week on Box Office Mojo
//   2. Scrape that week's Top 10
//   3. Refresh current month / season / year charts (BOM updates these daily,
//      so the Tuesday pull captures the latest cumulative numbers)
//   4. Upsert all rows into box_office_metrics
//   5. Resolve any prior unresolved cron_failures
//   6. On any error: log to cron_failures + email via Resend; return 500
//
// All fetches are throttled (1.5s between BOM page hits) to be polite. Total
// runtime is ~10–20s for 4 chart fetches + ~30 TMDB enrichments + ~30 upserts,
// well within the 300s Vercel function budget.

import { NextRequest, NextResponse } from "next/server";
import {
  scrapeWeekChart,
  scrapeMonthChart,
  scrapeSeasonChart,
  scrapeYearChart,
  discoverLatestWeek,
  ALL_MONTHS,
  ALL_SEASONS,
  type SeasonName,
  type MonthName,
} from "@/lib/bom-scraper";
import {
  upsertBoxOfficeRow,
  type DataStatus,
  type Region,
  type PeriodType,
  type Source,
} from "@/lib/box-office-upsert";
import { supabaseAdmin } from "@/lib/supabase-server";
import { sanitizeQuery } from "@/lib/sanitize";
import { waitUntil } from "@vercel/functions";
import { runFullPipeline, writeCacheEntries } from "@/lib/search-pipeline";
import {
  sendAlertEmail,
  logCronFailure,
  markCronFailuresResolved,
} from "@/lib/alert";

export const runtime = "nodejs";
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET;
const JOB = "box-office-refresh";
const REGION: Region = "domestic";
const SOURCE: Source = "bom-direct";
const TOP_N = 10;
const POLITE_DELAY_MS = 1500;

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

function currentMonth(now: Date): MonthName {
  return ALL_MONTHS[now.getUTCMonth()];
}

function currentSeason(now: Date): SeasonName {
  const m = now.getUTCMonth() + 1;
  if (m <= 3) return "winter";
  if (m <= 6) return "spring";
  if (m <= 9) return "summer";
  return "fall";
}

interface ChartIngestion {
  periodType: PeriodType;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  count: number;
}

// Track unique titles seen this run so we score-backfill each one only once.
type SeenTitle = { search_key: string; title: string };

/**
 * For each title that BOM gave us, populate `movie_cache` (Film Glance score
 * source) by running the search pipeline IN-PROCESS — same code path as
 * /api/search but called directly so we sidestep Vercel Deployment Protection
 * entirely. Each search adds one Claude call (~$0.005) plus TMDB + verified-
 * ratings — typical 4-10s wall time per movie. Runs via waitUntil so it
 * doesn't extend the cron's response time; Vercel keeps the function alive
 * past the 200 OK return until each pipeline completes.
 */
async function triggerScoreBackfill(seen: SeenTitle[]): Promise<void> {
  if (seen.length === 0) return;

  // De-dup by search_key (movies often appear in multiple period_types)
  const unique = new Map<string, SeenTitle>();
  for (const s of seen) if (!unique.has(s.search_key)) unique.set(s.search_key, s);

  // Skip titles that already have a movie_cache entry
  const keys = [...unique.keys()];
  const { data: hits } = await supabaseAdmin
    .from("movie_cache")
    .select("search_key")
    .in("search_key", keys);
  const have = new Set((hits || []).map((r: any) => r.search_key));
  const missing = [...unique.values()].filter((s) => !have.has(s.search_key));

  if (missing.length === 0) {
    console.log("[score-backfill] all top titles already in movie_cache, skipping");
    return;
  }

  console.log(
    `[score-backfill] running pipeline for ${missing.length} titles: ${missing
      .map((m) => m.title)
      .join(", ")
      .slice(0, 200)}`,
  );

  for (const m of missing) {
    // Each waitUntil keeps the function alive until the inner promise settles.
    // We run sequentially per-title so a single Claude API hiccup doesn't
    // spawn 10 concurrent slow calls; Promise.all-style parallelism inside
    // each runFullPipeline is preserved.
    waitUntil(
      (async () => {
        const t0 = Date.now();
        try {
          const mv = await runFullPipeline(m.title, m.title, undefined, null);
          if (!mv) {
            console.warn(`[score-backfill] pipeline returned null for "${m.title}"`);
            return;
          }
          await writeCacheEntries(
            m.search_key,
            null,
            mv.title || null,
            mv,
            null,
            "cron",
            "box-office-cron",
          );
          console.log(`[score-backfill] ✓ "${m.title}" cached in ${Date.now() - t0}ms`);
        } catch (err) {
          console.error(
            `[score-backfill] failed for "${m.title}":`,
            err instanceof Error ? err.message : String(err),
          );
        }
      })(),
    );
  }
}

async function ingestRows(
  result: { rows: any[]; periodLabel: string; periodStart: string; periodEnd: string },
  periodType: PeriodType,
  dataStatus: DataStatus,
  seenTitles: SeenTitle[]
): Promise<ChartIngestion> {
  let count = 0;
  for (const row of result.rows) {
    await upsertBoxOfficeRow({
      row,
      periodType,
      periodStart: result.periodStart,
      periodEnd: result.periodEnd,
      periodLabel: result.periodLabel,
      region: REGION,
      dataStatus,
      source: SOURCE,
    });
    seenTitles.push({ search_key: sanitizeQuery(row.title), title: row.title });
    count++;
  }
  return {
    periodType,
    periodStart: result.periodStart,
    periodEnd: result.periodEnd,
    periodLabel: result.periodLabel,
    count,
  };
}

export async function GET(req: NextRequest) {
  if (CRON_SECRET) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();
  const year = now.getUTCFullYear();
  const seenTitles: SeenTitle[] = [];
  const summary: { ingestions: ChartIngestion[]; warnings: string[] } = {
    ingestions: [],
    warnings: [],
  };

  try {
    // 1. Latest completed week
    const latestWeek = await discoverLatestWeek(year);
    await sleep(POLITE_DELAY_MS);
    if (latestWeek) {
      const weekResult = await scrapeWeekChart(latestWeek.year, latestWeek.week, TOP_N);
      summary.ingestions.push(
        await ingestRows(weekResult, "weekly", "actual", seenTitles),
      );
      await sleep(POLITE_DELAY_MS);
    } else {
      summary.warnings.push(`could not discover a completed week for ${year}`);
    }

    // 2. Current month (in-progress; data updates daily on BOM)
    const monthResult = await scrapeMonthChart(year, currentMonth(now), TOP_N);
    summary.ingestions.push(await ingestRows(monthResult, "monthly", "estimate", seenTitles));
    await sleep(POLITE_DELAY_MS);

    // 3. Current season (in-progress)
    const seasonResult = await scrapeSeasonChart(year, currentSeason(now), TOP_N);
    summary.ingestions.push(await ingestRows(seasonResult, "seasonal", "estimate", seenTitles));
    await sleep(POLITE_DELAY_MS);

    // 4. Current year (in-progress)
    const yearResult = await scrapeYearChart(year, TOP_N);
    summary.ingestions.push(await ingestRows(yearResult, "yearly", "estimate", seenTitles));

    // Resolve prior failures
    await markCronFailuresResolved(JOB);

    // Score backfill — fire searches for titles missing from movie_cache.
    // Runs as fire-and-forget via waitUntil so the cron's response is fast.
    await triggerScoreBackfill(seenTitles);

    console.log(`[${JOB}] ✓`, summary);
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    console.error(`[${JOB}] ✗`, err);
    await logCronFailure(JOB, err, { partialSummary: summary });
    await sendAlertEmail(`${JOB} failed`, err, { partialSummary: summary });
    return NextResponse.json(
      { ok: false, error: String(err), partialSummary: summary },
      { status: 500 },
    );
  }
}
