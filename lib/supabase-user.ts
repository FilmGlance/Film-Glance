// lib/supabase-user.ts
//
// User-scoped Supabase client. Created per-request from the caller's Bearer
// JWT — queries run as that user, so RLS becomes the primary auth boundary
// instead of relying on hand-written `.eq("user_id", user.id)` filters in
// every route handler.
//
// Added in v6.3.1 (audit Phase C, part 2 of 2). Use this for any route that
// reads or writes data scoped to a single user (favorites, folders, etc.).
// Reserve `supabaseAdmin` for routes that legitimately need service-role
// (webhooks, cron, admin batch jobs, shared cache writes).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice("Bearer ".length).trim();
  return token || null;
}

/**
 * Build a Supabase client authenticated as the bearer of `token`. Each call
 * returns a fresh client so per-request tokens don't leak across requests on
 * shared serverless instances.
 *
 * The client uses the anon key (not service-role) plus the user's JWT in
 * the Authorization header. Postgres sees `auth.uid()` = the user's UUID,
 * so RLS policies do their job automatically.
 */
export function createUserClient(token: string): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase env vars not configured");
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
