"use client";

// PendingFavoriteHandler — global, mounted once via app/layout.tsx.
//
// When a signed-out user taps the heart on /boxoffice, useFavorites stores the
// movie metadata in localStorage under "pendingFavorite" and redirects to
// /#signin. After the user finishes signing in (anywhere — / or /boxoffice)
// this handler:
//   1. Detects the auth state change via the supabase auth listener
//   2. Reads pendingFavorite from localStorage
//   3. POSTs it to /api/favorites with the new access token
//   4. Clears the storage entry
//   5. Redirects the user back to the page they clicked from (source_path)
//
// Lives at app/layout.tsx so it processes regardless of which route the user
// lands on after sign-in.

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase-browser";

const STORAGE_KEY = "pendingFavorite";
const MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

async function processPending(token) {
  if (typeof window === "undefined") return false;
  let payload;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    payload = JSON.parse(raw);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return false;
  }
  if (!payload || !payload.title || !payload.search_key) {
    localStorage.removeItem(STORAGE_KEY);
    return false;
  }
  // Stale guard — drop if older than 30 min so a forgotten click doesn't
  // surprise the user days later.
  if (payload.ts && Date.now() - payload.ts > MAX_AGE_MS) {
    localStorage.removeItem(STORAGE_KEY);
    return false;
  }

  const TMDB_BASE = "https://image.tmdb.org/t/p/w500";
  const body = {
    title: payload.title,
    year: payload.year,
    poster_url: payload.poster_path ? `${TMDB_BASE}${payload.poster_path}` : "",
    score_ten: payload.fg_score ?? null,
    search_key: payload.search_key,
  };

  try {
    const res = await fetch("/api/favorites", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error("[pending-fav] insert failed:", res.status, await res.text().catch(() => ""));
      // Don't clear — let the user try again on next load
      return false;
    }
    localStorage.removeItem(STORAGE_KEY);
    // Redirect to the page where the click originated, if it isn't the
    // current path. Strip the #signin hash on the way back.
    const sourcePath = payload.source_path || "/boxoffice";
    if (sourcePath && sourcePath !== window.location.pathname + window.location.search) {
      window.location.replace(sourcePath);
    } else if (window.location.hash === "#signin") {
      // Already on the right page, just clean up the hash
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    return true;
  } catch (e) {
    console.error("[pending-fav] insert exception:", e);
    return false;
  }
}

export default function PendingFavoriteHandler() {
  // handledRef: set to true ONLY after a successful processPending. A
  //   transient failure (network blip, 5xx) leaves it false so the next auth
  //   event (or a page reload) retries.
  // processingRef: prevents race conditions when getSession + onAuthStateChange
  //   fire near-simultaneously — without it, both callbacks would POST in
  //   parallel, double-inserting the favorite.
  const handledRef = useRef(false);
  const processingRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    async function attempt(token) {
      if (handledRef.current || processingRef.current) return;
      if (!token) return;
      processingRef.current = true;
      try {
        const ok = await processPending(token);
        if (ok) handledRef.current = true;
      } catch {
        // Leave handledRef false so the next auth event retries.
      } finally {
        processingRef.current = false;
      }
    }

    // Initial check — if user landed on a page already signed-in (e.g. after
    // a fresh OAuth redirect that auto-set the session), process pending fav.
    supabase.auth.getSession().then(({ data }) => {
      attempt(data.session?.access_token);
    });

    const { data: subData } = supabase.auth.onAuthStateChange((_event, session) => {
      attempt(session?.access_token);
    });

    return () => {
      subData.subscription.unsubscribe();
    };
  }, []);

  return null;
}
