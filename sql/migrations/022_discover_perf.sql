-- Migration 022: denormalize `popularity` / `source_count` / `release_year`
-- onto `movie_cache` + rewrite the discover_* RPCs to read those columns
-- instead of digging into the `data` JSONB on every row.
--
-- v6.7.0 D4 (replaces the v6.7.0 band-aid hotfix in `app/api/discover/route.ts`
-- that switched edge→nodejs + 30s + Promise.allSettled — that change keeps the
-- page from gateway-timing-out today; this migration is the actual fix).
--
-- Background
-- ----------
-- Phase C grew movie_cache 9,180 → 24,915 rows (+172%). The discover_movies
-- RPC has three JSONB extractions per row in its WHERE clause:
--
--   • NULLIF(data->>'year','')::int BETWEEN 1888 AND 2100
--   • jsonb_array_length(data->'sources') >= 5
--   • NULLIF(data->>'popularity','')::numeric < 30   (only on hidden_gems path)
--
-- Plus three more in the SELECT (popularity, year, source_count again). At
-- 9k rows the per-row JSONB cost was tolerable (~400ms); at 25k it became
-- ~4.2s and started tripping Vercel's edge 25s gateway during cold-start.
-- The composite index on (release_window, fg_score DESC) couldn't carry the
-- query alone because the JSONB predicates kept it from being an index-only
-- scan.
--
-- This migration
-- --------------
-- 1. Adds three denormalized columns: `popularity NUMERIC`, `source_count INT
--    NOT NULL DEFAULT 0`, `release_year INT`.
-- 2. Trigger keeps them in lockstep with `data` on every INSERT/UPDATE OF
--    data — same pattern as migration 016's fg_score trigger.
-- 3. One-shot backfill for the existing 24,915 rows.
-- 4. Composite partial index on the discover hot-path: (release_window,
--    fg_score DESC) WHERE the quality gate passes — turns the discover_movies
--    WHERE into a pure-index scan.
-- 5. Rewrites discover_movies / discover_genres / discover_random /
--    discover_random_pool_size / discover_recent / discover_years to read
--    the new columns. Function signatures + return types are unchanged —
--    transparent to `app/api/discover/route.ts`.
--
-- Expected impact: ~4.2s → ~200ms on the entries RPC under current cache
-- size. Cushion for ongoing cache growth too.
--
-- Run from Supabase SQL Editor against production. Idempotent.

-- ─── 1. Columns ───────────────────────────────────────────────────────────
ALTER TABLE public.movie_cache
  ADD COLUMN IF NOT EXISTS popularity NUMERIC,
  ADD COLUMN IF NOT EXISTS source_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS release_year INT;

-- ─── 2. Trigger: keep columns in lockstep with data ───────────────────────
-- Casting-safe — empty strings / non-numeric / malformed dates return NULL
-- rather than aborting the write. This matters because `data->>'year'`
-- and `data->>'popularity'` are user-derived (Claude / TMDB) and have
-- historically been "" for unreleased films or rows that pre-date the
-- v5.13.x year-resolution work.
CREATE OR REPLACE FUNCTION public.movie_cache_set_denorm()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_year_text text;
  v_pop_text text;
BEGIN
  v_year_text := NULLIF(NEW.data->>'year', '');
  v_pop_text  := NULLIF(NEW.data->>'popularity', '');

  BEGIN
    NEW.release_year := v_year_text::int;
  EXCEPTION WHEN others THEN
    NEW.release_year := NULL;
  END;

  BEGIN
    NEW.popularity := v_pop_text::numeric;
  EXCEPTION WHEN others THEN
    NEW.popularity := NULL;
  END;

  -- jsonb_array_length is null-safe via the COALESCE wrapper; 0 when sources
  -- is missing entirely.
  NEW.source_count := jsonb_array_length(
    CASE
      WHEN jsonb_typeof(NEW.data->'sources') = 'array' THEN NEW.data->'sources'
      ELSE '[]'::jsonb
    END
  )::int;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS movie_cache_denorm_trg ON public.movie_cache;
CREATE TRIGGER movie_cache_denorm_trg
  BEFORE INSERT OR UPDATE OF data ON public.movie_cache
  FOR EACH ROW
  EXECUTE FUNCTION public.movie_cache_set_denorm();

-- ─── 3. One-shot backfill ─────────────────────────────────────────────────
-- Touches every row so the trigger fires. Single statement is fine at
-- 25k rows (<10s in Supabase). After this runs once, every subsequent
-- INSERT/UPDATE through the trigger maintains the columns automatically.
UPDATE public.movie_cache SET
  release_year = CASE
    WHEN NULLIF(data->>'year','') ~ '^-?\d+$' THEN NULLIF(data->>'year','')::int
    ELSE NULL
  END,
  popularity = CASE
    WHEN NULLIF(data->>'popularity','') ~ '^-?\d+(\.\d+)?$' THEN NULLIF(data->>'popularity','')::numeric
    ELSE NULL
  END,
  source_count = jsonb_array_length(
    CASE
      WHEN jsonb_typeof(data->'sources') = 'array' THEN data->'sources'
      ELSE '[]'::jsonb
    END
  )::int;

