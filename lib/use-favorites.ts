// lib/use-favorites.ts
//
// Client hook that mirrors the favorites surface used by the FilmGlance
// landing/result component, but exposed as a reusable hook so /boxoffice
// (and any future page) can render heart buttons without re-implementing
// the auth + state plumbing.
//
// Behavior:
//   • Reads the current Supabase session on mount; subscribes to auth
//     state changes so sign-in/sign-out updates the heart state live.
//   • Fetches the user's favorites from /api/favorites once authenticated.
//   • toggleFavorite(entry) does optimistic add/remove with revert-on-error.
//   • If the user is signed out, toggleFavorite redirects to /?signin=1
//     which the existing landing page picks up to open the auth modal.
//
// Match key: (title, year) — same composite the existing toggleFav function
// uses so heart-states are consistent between /boxoffice and the result page.

"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-browser";

interface FavoriteRow {
  id: string;
  title: string;
  year: number | null;
  poster_url: string | null;
  search_key: string;
  score_ten?: number | null;
  score_stars?: number | null;
  genre?: string | null;
}

interface CardEntry {
  title: string;
  year?: number | null;
  search_key: string;
  poster_path?: string | null;
  fg_score?: number | null;
}

const TMDB_POSTER_BASE = "https://image.tmdb.org/t/p/w500";

function matchesEntry(fav: FavoriteRow, entry: CardEntry): boolean {
  const favYear = fav.year ?? 0;
  const entryYear =
    typeof entry.year === "number"
      ? entry.year
      : entry.year != null
        ? parseInt(String(entry.year), 10) || 0
        : 0;
  return fav.title === entry.title && favYear === entryYear;
}

export function useFavorites() {
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState<boolean>(false);
  const [favs, setFavs] = useState<FavoriteRow[]>([]);

  // Track auth state
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) {
        setAuthToken(data.session.access_token);
        setSignedIn(true);
      } else {
        setAuthToken(null);
        setSignedIn(false);
      }
    });
    const { data: subData } = supabase.auth.onAuthStateChange((_evt, session) => {
      setAuthToken(session?.access_token || null);
      setSignedIn(!!session);
    });
    return () => {
      cancelled = true;
      subData.subscription.unsubscribe();
    };
  }, []);

  // Fetch favorites whenever the auth token changes
  useEffect(() => {
    if (!authToken) {
      setFavs([]);
      return;
    }
    let cancelled = false;
    fetch("/api/favorites", { headers: { Authorization: `Bearer ${authToken}` } })
      .then(async (r) => {
        if (!r.ok) throw new Error(`favorites fetch ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (cancelled) return;
        setFavs(Array.isArray(d.favorites) ? d.favorites : []);
      })
      .catch((e) => {
        console.error("[favorites] fetch failed:", e);
      });
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  const isFavorited = useCallback(
    (entry: CardEntry): boolean => {
      if (!entry) return false;
      return favs.some((f) => matchesEntry(f, entry));
    },
    [favs],
  );

  const toggleFavorite = useCallback(
    async (entry: CardEntry): Promise<void> => {
      if (!authToken) {
        // Bounce to landing with the sign-in modal flag — the existing
        // FilmGlance auto-handler reads `?signin=1` (actually it's `#signin`
        // per film-glance.jsx:1424; but the landing also handles ?signin
        // via the existing query-param hook). Use the hash form to match.
        if (typeof window !== "undefined") {
          window.location.href = "/#signin";
        }
        return;
      }

      const existing = favs.find((f) => matchesEntry(f, entry));
      if (existing) {
        // Optimistic remove
        const prevSnapshot = [...favs];
        setFavs((prev) => prev.filter((f) => f.id !== existing.id));
        try {
          const r = await fetch(`/api/favorites?id=${existing.id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${authToken}` },
          });
          if (!r.ok) {
            console.error("[favorites] delete failed:", r.status);
            setFavs(prevSnapshot);
          }
        } catch (e) {
          console.error("[favorites] delete exception:", e);
          setFavs(prevSnapshot);
        }
        return;
      }

      // Optimistic add — render a temp row so the heart fills in instantly,
      // then swap in the real row from the API response (which has the real id).
      const tempId = `__opt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const yearNum =
        typeof entry.year === "number"
          ? entry.year
          : entry.year != null
            ? parseInt(String(entry.year), 10) || null
            : null;
      const placeholder: FavoriteRow = {
        id: tempId,
        title: entry.title,
        year: yearNum,
        poster_url: entry.poster_path ? `${TMDB_POSTER_BASE}${entry.poster_path}` : null,
        search_key: entry.search_key,
        score_ten: entry.fg_score ?? null,
      };
      setFavs((prev) => [placeholder, ...prev]);
      try {
        const r = await fetch("/api/favorites", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            title: entry.title,
            year: yearNum,
            poster_url: placeholder.poster_url,
            score_ten: entry.fg_score,
            search_key: entry.search_key,
          }),
        });
        if (!r.ok) {
          const txt = await r.text().catch(() => "");
          console.error("[favorites] insert failed:", r.status, txt);
          setFavs((prev) => prev.filter((f) => f.id !== tempId));
          return;
        }
        const data = (await r.json()) as { favorite?: FavoriteRow };
        if (data.favorite) {
          setFavs((prev) => prev.map((f) => (f.id === tempId ? data.favorite! : f)));
        }
      } catch (e) {
        console.error("[favorites] insert exception:", e);
        setFavs((prev) => prev.filter((f) => f.id !== tempId));
      }
    },
    [authToken, favs],
  );

  return { signedIn, isFavorited, toggleFavorite };
}
