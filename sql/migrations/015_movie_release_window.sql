-- Migration 015: classify each cached movie as 'in_theaters' / 'at_home' /
-- 'unreleased' / 'unknown' so the new /discover page can filter by where
-- the user can actually watch the film right now.
--
-- v6.4.0 (audit-style data migration). Idempotent.
--
-- Bulk classification is a date heuristic (release_date within last 60 days
-- = in theaters; else at_home; future = unreleased; missing = unknown). This
-- is correct for the vast majority of films but mis-classifies limited
-- releases / awards holdovers; a daily cron at /api/cron/discover augments
-- the top 500 by fg_score with TMDB watch_providers data, which is more
-- accurate. The `release_window_source` column distinguishes the two paths
-- so the cron can avoid clobbering its own better answers with the cruder
-- date rule.

ALTER TABLE public.movie_cache
  ADD COLUMN IF NOT EXISTS release_window TEXT
    CHECK (release_window IS NULL OR release_window IN ('in_theaters','at_home','unreleased','unknown')),
  ADD COLUMN IF NOT EXISTS release_window_source TEXT
    CHECK (release_window_source IS NULL OR release_window_source IN ('date_heuristic','tmdb_providers','manual')),
  ADD COLUMN IF NOT EXISTS release_window_updated_at TIMESTAMPTZ;

-- Initial backfill via 60-day date heuristic. Most cached movies pre-date
-- v5.13.x's release_date persistence (only ~33 of 5,702 rows have one), so
-- the bulk fallback uses `data->>year` and defaults to 'at_home' for
-- anything without a recent release_date. The daily cron's TMDB
-- watch_providers pass corrects the top 500 by fg_score across the last
-- 24 months, which is where "in_theaters" accuracy actually matters.
UPDATE public.movie_cache SET
  release_window = CASE
    -- Path 1: recent release_date present → precise classification
    WHEN data->>'release_date' IS NOT NULL AND data->>'release_date' <> '' THEN
      CASE
        WHEN (data->>'release_date')::date > now()::date THEN 'unreleased'
        WHEN (data->>'release_date')::date >= now()::date - INTERVAL '60 days' THEN 'in_theaters'
        ELSE 'at_home'
      END
    -- Path 2: year > current year → unreleased
    WHEN NULLIF(data->>'year', '')::int > EXTRACT(YEAR FROM now())::int THEN 'unreleased'
    -- Path 3: bulk fallback for everything else → at_home
    ELSE 'at_home'
  END,
  release_window_source = 'date_heuristic',
  release_window_updated_at = now();

CREATE INDEX IF NOT EXISTS idx_movie_cache_release_window
  ON public.movie_cache (release_window)
  WHERE release_window IS NOT NULL;
