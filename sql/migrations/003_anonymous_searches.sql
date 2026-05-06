-- Migration 003: anonymous_searches table (recovery, May 6 2026).
--
-- Background
-- ----------
-- This migration was applied in production with v5.4 (Feb 27, 2026) but
-- never committed to the repo. Migration 004's header notes the gap:
-- "slot 003 is reserved for a missing historical migration".
-- Audit Phase B (May 5, 2026) called for recovery; this file reconstructs
-- the table + indexes + RLS exactly as they exist in production today,
-- dumped via the Supabase Management API on May 6, 2026.
--
-- Idempotent — safe to re-run against a database that already has the table.
--
-- Notes:
-- * The companion `check_anonymous_limit(p_ip, p_limit)` RPC was extended
--   in a LATER migration (v5.10 era) to consult an `anonymous_search_whitelist`
--   table; that updated form lives in production now. This migration does NOT
--   recreate the RPC — leaving its definition to whichever later migration
--   most-recently CREATE OR REPLACE'd it keeps replayability clean.
-- * RLS is enabled but no policies exist. All access is via SECURITY DEFINER
--   RPCs called by the server (the route handler in app/api/search/route.ts).

CREATE TABLE IF NOT EXISTS public.anonymous_searches (
  ip_address    TEXT NOT NULL,
  search_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  search_count  INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (ip_address, search_date)
);

CREATE INDEX IF NOT EXISTS idx_anon_searches_date
  ON public.anonymous_searches (search_date);

ALTER TABLE public.anonymous_searches ENABLE ROW LEVEL SECURITY;
