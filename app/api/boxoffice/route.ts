// app/api/boxoffice/route.ts
//
// Read endpoint for the /boxoffice page. Reads from box_office_metrics +
// joins fg_score from movie_cache.data->'score'->>'ten' for each cached entry.
//
// Query params:
//   period   weekly | monthly | seasonal | yearly  (default 'weekly')
//   region   domestic | international | worldwide  (default 'domestic';
//            international currently has no data — returns empty list)
//   date     YYYY-MM-DD — period_start to display. Default: most recent
//            available period_start for (period, region).
//   limit    1..100 (default 100) — how many ranks to return. v6.7.0 D1
//            lifted the prior hard-cap of 10 after the BOM-deep-rescrape
//            backfilled every period at topN=100.
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
import { calcScore } from "@/lib/score";

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
  director: string | null;
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
  director: string | null;
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

  // v6.7.0 D1 — caller-driven row count. Default 100 to surface the full
  // BOM-deep cache; min 1; hard-cap 100 to keep response size bounded.
  const limitRaw = parseInt(searchParams.get("limit") || "100", 10);
  const limit = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(100, limitRaw))
    : 100;

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

  // 1. Discover available periods.
  //
  // History: round 9 introduced the three-dropdown UI (Year / Month / Week)
  // so we need all THREE period_type catalogs at once. Round 12 switched
  // from `.select()` (subject to PostgREST's `db-max-rows=1000` cap) to the
  // `box_office_periods` RPC, believing the RPC SETOF would return all rows
  // unhindered. Round 14a tried `.range(0, 99999)` on the RPC. Both ideas
  // were wrong, verified empirically against the live DB:
  //
  //   • The RPC's body has an internal `LIMIT 1000` (or PostgREST silently
  //     ignores Range on RPC POST — same effect either way). The RPC returns
  //     exactly 1000 rows regardless of `.range()`.
  //   • `.range(0, 99999)` on a direct `.select()` ALSO doesn't lift the cap
  //     — `db-max-rows` is enforced server-side as a hard ceiling.
  //   • The ONLY reliable way to fetch >1000 rows through PostgREST is to
  //     paginate explicitly in 1000-row chunks.
  //
  // Round 14b fix: paginate the table directly. Each box_office period has
  // exactly 10 movies (rank 1..10), so filtering `rank=1` gives one row per
  // period — natural dedupe with no need for a DISTINCT-on RPC. Loop in
  // 1000-row chunks until we read a short page. Verified end-to-end against
  // the live DB: returns 2,425 weekly + 584 monthly + 195 seasonal + 50
  // yearly distinct rows, oldest weekly 1977, includes 1987-01 / 1994-03 /
  // 2001-02 (the user's reported failures). Total time ~400ms across all 4
  // period types, dominated by 3 weekly round-trips at ~100ms each.
  //
  // The `box_office_periods` RPC is now obsolete and can be dropped from
  // the database in a follow-up migration.
  const PAGE_SIZE = 1000;
  const PAGE_SAFETY_LIMIT = 100; // 100 pages × 1000 rows = 100k row ceiling
  async function fetchAvail(pt: string) {
    const out: { period_start: string; period_label: string }[] = [];
    for (let page = 0; page < PAGE_SAFETY_LIMIT; page++) {
      const from = page * PAGE_SIZE;
      const { data, error } = await supabaseAdmin
        .from("box_office_metrics")
        .select("period_start, period_label")
        .eq("region", region)
        .eq("period_type", pt)
        .eq("rank", 1)
        .order("period_start", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const r of data as any[]) {
        out.push({
          period_start: r.period_start as string,
          period_label: r.period_label as string,
        });
      }
      if (data.length < PAGE_SIZE) break;
    }
    return out;
  }

  let available_yearly: { period_start: string; period_label: string }[] = [];
  let available_monthly: { period_start: string; period_label: string }[] = [];
  let available_weekly: { period_start: string; period_label: string }[] = [];
  let available_seasonal: { period_start: string; period_label: string }[] = [];
  try {
    [available_yearly, available_monthly, available_weekly, available_seasonal] =
      await Promise.all([
        fetchAvail("yearly"),
        fetchAvail("monthly"),
        fetchAvail("weekly"),
        fetchAvail("seasonal"),
      ]);
  } catch (err) {
    console.error("[boxoffice-read] available periods query failed:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  // Currently-selected period's catalog (for the existing API contract)
  const available_periods =
    period === "yearly"
      ? available_yearly
      : period === "monthly"
        ? available_monthly
        : period === "weekly"
          ? available_weekly
          : period === "seasonal"
            ? available_seasonal
            : [];

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
      available_yearly,
      available_monthly,
      available_weekly,
      available_seasonal,
      entries: [],
    });
  }

  // 2. Pick target period_start
  const targetPeriodStart =
    date && available_periods.find((p) => p.period_start === date)
      ? date
      : available_periods[0].period_start;

  // 3. Fetch the Top N rows for that exact period. v6.7.0 D1 — `limit` is
  // caller-driven (default 100). Pre-D1 this was hard-capped at 10 because
  // the BOM cache only stored topN=10; after the bom-deep-rescrape (May 9)
  // every period_start in box_office_metrics holds up to 100 ranks, so the
  // UI can now surface them.
  const { data: rows, error: rowsErr } = await supabaseAdmin
    .from("box_office_metrics")
    .select(
      "search_key, title, release_year, director, poster_path, backdrop_path, rank, gross, theaters, pta_cents, period_label, period_start, period_end, data_status, source, retrieved_at",
    )
    .eq("period_type", period)
    .eq("region", region)
    .eq("period_start", targetPeriodStart)
    .order("rank", { ascending: true })
    .limit(limit);

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
      available_yearly,
      available_monthly,
      available_weekly,
      available_seasonal,
      entries: [],
    });
  }

  // 4. Lookup fg_score for each search_key (batched single query)
  const searchKeys = dbRows.map((r) => r.search_key);
  const { data: cacheRows } = await supabaseAdmin
    .from("movie_cache")
    .select("search_key, data")
    .in("search_key", searchKeys);

  // Score is computed at read time from cached `sources` (the cache stores
  // sources verbatim from Claude+verified-ratings; calcScore aggregates them
  // into the 0-10 figure that /api/search returns). Box-office page does the
  // same calculation here so a cached movie shows the same score everywhere.
  const scoreByKey = new Map<string, number | null>();
  for (const c of (cacheRows || []) as { search_key: string; data: any }[]) {
    const sources = (c.data?.sources as any[]) || [];
    if (sources.length === 0) {
      scoreByKey.set(c.search_key, null);
      continue;
    }
    try {
      const s = calcScore(sources);
      // calcScore returns { ten, fivePoint, percent } — we want the 0-10 value
      const ten = (s as any)?.ten;
      scoreByKey.set(
        c.search_key,
        typeof ten === "number" ? ten : ten != null ? parseFloat(String(ten)) : null,
      );
    } catch {
      scoreByKey.set(c.search_key, null);
    }
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
      director: r.director,
      poster_path: r.poster_path,
      backdrop_path: r.backdrop_path,
      gross: grossDollars,
      theaters: r.theaters,
      pta: ptaDollars,
      fg_score: scoreByKey.get(r.search_key) ?? null,
    };
  });

  const head = dbRows[0];
  const res = NextResponse.json({
    period_type: period,
    region,
    period_label: head.period_label,
    period_start: head.period_start,
    period_end: head.period_end,
    retrieved_at: head.retrieved_at,
    data_status: head.data_status,
    source: head.source,
    available_periods,
    available_yearly,
    available_monthly,
    available_weekly,
    available_seasonal,
    entries,
  });
  // v6.7.0 D7 — edge-cache the box-office response. Data only changes daily
  // after the 11:00 UTC cron, so 10-min s-maxage + 1h SWR is generous and
  // still catches the post-cron refresh quickly. Mirrors the /api/discover
  // posture. Cuts function executions by ~90% under crawler load.
  res.headers.set("Cache-Control", "public, s-maxage=600, stale-while-revalidate=3600");
  return res;
}