-- ─── 4. Indexes ───────────────────────────────────────────────────────────
-- The discover_movies hot path: WHERE release_window=? AND fg_score IS NOT
-- NULL AND source_count >= 5 AND release_year BETWEEN 1888 AND 2100,
-- ORDER BY fg_score DESC. Partial index materializes the quality gate so
-- the planner can do an index-only sort.
CREATE INDEX IF NOT EXISTS idx_movie_cache_discover_v2
  ON public.movie_cache (release_window, fg_score DESC NULLS LAST)
  WHERE fg_score IS NOT NULL
    AND source_count >= 5
    AND release_year BETWEEN 1888 AND 2100;

-- For p_year filter (rare but slow when used) — narrows the partial.
CREATE INDEX IF NOT EXISTS idx_movie_cache_discover_year
  ON public.movie_cache (release_window, release_year, fg_score DESC NULLS LAST)
  WHERE fg_score IS NOT NULL
    AND source_count >= 5;

-- For discover_recent's ORDER BY cached_at — already partial-quality-gated.
CREATE INDEX IF NOT EXISTS idx_movie_cache_discover_recent
  ON public.movie_cache (cached_at DESC NULLS LAST)
  WHERE fg_score IS NOT NULL
    AND source_count >= 5
    AND release_year BETWEEN 1888 AND 2100;

-- ─── 5. Rewrite the discover_* RPCs ───────────────────────────────────────
-- Function shapes (params, return types) are unchanged so the API surface
-- (`app/api/discover/route.ts`) doesn't need to ship in lockstep. The only
-- thing that changes is the WHERE clause — JSONB extractions replaced with
-- column reads — and the SELECT pulls the column instead of recomputing.

DROP FUNCTION IF EXISTS public.discover_movies(text, text, int, boolean, int);
DROP FUNCTION IF EXISTS public.discover_random(int, int, numeric, text);
DROP FUNCTION IF EXISTS public.discover_random_pool_size(int, int, numeric, text);
DROP FUNCTION IF EXISTS public.discover_recent(int);
DROP FUNCTION IF EXISTS public.discover_years(text, text);
DROP FUNCTION IF EXISTS public.discover_genres();

