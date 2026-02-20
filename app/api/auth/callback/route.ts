// app/api/auth/callback/route.ts
// Handles the OAuth redirect from Supabase Auth (Google, GitHub, etc.)
// After successful auth, Supabase sends the user here with a code.
// We exchange it for a session and redirect to the app.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/";

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

  // Redirect to app
  return NextResponse.redirect(new URL(next, req.url));
}
