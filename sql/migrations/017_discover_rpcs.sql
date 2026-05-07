-- Migration 017: RPC functions backing the new /discover page.
--
-- v6.4.0. Idempotent (CREATE OR REPLACE + DROP IF EXISTS for grants).
--
-- All three functions are STABLE/VOLATILE-tagged appropriately, locked to
-- search_path = public, pg_temp (audit Phase A pattern), and granted EXECUTE
-- only to anon + authenticated (browsing the discover page is anonymous OK,
-- but service_role doesn't need them — it can query movie_cache directly).
--
-- Quality gate (shared across all three): year between 1888 and 2100,
-- jsonb_array_length(data->'sources') >= 5, fg_score IS NOT NULL.

-- ─── discover_movies — list 100 ranked films ─────────────────────────────
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
  fg_score numeric,
  source_count int,
  popularity numeric,
  hit_count int
)
LANGUAGE sql
STABLE
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

-- ─── discover_genres — distinct genre dropdown options ───────────────────
CREATE OR REPLACE FUNCTION public.discover_genres()
RETURNS TABLE (genre text, n bigint)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  WITH split AS (
    SELECT trim(g) AS g
    FROM public.movie_cache mc,
         LATERAL regexp_split_to_table(COALESCE(mc.data->>'genre', ''), ' · ') AS g
    WHERE mc.fg_score IS NOT NULL
      AND COALESCE(NULLIF(mc.data->>'year', '')::int, 0) BETWEEN 1888 AND 2100
      AND jsonb_array_length(COALESCE(mc.data->'sources', '[]'::jsonb)) >= 5
  )
  SELECT g AS genre, COUNT(*) AS n
  FROM split
  WHERE g <> ''
  GROUP BY g
  ORDER BY n DESC;
$$;

-- ─── discover_random — Movie Reel Roulette ───────────────────────────────
CREATE OR REPLACE FUNCTION public.discover_random(
  p_decade_start int DEFAULT NULL,
  p_decade_end int DEFAULT NULL,
  p_min_score numeric DEFAULT 8.0
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
  fg_score numeric,
  source_count int,
  popularity numeric
)
LANGUAGE sql
VOLATILE  -- random() is volatile
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
  ORDER BY random()
  LIMIT 1;
$$;

-- ─── discover_random_pool_size — fast count for "spinning from N films" ──
-- Avoids fetching a row when we just want the candidate-pool size.
CREATE OR REPLACE FUNCTION public.discover_random_pool_size(
  p_decade_start int DEFAULT NULL,
  p_decade_end int DEFAULT NULL,
  p_min_score numeric DEFAULT 8.0
)
RETURNS bigint
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COUNT(*)
  FROM public.movie_cache mc
  WHERE mc.fg_score IS NOT NULL
    AND mc.fg_score >= p_min_score
    AND COALESCE(NULLIF(mc.data->>'year', '')::int, 0) BETWEEN 1888 AND 2100
    AND jsonb_array_length(COALESCE(mc.data->'sources', '[]'::jsonb)) >= 5
    AND (p_decade_start IS NULL OR NULLIF(mc.data->>'year', '')::int >= p_decade_start)
    AND (p_decade_end   IS NULL OR NULLIF(mc.data->>'year', '')::int <= p_decade_end);
$$;

-- ─── discover_years — distinct years for the year-dropdown (per filter) ─
CREATE OR REPLACE FUNCTION public.discover_years(
  p_release_window text,
  p_genre text DEFAULT NULL
)
RETURNS TABLE (year int, n bigint)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT
    NULLIF(mc.data->>'year', '')::int AS year,
    COUNT(*) AS n
  FROM public.movie_cache mc
  WHERE mc.release_window = p_release_window
    AND mc.fg_score IS NOT NULL
    AND COALESCE(NULLIF(mc.data->>'year', '')::int, 0) BETWEEN 1888 AND 2100
    AND jsonb_array_length(COALESCE(mc.data->'sources', '[]'::jsonb)) >= 5
    AND (p_genre IS NULL OR mc.data->>'genre' ILIKE '%' || p_genre || '%')
  GROUP BY NULLIF(mc.data->>'year', '')::int
  HAVING NULLIF(mc.data->>'year', '')::int IS NOT NULL
  ORDER BY year DESC;
$$;

-- ─── discover_recent — last N cached films passing the quality gate ─────
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
  fg_score numeric,
  source_count int,
  popularity numeric,
  cached_at timestamptz
)
LANGUAGE sql
STABLE
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

-- ─── discover_refresh_heuristic — bulk re-classify via 60-day rule ───────
-- Called by /api/cron/discover/refresh-release-window. Only updates rows
-- whose release_window was last set by 'date_heuristic' OR by 'tmdb_providers'
-- more than `p_protect_recent_days` days ago — protects fresh TMDB classifications.
-- Returns the row count for cron summary logging.
CREATE OR REPLACE FUNCTION public.discover_refresh_heuristic(
  p_protect_recent_days int DEFAULT 7
)
RETURNS TABLE (updated_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count bigint;
BEGIN
  WITH upd AS (
    UPDATE public.movie_cache SET
      release_window = CASE
        WHEN data->>'release_date' IS NOT NULL AND data->>'release_date' <> '' THEN
          CASE
            WHEN (data->>'release_date')::date > now()::date THEN 'unreleased'
            WHEN (data->>'release_date')::date >= now()::date - INTERVAL '60 days' THEN 'in_theaters'
            ELSE 'at_home'
          END
        WHEN NULLIF(data->>'year', '')::int > EXTRACT(YEAR FROM now())::int THEN 'unreleased'
        ELSE 'at_home'
      END,
      release_window_source = 'date_heuristic',
      release_window_updated_at = now()
    WHERE
      release_window_source IS NULL
      OR release_window_source = 'date_heuristic'
      OR (release_window_source = 'tmdb_providers'
          AND release_window_updated_at < now() - (p_protect_recent_days || ' days')::interval)
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM upd;
  RETURN QUERY SELECT v_count;
END;
$$;

-- ─── Grant EXECUTE — most to anon+authenticated, refresh-heuristic only to service_role (cron-only) ────
GRANT EXECUTE ON FUNCTION public.discover_movies(text, text, int, boolean, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.discover_genres() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.discover_random(int, int, numeric) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.discover_random_pool_size(int, int, numeric) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.discover_recent(int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.discover_years(text, text) TO anon, authenticated;
-- discover_refresh_heuristic is server-job-only — explicitly REVOKE from public + grant only to service_role.
REVOKE EXECUTE ON FUNCTION public.discover_refresh_heuristic(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.discover_refresh_heuristic(int) TO service_role;
