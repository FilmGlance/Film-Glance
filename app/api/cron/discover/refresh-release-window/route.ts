// app/api/cron/discover/refresh-release-window/route.ts
//
// Daily cron (04:15 UTC) — refreshes movie_cache.release_window in two
// passes:
//
//   Pass 1: bulk SQL UPDATE re-running the date heuristic. Re-classifies
//           any movie whose release_date crossed the 60-day boundary
//           overnight. Does NOT clobber rows whose release_window was
//           recently set by the TMDB augmentation pass (more accurate
//           signal).
//
//   Pass 2: TMDB watch_providers augmentation for the top 500 by fg_score
//           released in the last 24 months. If TMDB shows any flatrate
//           (subscription) / buy / rent provider for region US → at_home;
//           else (and within 60 days of release) → in_theaters.
//
// v6.4.0. Idempotent. Throttled to ~4 req/s — well under TMDB's rate cap.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { requireCronSecret } from "@/lib/auth-admin";
import { sendAlertEmail, logCronFailure, markCronFailuresResolved } from "@/lib/alert";

export const runtime = "nodejs";
export const maxDuration = 300;

const JOB = "discover-refresh-release-window";
const TMDB_KEY = process.env.TMDB_API_KEY;
const TMDB_DELAY_MS = 250;
const AUGMENT_LIMIT = 500;
const PROTECT_RECENT_DAYS = 7;

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

interface AugmentRow {
  search_key: string;
  tmdb_id: number;
  release_date: string | null;
}

async function classifyViaTMDB(tmdbId: number): Promise<"at_home" | "in_theaters" | "unknown" | null> {
  if (!TMDB_KEY) return null;
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/movie/${tmdbId}/watch/providers?api_key=${TMDB_KEY}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { results?: Record<string, { flatrate?: unknown[]; buy?: unknown[]; rent?: unknown[] }> };
    const us = data.results?.US;
    const hasAtHome = Boolean(us?.flatrate?.length || us?.buy?.length || us?.rent?.length);
    return hasAtHome ? "at_home" : "in_theaters"; // caller will re-check 60-day window for in_theaters fallback
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const denied = requireCronSecret(req);
  if (denied) return denied;

  const tStart = Date.now();
  const summary = { heuristic_updated: 0, tmdb_augmented: 0, tmdb_unknown: 0, errors: 0, ms_total: 0 };

  try {
    // ── Pass 1: bulk heuristic re-run via the discover_refresh_heuristic
    //           RPC (migration 017). Protects rows whose release_window was
    //           set by 'tmdb_providers' within the last PROTECT_RECENT_DAYS
    //           — preserves the more-accurate signal.
    const { data: bulkRes, error: bulkSqlErr } = await supabaseAdmin
      .rpc("discover_refresh_heuristic", { p_protect_recent_days: PROTECT_RECENT_DAYS });
    if (bulkSqlErr) {
      console.warn("[discover-cron] bulk heuristic skipped:", bulkSqlErr.message);
    } else if (Array.isArray(bulkRes) && bulkRes[0]?.updated_count) {
      summary.heuristic_updated = Number(bulkRes[0].updated_count) || 0;
    }

    // ── Pass 2: TMDB augmentation for top fg_score recent releases ──

    // Pull candidates: fg_score IS NOT NULL, recent release_date, has tmdb_id.
    const { data: candidates, error: candErr } = await supabaseAdmin
      .from("movie_cache")
      .select("search_key, data")
      .not("fg_score", "is", null)
      .order("fg_score", { ascending: false })
      .limit(AUGMENT_LIMIT * 2); // overfetch; we filter in JS by release_date and tmdb_id

    if (candErr) {
      throw new Error(`candidate query failed: ${candErr.message}`);
    }

    const cutoffMs = Date.now() - 24 * 30 * 24 * 60 * 60 * 1000; // ~24 months
    const augmentRows: AugmentRow[] = [];
    for (const row of (candidates || []) as Array<{ search_key: string; data: Record<string, unknown> }>) {
      const tmdbId = (row.data?.tmdb_id as number | string | undefined);
      const releaseDate = row.data?.release_date as string | undefined;
      const idNum = typeof tmdbId === "number" ? tmdbId : parseInt(String(tmdbId || ""), 10);
      if (!Number.isFinite(idNum) || idNum <= 0) continue;
      if (!releaseDate) continue;
      const ts = Date.parse(releaseDate);
      if (!Number.isFinite(ts) || ts < cutoffMs) continue;
      augmentRows.push({ search_key: row.search_key, tmdb_id: idNum, release_date: releaseDate });
      if (augmentRows.length >= AUGMENT_LIMIT) break;
    }

    for (const r of augmentRows) {
      try {
        const verdict = await classifyViaTMDB(r.tmdb_id);
        if (!verdict) {
          summary.tmdb_unknown += 1;
          await sleep(TMDB_DELAY_MS);
          continue;
        }
        // If TMDB says no providers (in_theaters fallback), only keep that
        // classification when release_date is actually within the last 60d.
        let release_window: "at_home" | "in_theaters" | "unknown" = verdict;
        if (verdict === "in_theaters") {
          const daysSince = (Date.now() - Date.parse(r.release_date || "0")) / 86400000;
          if (!Number.isFinite(daysSince) || daysSince > 60) release_window = "unknown";
        }
        const { error: updErr } = await supabaseAdmin
          .from("movie_cache")
          .update({
            release_window,
            release_window_source: "tmdb_providers",
            release_window_updated_at: new Date().toISOString(),
          })
          .eq("search_key", r.search_key);
        if (updErr) {
          summary.errors += 1;
        } else {
          summary.tmdb_augmented += 1;
        }
      } catch (err) {
        console.error("[discover-cron] augment error:", r.search_key, err);
        summary.errors += 1;
      }
      await sleep(TMDB_DELAY_MS);
    }

    summary.ms_total = Date.now() - tStart;
    await markCronFailuresResolved(JOB);
    console.log(`[${JOB}] ✓`, summary);
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    summary.ms_total = Date.now() - tStart;
    console.error(`[${JOB}] ✗`, err);
    await logCronFailure(JOB, err, { partialSummary: summary });
    await sendAlertEmail(`${JOB} failed`, err, { partialSummary: summary });
    return NextResponse.json({ ok: false, error: String(err), partialSummary: summary }, { status: 500 });
  }
}