CREATE OR REPLACE FUNCTION public.discover_movies(
  p_release_window text,
  p_genre text DEFAULT NULL,
  p_year int DEFAULT NULL,
  p_hidden_gems boolean DEFAULT FALSE,
  p_limit int DEFAULT 100
)
RETURNS TABLE (
  search_key text,
  title text,
  year int,
  director text,
  genre text,
  poster_path text,
  backdrop_path text,
  release_date text,
  runtime text,
  overview text,
  fg_score numeric,
  source_count int,
  popularity numeric,
  hit_count int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    mc.search_key,
    mc.data->>'title' AS title,
    mc.release_year AS year,
    NULLIF(mc.data->>'director', '') AS director,
    NULLIF(mc.data->>'genre', '') AS genre,
    NULLIF(mc.data->>'poster_path', '') AS poster_path,
    NULLIF(mc.data->>'backdrop_path', '') AS backdrop_path,
    NULLIF(mc.data->>'release_date', '') AS release_date,
    NULLIF(mc.data->>'runtime', '') AS runtime,
    NULLIF(mc.data->>'description', '') AS overview,
    mc.fg_score,
    mc.source_count,
    mc.popularity,
    mc.hit_count
  FROM public.movie_cache mc
  WHERE mc.release_window = p_release_window
    AND mc.fg_score IS NOT NULL
    AND mc.source_count >= 5
    AND mc.release_year BETWEEN 1888 AND 2100
    AND (p_genre IS NULL OR mc.data->>'genre' ILIKE '%' || p_genre || '%')
    AND (p_year IS NULL OR mc.release_year = p_year)
    AND (
      NOT p_hidden_gems
      OR (mc.fg_score >= 8.0 AND COALESCE(mc.popularity, 0) < 30)
    )
  ORDER BY mc.fg_score DESC NULLS LAST, mc.hit_count DESC NULLS LAST, mc.search_key ASC
  LIMIT GREATEST(1, LEAST(p_limit, 100));
$$;

CREATE OR REPLACE FUNCTION public.discover_random(
  p_decade_start int DEFAULT NULL,
  p_decade_end int DEFAULT NULL,
  p_min_score numeric DEFAULT 8.0,
  p_genre text DEFAULT NULL
)
RETURNS TABLE (
  search_key text,
  title text,
  year int,
  director text,
  genre text,
  poster_path text,
  backdrop_path text,
  release_date text,
  runtime text,
  overview text,
  fg_score numeric,
  source_count int,
  popularity numeric
)
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    mc.search_key,
    mc.data->>'title',
    mc.release_year,
    NULLIF(mc.data->>'director', ''),
    NULLIF(mc.data->>'genre', ''),
    NULLIF(mc.data->>'poster_path', ''),
    NULLIF(mc.data->>'backdrop_path', ''),
    NULLIF(mc.data->>'release_date', ''),
    NULLIF(mc.data->>'runtime', ''),
    NULLIF(mc.data->>'description', ''),
    mc.fg_score,
    mc.source_count,
    mc.popularity
  FROM public.movie_cache mc
  WHERE mc.fg_score IS NOT NULL
    AND mc.fg_score >= p_min_score
    AND mc.source_count >= 5
    AND mc.release_year BETWEEN 1888 AND 2100
    AND (p_decade_start IS NULL OR mc.release_year >= p_decade_start)
    AND (p_decade_end   IS NULL OR mc.release_year <= p_decade_end)
    AND (p_genre IS NULL OR mc.data->>'genre' ILIKE '%' || p_genre || '%')
  ORDER BY random()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.discover_random_pool_size(
  p_decade_start int DEFAULT NULL,
  p_decade_end int DEFAULT NULL,
  p_min_score numeric DEFAULT 8.0,
  p_genre text DEFAULT NULL
)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COUNT(*)
  FROM public.movie_cache mc
  WHERE mc.fg_score IS NOT NULL
    AND mc.fg_score >= p_min_score
    AND mc.source_count >= 5
    AND mc.release_year BETWEEN 1888 AND 2100
    AND (p_decade_start IS NULL OR mc.release_year >= p_decade_start)
    AND (p_decade_end   IS NULL OR mc.release_year <= p_decade_end)
    AND (p_genre IS NULL OR mc.data->>'genre' ILIKE '%' || p_genre || '%');
$$;

CREATE OR REPLACE FUNCTION public.discover_recent(p_limit int DEFAULT 10)
RETURNS TABLE (
  search_key text,
  title text,
  year int,
  director text,
  genre text,
  poster_path text,
  backdrop_path text,
  release_date text,
  runtime text,
  overview text,
  fg_score numeric,
  source_count int,
  popularity numeric,
  cached_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    mc.search_key,
    mc.data->>'title',
    mc.release_year,
    NULLIF(mc.data->>'director', ''),
    NULLIF(mc.data->>'genre', ''),
    NULLIF(mc.data->>'poster_path', ''),
    NULLIF(mc.data->>'backdrop_path', ''),
    NULLIF(mc.data->>'release_date', ''),
    NULLIF(mc.data->>'runtime', ''),
    NULLIF(mc.data->>'description', ''),
    mc.fg_score,
    mc.source_count,
    mc.popularity,
    mc.cached_at
  FROM public.movie_cache mc
  WHERE mc.fg_score IS NOT NULL
    AND mc.source_count >= 5
    AND mc.release_year BETWEEN 1888 AND 2100
  ORDER BY mc.cached_at DESC NULLS LAST
  LIMIT GREATEST(1, LEAST(p_limit, 30));
$$;

CREATE OR REPLACE FUNCTION public.discover_years(
  p_release_window text,
  p_genre text DEFAULT NULL
)
RETURNS TABLE (year int, n bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    mc.release_year AS year,
    COUNT(*) AS n
  FROM public.movie_cache mc
  WHERE mc.release_window = p_release_window
    AND mc.fg_score IS NOT NULL
    AND mc.source_count >= 5
    AND mc.release_year BETWEEN 1888 AND 2100
    AND (p_genre IS NULL OR mc.data->>'genre' ILIKE '%' || p_genre || '%')
  GROUP BY mc.release_year
  ORDER BY year DESC;
$$;

CREATE OR REPLACE FUNCTION public.discover_genres()
RETURNS TABLE (genre text, n bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH split AS (
    SELECT trim(g) AS g
    FROM public.movie_cache mc,
         LATERAL regexp_split_to_table(COALESCE(mc.data->>'genre', ''), ' · ') AS g
    WHERE mc.fg_score IS NOT NULL
      AND mc.source_count >= 5
      AND mc.release_year BETWEEN 1888 AND 2100
  )
  SELECT g AS genre, COUNT(*) AS n
  FROM split
  WHERE g <> ''
  GROUP BY g
  ORDER BY n DESC;
$$;

-- ─── Re-grant EXECUTE — same posture as migration 020 ─────────────────────
GRANT EXECUTE ON FUNCTION public.discover_movies(text, text, int, boolean, int)        TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.discover_random(int, int, numeric, text)              TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.discover_random_pool_size(int, int, numeric, text)    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.discover_recent(int)                                  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.discover_years(text, text)                            TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.discover_genres()                                     TO anon, authenticated;

-- Sanity-check helper queries (un-comment to inspect after running):
-- SELECT COUNT(*) FROM public.movie_cache WHERE source_count IS NULL;            -- expect 0
-- SELECT COUNT(*) FROM public.movie_cache WHERE source_count >= 5
--   AND release_year BETWEEN 1888 AND 2100 AND fg_score IS NOT NULL;             -- expect ~discover_movies pool
-- EXPLAIN ANALYZE SELECT * FROM discover_movies('at_home', NULL, NULL, false, 100);  -- expect <250ms
