// app/api/admin/backfill-bom/route.ts
//
// One-shot historical Box Office Mojo backfill. Manually triggered via curl
// with the CRON_SECRET. Idempotent — re-running is safe (every row upserts).
//
// Operator runs it via a shell loop:
//
//   for year in $(seq 1984 2024); do
//     for type in yearly seasonal monthly weekly; do
//       curl -H "Authorization: Bearer $CRON_SECRET" \
//         "$BASE/api/admin/backfill-bom?year=$year&period_type=$type"
//       sleep 5
//     done
//   done
//
// Each invocation handles ONE (year × period_type) and stays well under the
// 300s function budget. The whole 1984..2024 sweep takes ~3-4 hours with
// supervised pacing.
//
// All rows written here get source='bom-direct', data_status='historical'.

import { NextRequest, NextResponse } from "next/server";
import {
  scrapeYearChart,
  scrapeMonthChart,
  scrapeSeasonChart,
  scrapeWeekChart,
  ALL_MONTHS,
  ALL_SEASONS,
  type SeasonName,
  type MonthName,
} from "@/lib/bom-scraper";
import {
  upsertBoxOfficeRow,
  type Region,
  type Source,
  type DataStatus,
} from "@/lib/box-office-upsert";
import {
  sendAlertEmail,
  logCronFailure,
  markCronFailuresResolved,
} from "@/lib/alert";

export const runtime = "nodejs";
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET;
const JOB = "bom-historical-backfill";
const REGION: Region = "domestic";
const SOURCE: Source = "bom-direct";
const STATUS: DataStatus = "historical";
const TOP_N = 10;
const POLITE_DELAY_MS = 1500;
const MAX_WEEKS_PER_INVOCATION = 60; // Buffer above 53 to handle ISO-week edge cases

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

interface BackfillSummary {
  year: number;
  period_type: string;
  ingested: number;
  failed_periods: { label: string; reason: string }[];
}

function isValidPeriodType(s: string | null): s is "weekly" | "monthly" | "seasonal" | "yearly" {
  return s === "weekly" || s === "monthly" || s === "seasonal" || s === "yearly";
}

async function ingest(
  result: { rows: any[]; periodLabel: string; periodStart: string; periodEnd: string },
  periodType: "weekly" | "monthly" | "seasonal" | "yearly"
): Promise<number> {
  let n = 0;
  for (const row of result.rows) {
    await upsertBoxOfficeRow({
      row,
      periodType,
      periodStart: result.periodStart,
      periodEnd: result.periodEnd,
      periodLabel: result.periodLabel,
      region: REGION,
      dataStatus: STATUS,
      source: SOURCE,
    });
    n++;
  }
  return n;
}

export async function GET(req: NextRequest) {
  if (CRON_SECRET) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const { searchParams } = new URL(req.url);
  const yearRaw = searchParams.get("year");
  const periodTypeRaw = searchParams.get("period_type");

  const year = yearRaw ? parseInt(yearRaw, 10) : NaN;
  if (!Number.isFinite(year) || year < 1977 || year > 2100) {
    return NextResponse.json(
      { error: "year query param required (1977..2100)" },
      { status: 400 },
    );
  }
  if (!isValidPeriodType(periodTypeRaw)) {
    return NextResponse.json(
      { error: "period_type query param required (weekly|monthly|seasonal|yearly)" },
      { status: 400 },
    );
  }

  const summary: BackfillSummary = {
    year,
    period_type: periodTypeRaw,
    ingested: 0,
    failed_periods: [],
  };

  try {
    if (periodTypeRaw === "yearly") {
      const result = await scrapeYearChart(year, TOP_N);
      summary.ingested += await ingest(result, "yearly");
    } else if (periodTypeRaw === "seasonal") {
      for (const season of ALL_SEASONS) {
        try {
          const result = await scrapeSeasonChart(year, season, TOP_N);
          summary.ingested += await ingest(result, "seasonal");
        } catch (err) {
          summary.failed_periods.push({
            label: `${season} ${year}`,
            reason: String(err),
          });
        }
        await sleep(POLITE_DELAY_MS);
      }
    } else if (periodTypeRaw === "monthly") {
      for (const month of ALL_MONTHS) {
        try {
          const result = await scrapeMonthChart(year, month, TOP_N);
          summary.ingested += await ingest(result, "monthly");
        } catch (err) {
          summary.failed_periods.push({
            label: `${month} ${year}`,
            reason: String(err),
          });
        }
        await sleep(POLITE_DELAY_MS);
      }
    } else if (periodTypeRaw === "weekly") {
      // BOM uses ISO-style week IDs: 2024W01..2024W52 (or W53). We try every
      // week 01..MAX; missing weeks just throw and we skip them.
      for (let w = 1; w <= MAX_WEEKS_PER_INVOCATION; w++) {
        try {
          const result = await scrapeWeekChart(year, w, TOP_N);
          if (result.rows.length === 0) {
            // Empty result usually means BOM returned 200 but no chart for that week
            continue;
          }
          summary.ingested += await ingest(result, "weekly");
        } catch (err) {
          // Don't pollute failed_periods with expected 404s for non-existent weeks (W53 in non-leap-week years)
          const reason = String(err);
          if (!reason.includes("404")) {
            summary.failed_periods.push({
              label: `week ${w} of ${year}`,
              reason,
            });
          }
        }
        await sleep(POLITE_DELAY_MS);
      }
    }

    await markCronFailuresResolved(JOB);
    console.log(`[${JOB}] ✓`, summary);
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    console.error(`[${JOB}] ✗`, err);
    await logCronFailure(JOB, err, { partialSummary: summary });
    // Don't email on every failed weekly week — only escalate at top level
    await sendAlertEmail(`${JOB} failed for ${year} ${periodTypeRaw}`, err, {
      partialSummary: summary,
    });
    return NextResponse.json(
      { ok: false, error: String(err), partialSummary: summary },
      { status: 500 },
    );
  }
}
