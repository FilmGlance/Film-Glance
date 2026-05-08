-- Migration 021: add tmdb_id column + partial UNIQUE index for bulletproof
-- dedup. Belt-and-suspenders for the bulk seed (5,532 → 30,000) and every
-- future cache write going forward.
--
-- Why
-- ---
-- The cache's only unique key today is `search_key` (normalized title), and
-- normalization can't fully reconcile every variation: typo'd searches
-- ("matrx" → The Matrix), articles ("12 Monkeys" vs "Twelve Monkeys"),
-- ampersands ("Pride and Prejudice" vs "Pride & Prejudice"). Migration 019
-- deleted 173 such duplicates after the fact; this migration adds a
-- bulletproof primary defense going forward — TMDB ID is stable + integer +
-- one per real film.
--
-- Partial-unique index pattern: NULL values are allowed (legacy rows that
-- haven't been backfilled yet won't fail the constraint), but any two
-- non-NULL tmdb_ids must be distinct. Backfill script populates the
-- legacy 5,532 rows; bulk-seed script populates new 24,500 rows; both
-- paths are protected.
--
-- Run from Supabase SQL Editor against production. Idempotent.

ALTER TABLE public.movie_cache
  ADD COLUMN IF NOT EXISTS tmdb_id INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS movie_cache_tmdb_id_uidx
  ON public.movie_cache (tmdb_id)
  WHERE tmdb_id IS NOT NULL;
