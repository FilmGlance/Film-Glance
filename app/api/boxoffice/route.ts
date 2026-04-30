// app/api/boxoffice/route.ts
//
// Read endpoint for the /boxoffice page. Reads from box_office_metrics +
// joins fg_score from movie_cache.data->'score'->>'ten' for each Top-10 entry.
//
// Query params:
//   period   weekly | monthly | seasonal | yearly  (default 'weekly')
//   region   domestic | international | worldwide  (default 'domestic';
//            international currently has no data — returns empty list)
//   date     YYYY-MM-DD — period_start to display. Default: most recent
//            available period_start for (period, region).
//
// Response:
//   {
//     period_type, region, period_label, period_start, period_end,
//     retrieved_at, data_status, source,
//     available_periods: [{ period_start, period_label }, ...],
//     entries: [{ rank, search_key, title, year, poster_path, backdrop_path,
//                 gross, theaters, pta, fg_score }, ...]
//   }

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

type PeriodType = "weekly" | "monthly" | "seasonal" | "yearly";
type RegionType = "domestic" | "international" | "worldwide";

const VALID_PERIODS: PeriodType[] = ["weekly", "monthly", "seasonal", "yearly"];
const VALID_REGIONS: RegionType[] = ["domestic", "international", "worldwide"];

interface BoxOfficeRowResponse {
  rank: number;
  search_key: string;
  title: string;
  year: number | null;
  poster_path: string | null;
  backdrop_path: string | null;
  gross: number;            // dollars
  theaters: number | null;
  pta: number | null;       // dollars (per-theater average)
  fg_score: number | null;  // 0..10, or null if not yet searched
}

interface DbRow {
  search_key: string;
  title: string;
  release_year: number | null;
  poster_path: string | null;
  backdrop_path: string | null;
  rank: number;
  gross: number;          // cents
  theaters: number | null;
  pta_cents: number | null;
  period_label: string;
  period_start: string;
  period_end: string;
  data_status: string;
  source: string;
  retrieved_at: string;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const period = (searchParams.get("period") || "weekly").toLowerCase();
  const region = (searchParams.get("region") || "domestic").toLowerCase();
  const date = searchParams.get("date");

  if (!VALID_PERIODS.includes(period as PeriodType)) {
    return NextResponse.json(
      { error: `period must be one of ${VALID_PERIODS.join(", ")}` },
      { status: 400 },
    );
  }
  if (!VALID_REGIONS.includes(region as RegionType)) {
    return NextResponse.json(
      { error: `region must be one of ${VALID_REGIONS.join(", ")}` },
      { status: 400 },
    );
  }

  // 1. Discover available periods for the navigator dropdown
  const { data: availData, error: availErr } = await supabaseAdmin
    .from("box_office_metrics")
    .select("period_start, period_label")
    .eq("period_type", period)
    .eq("region", region)
    .order("period_start", { ascending: false });

  if (availErr) {
    console.error("[boxoffice-read] available_periods query failed:", availErr);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  // Dedup by period_start (one row per movie, but we want distinct periods)
  const seen = new Set<string>();
  const available_periods = (availData || [])
    .filter((r) => {
      if (!r.period_start || seen.has(r.period_start)) return false;
      seen.add(r.period_start);
      return true;
    })
    .map((r) => ({
      period_start: r.period_start as string,
      period_label: r.period_label as string,
    }));

  if (available_periods.length === 0) {
    return NextResponse.json({
      period_type: period,
      region,
      period_label: null,
      period_start: null,
      period_end: null,
      retrieved_at: null,
      data_status: null,
      source: null,
      available_periods: [],
      entries: [],
    });
  }

  // 2. Pick target period_start
  const targetPeriodStart =
    date && available_periods.find((p) => p.period_start === date)
      ? date
      : available_periods[0].period_start;

  // 3. Fetch the Top 10 rows for that exact period
  const { data: rows, error: rowsErr } = await supabaseAdmin
    .from("box_office_metrics")
    .select(
      "search_key, title, release_year, poster_path, backdrop_path, rank, gross, theaters, pta_cents, period_label, period_start, period_end, data_status, source, retrieved_at",
    )
    .eq("period_type", period)
    .eq("region", region)
    .eq("period_start", targetPeriodStart)
    .order("rank", { ascending: true })
    .limit(10);

  if (rowsErr) {
    console.error("[boxoffice-read] rows query failed:", rowsErr);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  const dbRows = (rows || []) as DbRow[];
  if (dbRows.length === 0) {
    return NextResponse.json({
      period_type: period,
      region,
      period_label: null,
      period_start: targetPeriodStart,
      period_end: null,
      retrieved_at: null,
      data_status: null,
      source: null,
      available_periods,
      entries: [],
    });
  }

  // 4. Lookup fg_score for each search_key (batched single query)
  const searchKeys = dbRows.map((r) => r.search_key);
  const { data: cacheRows } = await supabaseAdmin
    .from("movie_cache")
    .select("search_key, data")
    .in("search_key", searchKeys);

  const scoreByKey = new Map<string, number | null>();
  for (const c of (cacheRows || []) as { search_key: string; data: any }[]) {
    const score = c.data?.score?.ten;
    scoreByKey.set(
      c.search_key,
      typeof score === "number" ? score : score != null ? parseFloat(String(score)) : null,
    );
  }

  // 5. Shape entries
  const entries: BoxOfficeRowResponse[] = dbRows.map((r) => {
    const grossDollars = Math.round((r.gross ?? 0) / 100);
    let ptaDollars: number | null = null;
    if (r.pta_cents != null) {
      ptaDollars = Math.round(r.pta_cents / 100);
    } else if (r.theaters && r.theaters > 0) {
      ptaDollars = Math.round(grossDollars / r.theaters);
    }
    return {
      rank: r.rank,
      search_key: r.search_key,
      title: r.title,
      year: r.release_year,
      poster_path: r.poster_path,
      backdrop_path: r.backdrop_path,
      gross: grossDollars,
      theaters: r.theaters,
      pta: ptaDollars,
      fg_score: scoreByKey.get(r.search_key) ?? null,
    };
  });

  const head = dbRows[0];
  return NextResponse.json({
    period_type: period,
    region,
    period_label: head.period_label,
    period_start: head.period_start,
    period_end: head.period_end,
    retrieved_at: head.retrieved_at,
    data_status: head.data_status,
    source: head.source,
    available_periods,
    entries,
  });
}
