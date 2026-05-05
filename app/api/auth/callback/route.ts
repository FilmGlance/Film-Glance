// app/api/auth/callback/route.ts
// Handles the OAuth redirect from Supabase Auth (Google, GitHub, etc.)
// After successful auth, Supabase sends the user here with a code.
// We exchange it for a session and redirect to the app.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Reject any `next` value that isn't a same-origin relative path. Without this,
// `?next=//evil.com` (and `?next=/\evil.com` on quirky browsers) would phish
// users by bouncing them off the legitimate auth flow into an attacker page.
function getSafeNext(raw: string | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//")) return "/";
  if (raw.startsWith("/\\")) return "/";
  return raw;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const safeNext = getSafeNext(url.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(
      new URL(`/?error=missing_code`, req.url)
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("Auth callback error:", error);
    return NextResponse.redirect(
      new URL(`/?error=auth_failed`, req.url)
    );
  }

  return NextResponse.redirect(new URL(safeNext, req.url));
}
