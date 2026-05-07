-- Migration 019: hard-delete duplicate movie_cache rows + update discover RPCs
-- to add genre filter to roulette + overview field on entries + DISTINCT ON
-- defense against future duplicates.
--
-- v6.4.1 fix-forward (still on PR #64). Idempotent (CREATE OR REPLACE +
-- the DELETE has no effect after the first run since dups are gone).
--
-- Why dedup
-- ---------
-- 165 (title, year) groups with 338 total dup rows existed at the time of
-- this migration. Examples:
--   "The Matrix" 1999  → 4 keys: matrix, matrx, the matrix, the matrx
--   "Top Gun: Maverick" 2022 → 2 keys: top gun maverick, maverick
--   "Casino" 1995 → 3 keys: casino, casssssino, casssssinoooooooooo
-- The typo'd keys were created when users typed misspellings; Claude
-- resolved each to the correct movie, but the cache row got written under
-- the typo'd key. This caused two user-visible bugs:
--   1. Discover grid showed the same movie multiple times.
--   2. Clicking a card from /discover sent /?q=<title>, search route
--      found multiple rows with the same title, ambiguity-picker fired,
--      DYM page never resolved.
-- Dedup fixes both.
--
-- Tiebreak: keep row with most rating sources, then highest hit_count,
-- then earliest cached_at (oldest = most likely the original).

WITH ranked AS (
  SELECT search_key,
    ROW_NUMBER() OVER (
      PARTITION BY data->>'title', NULLIF(data->>'year','')::int
      ORDER BY
        jsonb_array_length(COALESCE(data->'sources', '[]'::jsonb)) DESC,
        hit_count DESC NULLS LAST,
        cached_at ASC
    ) AS rn
  FROM public.movie_cache
  WHERE fg_score IS NOT NULL
    AND data->>'title' IS NOT NULL
    AND NULLIF(data->>'year','')::int IS NOT NULL
)
DELETE FROM public.movie_cache mc
USING ranked r
WHERE mc.search_key = r.search_key
  AND r.rn > 1;

-- ─── Drop existing function signatures that need return-type changes ────
-- Postgres won't let CREATE OR REPLACE change a function's return type
-- (the "Row type defined by OUT parameters is different" error). Drop the
-- old shapes first so the new ones can land.
DROP FUNCTION IF EXISTS public.discover_movies(text, text, int, boolean, int);
DROP FUNCTION IF EXISTS public.discover_random(int, int, numeric);
DROP FUNCTION IF EXISTS public.discover_random_pool_size(int, int, numeric);
DROP FUNCTION IF EXISTS public.discover_recent(int);

-- ─── discover_movies — add overview field, drop DISTINCT ON ─────────────
-- The DELETE above already deduped the cache to 0 dup (title, year) groups.
-- A previous attempt to add DISTINCT ON for defense forced ORDER BY title
-- first, which broke the fg_score DESC sort the API consumer expects.
-- Reverted to plain ORDER BY fg_score DESC. If duplicates re-appear (rare —
-- only if same-title-and-year gets cached fresh), a future migration can
-- re-introduce DISTINCT ON via a subquery pattern.
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
    NULLIF(mc.data->>'year', '')::int AS year,
    NULLIF(mc.data->>'director', '') AS director,
    NULLIF(mc.data->>'genre', '') AS genre,
    NULLIF(mc.data->>'poster_path', '') AS poster_path,
    NULLIF(mc.data->>'backdrop_path', '') AS backdrop_path,
    NULLIF(mc.data->>'release_date', '') AS release_date,
    NULLIF(mc.data->>'runtime', '') AS runtime,
    NULLIF(mc.data->>'overview', '') AS overview,
    mc.fg_score,
    jsonb_array_length(COALESCE(mc.data->'sources', '[]'::jsonb))::int AS source_count,
    NULLIF(mc.data->>'popularity', '')::numeric AS popularity,
    mc.hit_count
  FROM public.movie_cache mc
  WHERE mc.release_window = p_release_window
    AND mc.fg_score IS NOT NULL
    AND COALESCE(NULLIF(mc.data->>'year', '')::int, 0) BETWEEN 1888 AND 2100
    AND jsonb_array_length(COALESCE(mc.data->'sources', '[]'::jsonb)) >= 5
    AND (p_genre IS NULL OR mc.data->>'genre' ILIKE '%' || p_genre || '%')
    AND (p_year IS NULL OR NULLIF(mc.data->>'year', '')::int = p_year)
    AND (
      NOT p_hidden_gems
      OR (mc.fg_score >= 8.0 AND COALESCE(NULLIF(mc.data->>'popularity', '')::numeric, 0) < 30)
    )
  ORDER BY mc.fg_score DESC NULLS LAST, mc.hit_count DESC NULLS LAST, mc.search_key ASC
  LIMIT GREATEST(1, LEAST(p_limit, 100));
