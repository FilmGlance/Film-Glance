-- 002_add_cached_at.sql
-- Add cached_at column for tracking when cache entries were last refreshed.
-- Applied: Feb 24, 2026

ALTER TABLE public.movie_cache
ADD COLUMN IF NOT EXISTS cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.movie_cache SET cached_at = created_at WHERE cached_at = created_at;
