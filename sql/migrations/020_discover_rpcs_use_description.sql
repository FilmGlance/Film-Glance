-- Migration 020: discover RPCs read `data->>'description'` (the actual cache
-- field) and surface it as `overview` to the API. Migration 019 introduced
-- the `overview` return-column but mapped it to `data->>'overview'`, which
-- doesn't exist on any cache row — `description` is the field Claude
-- populates. This left every roulette result with a null synopsis.
--
-- v6.4.1 fix-forward (still pre-merge). Idempotent (CREATE OR REPLACE).
--
-- API surface unchanged: routes still see an `overview` column.

DROP FUNCTION IF EXISTS public.discover_movies(text, text, int, boolean, int);
DROP FUNCTION IF EXISTS public.discover_random(int, int, numeric, text);
DROP FUNCTION IF EXISTS public.discover_recent(int);

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
    NULLIF(mc.data->>'description', '') AS overview,
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
    NULLIF(mc.data->>'description', ''),
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
    NULLIF(mc.data->>'description', ''),
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

GRANT EXECUTE ON FUNCTION public.discover_movies(text, text, int, boolean, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.discover_random(int, int, numeric, text)        TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.discover_recent(int)                            TO anon, authenticated;
