-- 013_box_office_metrics.sql
--
-- Top-10 box office facts for the /boxoffice page.
-- Two ingestion sources unified into one schema:
--   • RapidAPI box-office-data-1984-to-2024 — one-shot historical backfill
--   • Apify trovevault/movie-box-office-tracker — ongoing weekly cron (2025+)
--
-- Idempotent upsert keyed on (search_key, period_type, period_start, period_end, region).
-- Sunday weekend estimates get overwritten by Monday actuals via the same key.
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS public.box_office_metrics (
  id BIGSERIAL PRIMARY KEY,

  -- Movie identity (links to movie_cache via search_key for Film Glance score lookup)
  search_key text NOT NULL,             -- normalized via sanitizeQuery() — same key as movie_cache
  title text NOT NULL,                  -- BOM official title (display)
  release_year integer,
  tmdb_id integer,                      -- cached after first enrichWithTMDB() call
  imdb_id text,
  poster_path text,                     -- TMDB poster_path; URL built at render
  backdrop_path text,                   -- TMDB backdrop_path; used for #1 hero card bg

  -- Period
  period_type text NOT NULL CHECK (period_type IN ('weekly','monthly','seasonal','yearly')),
  period_start date NOT NULL,
  period_end date NOT NULL,
  period_label text,                    -- "Apr 26-28, 2026" or "Summer 2025"

  -- Region (designed for v2 International expansion without migration)
  region text NOT NULL CHECK (region IN ('domestic','international','worldwide')),

  -- Numbers (per-row results that the UI renders, not trends)
  rank integer NOT NULL,
  gross bigint NOT NULL,                -- store in cents to avoid float drift; convert at render
  theaters integer,
  pta_cents bigint,                     -- per-theater average. Stored if source provides it directly;
                                        -- else computed at render as (gross / theaters).
  weeks_released integer,

  -- Revision tracking + provenance
  data_status text NOT NULL CHECK (data_status IN ('estimate','actual','historical')),
  source text NOT NULL CHECK (source IN ('rapidapi','apify')),
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  raw_payload jsonb,                    -- full source row, kept for replay/audit

  inserted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (search_key, period_type, period_start, period_end, region)
);

-- Read path: top-N by rank for a given (period_type, region, period_start)
CREATE INDEX IF NOT EXISTS idx_bom_period_region_rank
  ON public.box_office_metrics (period_type, region, period_start DESC, rank);

-- Score-join path: lookup by movie identity
CREATE INDEX IF NOT EXISTS idx_bom_search_key
  ON public.box_office_metrics (search_key);

-- Watchdog path: most-recent retrieval per source/period
CREATE INDEX IF NOT EXISTS idx_bom_retrieved_at
  ON public.box_office_metrics (retrieved_at DESC);

-- Period-navigator path: distinct period_starts available for browsing
CREATE INDEX IF NOT EXISTS idx_bom_period_browse
  ON public.box_office_metrics (period_type, region, period_start);

ALTER TABLE public.box_office_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bom_public_read" ON public.box_office_metrics
  FOR SELECT USING (true);
-- Writes only via service_role (no INSERT/UPDATE/DELETE policy → RLS denies anon)