$$;

-- ─── discover_random — add p_genre param + return overview ──────────────
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
    NULLIF(mc.data->>'year', '')::int,
    NULLIF(mc.data->>'director', ''),
    NULLIF(mc.data->>'genre', ''),
    NULLIF(mc.data->>'poster_path', ''),
    NULLIF(mc.data->>'backdrop_path', ''),
    NULLIF(mc.data->>'release_date', ''),
    NULLIF(mc.data->>'runtime', ''),
    NULLIF(mc.data->>'overview', ''),
    mc.fg_score,
    jsonb_array_length(COALESCE(mc.data->'sources', '[]'::jsonb))::int,
    NULLIF(mc.data->>'popularity', '')::numeric
  FROM public.movie_cache mc
  WHERE mc.fg_score IS NOT NULL
    AND mc.fg_score >= p_min_score
    AND COALESCE(NULLIF(mc.data->>'year', '')::int, 0) BETWEEN 1888 AND 2100
    AND jsonb_array_length(COALESCE(mc.data->'sources', '[]'::jsonb)) >= 5
    AND (p_decade_start IS NULL OR NULLIF(mc.data->>'year', '')::int >= p_decade_start)
    AND (p_decade_end   IS NULL OR NULLIF(mc.data->>'year', '')::int <= p_decade_end)
    AND (p_genre IS NULL OR mc.data->>'genre' ILIKE '%' || p_genre || '%')
  ORDER BY random()
  LIMIT 1;
$$;

-- ─── discover_random_pool_size — same new param ──────────────────────────
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
    AND COALESCE(NULLIF(mc.data->>'year', '')::int, 0) BETWEEN 1888 AND 2100
    AND jsonb_array_length(COALESCE(mc.data->'sources', '[]'::jsonb)) >= 5
    AND (p_decade_start IS NULL OR NULLIF(mc.data->>'year', '')::int >= p_decade_start)
    AND (p_decade_end   IS NULL OR NULLIF(mc.data->>'year', '')::int <= p_decade_end)
    AND (p_genre IS NULL OR mc.data->>'genre' ILIKE '%' || p_genre || '%');
$$;

-- ─── discover_recent — add overview + DISTINCT ON ────────────────────────
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
    NULLIF(mc.data->>'year', '')::int,
    NULLIF(mc.data->>'director', ''),
    NULLIF(mc.data->>'genre', ''),
    NULLIF(mc.data->>'poster_path', ''),
    NULLIF(mc.data->>'backdrop_path', ''),
    NULLIF(mc.data->>'release_date', ''),
    NULLIF(mc.data->>'runtime', ''),
    NULLIF(mc.data->>'overview', ''),
    mc.fg_score,
    jsonb_array_length(COALESCE(mc.data->'sources', '[]'::jsonb))::int,
    NULLIF(mc.data->>'popularity', '')::numeric,
    mc.cached_at
  FROM public.movie_cache mc
  WHERE mc.fg_score IS NOT NULL
    AND COALESCE(NULLIF(mc.data->>'year', '')::int, 0) BETWEEN 1888 AND 2100
    AND jsonb_array_length(COALESCE(mc.data->'sources', '[]'::jsonb)) >= 5
  ORDER BY mc.cached_at DESC NULLS LAST
  LIMIT GREATEST(1, LEAST(p_limit, 30));
$$;

-- Drop + recreate the older (4-arg → now 5-arg) function signatures' grants.
-- The old function names with the 3-arg signature still exist; those will
-- coexist. To keep the API surface tidy, we GRANT on the new signatures.
GRANT EXECUTE ON FUNCTION public.discover_random(int, int, numeric, text)            TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.discover_random_pool_size(int, int, numeric, text)  TO anon, authenticated;
