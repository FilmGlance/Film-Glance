-- Migration 007: clean degenerate movie_cache rows + add quality filter to
-- the fuzzy_movie_suggestions RPC.
--
-- Background
-- ----------
-- The Did-You-Mean page (`/api/suggest`) merges TMDB results with rows from
-- movie_cache via the `fuzzy_movie_suggestions` RPC (pg_trgm similarity).
-- Pre-v5.9 cache writes (March 2026, before the title-validation gate
-- landed) plus a few Claude-fallback partials left ~10 degenerate rows in
-- the cache: missing year, near-empty source list, hit_count=0. They scored
-- sim=0.5 against typo'd queries like "avatar 2" and surfaced as fake
-- "did you mean..." cards (see 2026-05-06 user report).
--
-- Fix
-- ---
-- 1. Hard delete the junk: rows with no valid year AND fewer than 5 source
--    ratings. Real cached movies have a release year and 7-9 sources; this
--    AND-filter strictly targets the title-stub pattern. None has hit_count
--    > 0, so no user-visible legit data is lost; if anyone re-searches, the
--    SWR pipeline re-runs and writes a fresh row.
-- 2. Add the same filters inside `fuzzy_movie_suggestions` so any future
--    degenerate cache rows can't surface either. Defense in depth.
--
-- Run from Supabase SQL Editor against production. Idempotent.

-- ---- 1. Hard cleanup -------------------------------------------------------

DELETE FROM public.movie_cache
WHERE COALESCE(NULLIF(data->>'year', '')::int, 0) <= 0
  AND jsonb_array_length(COALESCE(data->'sources', '[]'::jsonb)) < 5;

-- ---- 2. Quality-filtered RPC ----------------------------------------------

CREATE OR REPLACE FUNCTION public.fuzzy_movie_suggestions(q text, max_results integer DEFAULT 5)
RETURNS TABLE(title text, year integer, poster_path text, overview text, runtime text, director text, release_date text, sim real)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'extensions'
AS $function$
  WITH matches AS (
    SELECT
      data->>'title' AS title,
      NULLIF(data->>'year', '')::int AS year,
      NULLIF(data->>'poster_path', '') AS poster_path,
      NULLIF(data->>'overview', '') AS overview,
      NULLIF(data->>'runtime', '') AS runtime,
      NULLIF(data->>'director', '') AS director,
      NULLIF(data->>'release_date', '') AS release_date,
      similarity(lower(data->>'title'), lower(q)) AS sim
    FROM public.movie_cache
    WHERE data->>'title' IS NOT NULL
      AND lower(data->>'title') OPERATOR(extensions.%) lower(q)
      -- Quality gate: skip degenerate cache rows (no year / too few sources).
      -- Real movies always have a valid year and 7-9 source ratings; this
      -- blocks the "title-stub" pattern from surfacing in suggestions.
      AND COALESCE(NULLIF(data->>'year', '')::int, 0) BETWEEN 1888 AND 2100
      AND jsonb_array_length(COALESCE(data->'sources', '[]'::jsonb)) >= 5
  )
  SELECT
    (array_agg(title))[1] AS title,
    MAX(year) AS year,
    (array_agg(poster_path) FILTER (WHERE poster_path IS NOT NULL))[1] AS poster_path,
    (array_agg(overview)    FILTER (WHERE overview    IS NOT NULL))[1] AS overview,
    (array_agg(runtime)     FILTER (WHERE runtime     IS NOT NULL))[1] AS runtime,
    (array_agg(director)    FILTER (WHERE director    IS NOT NULL))[1] AS director,
    (array_agg(release_date) FILTER (WHERE release_date IS NOT NULL))[1] AS release_date,
    MAX(sim) AS sim
  FROM matches
  GROUP BY lower(title)
  ORDER BY MAX(sim) DESC
  LIMIT max_results;
$function$;
