-- 012_backfill_favorites_metadata.sql
--
-- One-time backfill for the runtime / director / overview columns added to
-- favorites in migration 011. Copies values from movie_cache.data wherever
-- a favourite has a matching search_key and the destination column is null.
--
-- Source JSON shape (from movie_cache.data, populated by /api/search):
--   { ..., "director": "Gus Van Sant", "runtime": "126 min",
--     "description": "Will Hunting is a janitor...", ... }
--
-- runtime is stored as a "<N> min" string in cache; parse the leading integer
-- via substring + cast.
--
-- Idempotent: only writes columns that are currently null. Safe to re-run.
-- Favourites with no matching cache row stay null and get enriched on the
-- client via /api/enrich-favorites (Claude Sonnet) at sign-in time.

UPDATE public.favorites f
SET
  director = COALESCE(f.director, NULLIF(c.data->>'director', '')),
  overview = COALESCE(f.overview, NULLIF(c.data->>'description', '')),
  runtime  = COALESCE(
    f.runtime,
    NULLIF(substring(c.data->>'runtime' FROM '^(\d+)'), '')::int
  )
FROM public.movie_cache c
WHERE c.search_key = f.search_key
  AND (f.director IS NULL OR f.runtime IS NULL OR f.overview IS NULL);
