-- Migration 006: harden SECURITY DEFINER functions and lock down the
-- increment_search RPC.
--
-- Background
-- ----------
-- 1. handle_new_user(), reset_monthly_searches(), and increment_search() are
--    SECURITY DEFINER functions that run with the privileges of their owner
--    (typically postgres). Without an explicit search_path, an attacker who
--    can create objects in a schema earlier on the search path could shadow
--    `public.profiles` and hijack the function's reads/writes. Pinning
--    search_path to public + pg_temp prevents that.
--
-- 2. increment_search(p_user_id UUID) currently has no REVOKE, so the default
--    EXECUTE grant to PUBLIC means any authenticated Supabase user could call
--    it via PostgREST — POST /rest/v1/rpc/increment_search with another
--    user's UUID — and increment that user's quota counter. The app only
--    invokes this RPC server-side via the service-role client, so REVOKE is
--    safe to apply.
--
-- Note: pricing is currently disabled (PRICING_ENABLED=false in
-- app/api/search/route.ts), so increment_search is unreachable from app
-- code today. The REVOKE is still warranted because the function is
-- exposed via PostgREST regardless of whether app code calls it.
--
-- Run from Supabase SQL Editor against production. Idempotent.

ALTER FUNCTION public.handle_new_user()        SET search_path = public, pg_temp;
ALTER FUNCTION public.reset_monthly_searches() SET search_path = public, pg_temp;
ALTER FUNCTION public.increment_search(UUID)   SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.increment_search(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_search(UUID) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_search(UUID) FROM anon;

REVOKE EXECUTE ON FUNCTION public.reset_monthly_searches() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reset_monthly_searches() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.reset_monthly_searches() FROM anon;
