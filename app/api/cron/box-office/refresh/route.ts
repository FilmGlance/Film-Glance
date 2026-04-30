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

async function ingestRows(
  result: { rows: any[]; periodLabel: string; periodStart: string; periodEnd: string },
  periodType: PeriodType,
  dataStatus: DataStatus
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
        await ingestRows(weekResult, "weekly", "actual"),
      );
      await sleep(POLITE_DELAY_MS);
    } else {
      summary.warnings.push(`could not discover a completed week for ${year}`);
    }

    // 2. Current month (in-progress; data updates daily on BOM)
    const monthResult = await scrapeMonthChart(year, currentMonth(now), TOP_N);
    summary.ingestions.push(await ingestRows(monthResult, "monthly", "estimate"));
    await sleep(POLITE_DELAY_MS);

    // 3. Current season (in-progress)
    const seasonResult = await scrapeSeasonChart(year, currentSeason(now), TOP_N);
    summary.ingestions.push(await ingestRows(seasonResult, "seasonal", "estimate"));
    await sleep(POLITE_DELAY_MS);

    // 4. Current year (in-progress)
    const yearResult = await scrapeYearChart(year, TOP_N);
    summary.ingestions.push(await ingestRows(yearResult, "yearly", "estimate"));

    // Resolve prior failures
    await markCronFailuresResolved(JOB);

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
