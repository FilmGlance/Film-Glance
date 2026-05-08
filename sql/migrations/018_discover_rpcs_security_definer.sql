-- Migration 018: mark the read-side discover_* RPCs as SECURITY DEFINER.
--
-- v6.4.0 fix-forward (still pre-merge). Idempotent.
--
-- Why
-- ---
-- `movie_cache` has exactly one RLS policy:
--   "Authenticated users can read cache" USING (auth.role() = 'authenticated')
-- The `anon` role has no SELECT policy, so RLS denies SELECTs from anon —
-- even though anon has the table-level GRANT.
--
-- The discover_* read-side RPCs in migration 017 were declared
-- `LANGUAGE sql STABLE` (SECURITY INVOKER by default), so when the anon
-- client calls them, the inner `SELECT FROM movie_cache` is RLS-blocked
-- and returns 0 rows. That's the bug behind the broken /discover page on
-- the preview deployment (verified: `SET ROLE anon; SELECT COUNT(*) FROM
-- discover_movies('at_home', …)` → 0).
--
-- Marking them SECURITY DEFINER makes them run as the function owner
-- (postgres, which has BYPASSRLS in Supabase). Same pattern that
-- discover_refresh_heuristic already uses, and is also why fuzzy_movie_
-- suggestions only works for /api/suggest because that route uses
-- supabaseAdmin (service-role bypasses RLS).
--
-- The read-side functions don't take user-controlled SQL (no dynamic
-- queries) and only return public movie metadata — SECURITY DEFINER is
-- safe here. search_path is already locked to public, pg_temp from
-- migration 017.

ALTER FUNCTION public.discover_movies(text, text, int, boolean, int) SECURITY DEFINER;
ALTER FUNCTION public.discover_genres() SECURITY DEFINER;
ALTER FUNCTION public.discover_random(int, int, numeric) SECURITY DEFINER;
ALTER FUNCTION public.discover_random_pool_size(int, int, numeric) SECURITY DEFINER;
ALTER FUNCTION public.discover_recent(int) SECURITY DEFINER;
ALTER FUNCTION public.discover_years(text, text) SECURITY DEFINER;
