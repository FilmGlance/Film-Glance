// lib/bom-augment.ts (v5.13.2)
//
// Augments search results with Box Office Mojo data from the
// `box_office_metrics` table populated by the weekly cron + historical
// backfill. Only fires for films that appeared in BOM's Top 10 — Claude
// can't supply these numbers for movies released after its training
// cutoff, but our BOM scraper already has them.
//
// Match key: tmdb_id (canonical, no sanitization mismatch). Falls back
// to search_key for older rows that pre-date the tmdb_id column.

import { supabaseAdmin } from "@/lib/supabase-server";

export interface BOMBoxOfficeAugment {
  openingWeekendCents: number | null;  // First weekly entry (post-release debut)
  theatersOpening: number | null;
  ptaOpeningCents: number | null;
  domesticTotalCents: number | null;   // Sum of yearly entries (or monthlies fallback)
  daysInTheater: number | null;        // Count of distinct weekly periods
}

export async function fetchBOMBoxOffice(
  tmdbId: number | null,
  searchKey: string | null,
): Promise<BOMBoxOfficeAugment | null> {
  if (!tmdbId && !searchKey) return null;

  // Build the lookup filter — prefer tmdb_id, fall back to search_key.
  let baseQuery = supabaseAdmin
    .from("box_office_metrics")
    .select("period_type, period_start, gross, theaters, pta_cents")
    .eq("region", "domestic");
  if (tmdbId) {
    baseQuery = baseQuery.eq("tmdb_id", tmdbId);
  } else if (searchKey) {
    baseQuery = baseQuery.eq("search_key", searchKey);
  }

  const { data: rows, error } = await baseQuery;
  if (error || !rows || rows.length === 0) return null;

  // First weekly entry by period_start = opening week debut.
  const weekly = rows
    .filter((r) => r.period_type === "weekly")
    .sort((a, b) => (a.period_start || "").localeCompare(b.period_start || ""));
  const opening = weekly[0];

  // Domestic total: prefer yearly entries (sum across years for multi-year
  // runs); else fall back to monthly sum.
  const yearly = rows.filter((r) => r.period_type === "yearly");
  const monthly = rows.filter((r) => r.period_type === "monthly");
  let domesticTotalCents: number | null = null;
  if (yearly.length > 0) {
    domesticTotalCents = yearly.reduce((acc, r) => acc + Number(r.gross || 0), 0);
  } else if (monthly.length > 0) {
    domesticTotalCents = monthly.reduce((acc, r) => acc + Number(r.gross || 0), 0);
  } else if (weekly.length > 0) {
    // Last resort: sum weekly. Less accurate (BOM weeks overlap month
    // boundaries) but better than nothing.
    domesticTotalCents = weekly.reduce((acc, r) => acc + Number(r.gross || 0), 0);
  }

  // Days in theater: weekly entries × 7 is a coarse estimate; distinct
  // period_starts is more accurate.
  const distinctWeeks = new Set(weekly.map((r) => r.period_start)).size;
  const daysInTheater = distinctWeeks > 0 ? distinctWeeks * 7 : null;

  if (!opening && !domesticTotalCents) return null;

  return {
    openingWeekendCents: opening?.gross != null ? Number(opening.gross) : null,
    theatersOpening: opening?.theaters != null ? Number(opening.theaters) : null,
    ptaOpeningCents: opening?.pta_cents != null ? Number(opening.pta_cents) : null,
    domesticTotalCents,
    daysInTheater,
  };
}

// Format cents → "$X,XXX,XXX" string matching Claude's output convention
// so the UI BoxOfficeRow component renders both consistently.
export function formatCentsAsDollarString(cents: number | null): string | null {
  if (cents == null || cents <= 0) return null;
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

export function formatDollarsAsDollarString(dollars: number | null): string | null {
  if (dollars == null || dollars <= 0) return null;
  return `$${Math.round(dollars).toLocaleString("en-US")}`;
}
