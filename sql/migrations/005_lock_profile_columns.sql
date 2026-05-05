-- Migration 005: lock UPDATE permission on public.profiles to safe columns only.
--
-- Background
-- ----------
-- The existing RLS policy "Users can update own profile" allows authenticated
-- users to UPDATE any column on their own profile row. That is too permissive:
-- a logged-in user can directly PATCH their own plan_id, stripe_customer_id,
-- searches_this_month, or search_month via the Supabase REST API. While
-- pricing is currently disabled (PRICING_ENABLED=false in app/api/search),
-- the columns still exist and the bypass becomes a real billing-tier escape
-- the moment billing is reactivated.
--
-- Fix
-- ---
-- Standard PostgreSQL pattern: revoke blanket UPDATE from authenticated,
-- then grant UPDATE only on the columns the UI actually edits. The row-level
-- policy stays — both checks must pass for an UPDATE to succeed.
--
-- The Stripe webhook handler (app/api/webhooks/stripe/route.ts) uses the
-- service-role client, which bypasses both RLS *and* column-level grants,
-- so plan/customer-id updates from billing events still work.
--
-- Run from Supabase SQL Editor against production. Idempotent.

REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (display_name, avatar_url) ON public.profiles TO authenticated;

-- The existing row-level UPDATE policy ("Users can update own profile") stays
-- as-is. It enforces auth.uid() = id; the GRANT above narrows which columns
-- that policy applies to.
