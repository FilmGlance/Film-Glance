-- Migration 008: add UPDATE row-level policy on public.favorites.
--
-- Background
-- ----------
-- The original favorites table (migration 001) defined SELECT, INSERT, and
-- DELETE policies but NO UPDATE policy. Since RLS is enabled on the table,
-- this means any UPDATE attempt by a non-service-role caller fails silently
-- (0 rows affected, no error from PostgREST). The /api/enrich-favorites
-- route worked anyway because it uses supabaseAdmin (service-role bypasses
-- RLS).
--
-- v6.3.1 (audit Phase C, part 2 of 2) is migrating that route OFF service
-- role onto a user-scoped Supabase client to restore RLS as the primary auth
-- boundary. For that migration to work, an UPDATE policy needs to exist.
--
-- Run from Supabase SQL Editor against production. Idempotent.

-- Drop any prior version (idempotency, in case this gets re-applied).
DROP POLICY IF EXISTS "Users can update own favorites" ON public.favorites;

CREATE POLICY "Users can update own favorites"
  ON public.favorites
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
