// lib/supabase-anon.ts
//
// Public anon-key Supabase client for routes that only need to call RPCs
// granted to `anon` (no per-user data, no service-role bypass). Used by
// /api/discover/* — those RPCs are SECURITY DEFINER + GRANTED to anon, so
// going through the public client (instead of supabaseAdmin) keeps service-
// role out of the request path entirely.
//
// Added in v6.4.0 (audit Phase D follow-on; reduces service-role surface
// area beyond what v6.3.1 closed).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _anon: SupabaseClient | null = null;

export function supabaseAnon(): SupabaseClient {
  if (_anon) return _anon;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase env vars not configured");
  }
  _anon = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return _anon;
}
