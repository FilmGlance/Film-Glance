// lib/box-office-upsert.ts
//
// Shared upsert + TMDB-enrichment helpers used by both the weekly cron and
// the historical backfill. Keeps the ingestion paths consistent so the same
// row arriving from either source ends up in the same shape in Supabase.

import { supabaseAdmin } from "@/lib/supabase-server";
import { sanitizeQuery } from "@/lib/sanitize";
import { enrichBoxOfficeWithTMDB } from "@/lib/tmdb";
import type { BomRow } from "@/lib/bom-scraper";

export type DataStatus = "estimate" | "actual" | "historical";
export type Region = "domestic" | "international" | "worldwide";
export type PeriodType = "weekly" | "monthly" | "seasonal" | "yearly";
export type Source = "rapidapi" | "apify" | "bom-direct";

export interface UpsertInput {
  row: BomRow;
  periodType: PeriodType;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;   // YYYY-MM-DD
  periodLabel: string;
  region: Region;
  dataStatus: DataStatus;
  source: Source;
}

interface MovieCacheEnrichmentRow {
  search_key: string;
  data: {
    poster_path?: string | null;
    backdrop_path?: string | null;
    year?: number | null;
    tmdb_id?: number | null;
    imdb_id?: string | null;
  };
}

const TMDB_LOOKUP_TIMEOUT_MS = 8000;

/**
 * Pull poster_path + backdrop_path from movie_cache if we already have it,
 * else fall back to a TMDB lookup. Cached values are reused on subsequent
 * ingests of the same title — most BOM Top-10 movies recur across periods,
 * so this caches strongly.
 */
export async function ensurePosterAndBackdrop(
  search_key: string,
  title: string,
  releaseYearHint: number | null
): Promise<{
  poster_path: string | null;
  backdrop_path: string | null;
  tmdb_id: number | null;
  imdb_id: string | null;
}> {
  // Try existing box_office_metrics first (cheapest — same row ingested previously)
  try {
    const prior = await supabaseAdmin
      .from("box_office_metrics")
      .select("poster_path, backdrop_path, tmdb_id, imdb_id")
      .eq("search_key", search_key)
      .not("poster_path", "is", null)
      .limit(1)
      .maybeSingle();
    if (prior.data?.poster_path) {
      return {
        poster_path: prior.data.poster_path,
        backdrop_path: prior.data.backdrop_path ?? null,
        tmdb_id: prior.data.tmdb_id ?? null,
        imdb_id: prior.data.imdb_id ?? null,
      };
    }
  } catch (_err) {
    // fall through
  }

  // Try movie_cache (existing search-result data — has poster but maybe no backdrop)
  try {
    const cached = (await supabaseAdmin
      .from("movie_cache")
      .select("search_key, data")
      .eq("search_key", search_key)
      .maybeSingle()) as { data: MovieCacheEnrichmentRow | null };
    if (cached.data?.data?.poster_path) {
      return {
        poster_path: cached.data.data.poster_path ?? null,
        backdrop_path: cached.data.data.backdrop_path ?? null,
        tmdb_id: cached.data.data.tmdb_id ?? null,
        imdb_id: cached.data.data.imdb_id ?? null,
      };
    }
  } catch (_err) {
    // fall through
  }

  // Final fallback: live TMDB lookup. Best-effort — if it fails we just store nulls.
  try {
    const tmdb = await Promise.race([
      enrichBoxOfficeWithTMDB(title, releaseYearHint ?? undefined),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), TMDB_LOOKUP_TIMEOUT_MS)),
    ]);
    if (tmdb) {
      return {
        poster_path: tmdb.poster_path,
        backdrop_path: tmdb.backdrop_path,
        tmdb_id: tmdb.tmdb_id,
        imdb_id: tmdb.imdb_id,
      };
    }
  } catch (_err) {
    /* swallow */
  }
  return { poster_path: null, backdrop_path: null, tmdb_id: null, imdb_id: null };
}

/**
 * Idempotent upsert of one BomRow into box_office_metrics.
 * Conflict key: (search_key, period_type, period_start, period_end, region).
 */
export async function upsertBoxOfficeRow(input: UpsertInput): Promise<void> {
  const { row, periodType, periodStart, periodEnd, periodLabel, region, dataStatus, source } = input;
  const search_key = sanitizeQuery(row.title);
  const releaseYearHint = inferYearFromReleaseDate(row.releaseDate, periodStart);
  const enrich = await ensurePosterAndBackdrop(search_key, row.title, releaseYearHint);

  const ptaCents = row.pta != null ? Math.round(row.pta * 100) : null;

  const record = {
    search_key,
    title: row.title,
    release_year: releaseYearHint,
    tmdb_id: enrich.tmdb_id,
    imdb_id: enrich.imdb_id,
    poster_path: enrich.poster_path,
    backdrop_path: enrich.backdrop_path,
    period_type: periodType,
    period_start: periodStart,
    period_end: periodEnd,
    period_label: periodLabel,
    region,
    rank: row.rank,
    gross: Math.round(row.gross * 100), // dollars → cents
    theaters: row.theaters,
    pta_cents: ptaCents,
    weeks_released: row.weeksReleased,
    data_status: dataStatus,
    source,
    retrieved_at: new Date().toISOString(),
    raw_payload: row as unknown as Record<string, unknown>,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin
    .from("box_office_metrics")
    .upsert(record, {
      onConflict: "search_key,period_type,period_start,period_end,region",
    });

  if (error) {
    throw new Error(
      `box_office_metrics upsert failed for "${row.title}" (${periodType} ${periodStart}): ${error.message}`,
    );
  }
}

function inferYearFromReleaseDate(rd: string | null, periodStart: string): number | null {
  // BOM "Release Date" cells like "Jun 14" lack year on same-year charts.
  // Use the period start year as the fallback hint (Top-10 of 2024 → year 2024).
  if (rd) {
    const yMatch = rd.match(/\b(19|20)\d{2}\b/);
    if (yMatch) return parseInt(yMatch[0], 10);
  }
  const py = parseInt(periodStart.slice(0, 4), 10);
  return Number.isFinite(py) ? py : null;
}
