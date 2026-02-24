// lib/supabase-browser.ts
// Browser-side Supabase client for authentication and user-scoped queries.
// Uses the ANON key — all queries go through RLS.
// flowType: 'implicit' ensures OAuth redirects use hash fragments (#access_token=...)
// which the browser client can handle directly without a server callback.
// lock: bypassed to prevent Navigator LockManager timeouts (known Supabase v2 issue).

import { createClient } from "@supabase/supabase-js";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      flowType: "implicit",
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      // Bypass Navigator LockManager to prevent "timed out waiting 10000ms" errors.
      // This disables cross-tab token refresh coordination, which is fine for this app.
      lock: async (name, acquireTimeout, fn) => await fn(),
    },
  }
);
