// lib/use-favorites.ts
//
// Client hook used by /boxoffice (and any future page) to render heart
// buttons + folder-picker modal without re-implementing auth + state +
// folder plumbing.
//
// API:
//   • signedIn — whether we have an active Supabase session
//   • folders — list of the user's favorite folders (loaded once authed)
//   • isFavorited(entry) — has this entry been hearted?
//   • removeFavorite(entry) — optimistic delete + revert-on-error
//   • addFavorite(entry, folderId|null) — optimistic add + revert-on-error;
//     folderId null routes to Unsorted
//   • createFolder(name) — creates a folder via supabase, returns new id
//     on success or null on validation/network failure
//   • requestSignIn(entry) — for signed-out heart clicks; persists the
//     intent in localStorage and bounces to /#signin so the global
//     PendingFavoriteHandler completes the favorite after auth
//
// The picker UI itself lives in components/box-office/FolderPickerModal.jsx
// — this hook exposes only data + actions so consumers stay in control of
// when and how to render the modal.
//
// Match key for isFavorited: (title, year) — same composite the existing
// toggleFav function uses so heart-states stay consistent between
// /boxoffice and the result page.

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
  folder_id?: string | null;
}

interface FolderRow {
  id: string;
  name: string;
  position: number;
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

function entryYearNumber(entry: CardEntry): number | null {
  return typeof entry.year === "number"
    ? entry.year
    : entry.year != null
      ? parseInt(String(entry.year), 10) || null
      : null;
}

export function useFavorites() {
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState<boolean>(false);
  const [favs, setFavs] = useState<FavoriteRow[]>([]);
  const [folders, setFolders] = useState<FolderRow[]>([]);

  // Track auth state
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) {
        setAuthToken(data.session.access_token);
        setUserId(data.session.user?.id || null);
        setSignedIn(true);
      } else {
        setAuthToken(null);
        setUserId(null);
        setSignedIn(false);
      }
    });
    const { data: subData } = supabase.auth.onAuthStateChange((_evt, session) => {
      setAuthToken(session?.access_token || null);
      setUserId(session?.user?.id || null);
      setSignedIn(!!session);
    });
    return () => {
      cancelled = true;
      subData.subscription.unsubscribe();
    };
  }, []);

  // Fetch favorites + folders whenever auth changes. Both are scoped to the
  // user via RLS — the folders query goes through the supabase browser client
  // (matches film-glance.jsx pattern, no server roundtrip needed).
  useEffect(() => {
    if (!authToken || !userId) {
      setFavs([]);
      setFolders([]);
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

    supabase
      .from("favorite_folders")
      .select("id, name, position")
      .eq("user_id", userId)
      .order("position", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("[favorites] folders fetch failed:", error);
          return;
        }
        setFolders(
          (data || []).map((f: any) => ({
            id: f.id,
            name: f.name,
            position: f.position ?? 0,
          })),
        );
      });

    return () => {
      cancelled = true;
    };
  }, [authToken, userId]);

  const isFavorited = useCallback(
    (entry: CardEntry): boolean => {
      if (!entry) return false;
      return favs.some((f) => matchesEntry(f, entry));
    },
    [favs],
  );

  // For signed-out heart clicks: persist intent in localStorage and bounce to
  // /#signin. The global <PendingFavoriteHandler /> mounted in app/layout.tsx
  // picks up the entry after auth completes and POSTs the favorite. The
  // post-auth save defaults to Unsorted (no folder_id) since the picker can't
  // be shown until the user is authenticated.
  const requestSignIn = useCallback((entry: CardEntry): void => {
    if (typeof window === "undefined") return;
    try {
      const payload = {
        title: entry.title,
        year: entryYearNumber(entry),
        search_key: entry.search_key,
        poster_path: entry.poster_path ?? null,
        fg_score: entry.fg_score ?? null,
        source_path: window.location.pathname + window.location.search,
        ts: Date.now(),
      };
      localStorage.setItem("pendingFavorite", JSON.stringify(payload));
    } catch (_e) {
      // localStorage unavailable / quota exceeded — proceed with bounce anyway
    }
    window.location.href = "/#signin";
  }, []);

  const removeFavorite = useCallback(
    async (entry: CardEntry): Promise<void> => {
      if (!authToken) return;
      const existing = favs.find((f) => matchesEntry(f, entry));
      if (!existing) return;
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
    },
    [authToken, favs],
  );

  const addFavorite = useCallback(
    async (entry: CardEntry, folderId: string | null): Promise<void> => {
      if (!authToken) return;
      // Optimistic add — render a temp row so the heart fills instantly,
      // then swap in the real row from the API response (which has the real id).
      const tempId = `__opt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const yearNum = entryYearNumber(entry);
      const placeholder: FavoriteRow = {
        id: tempId,
        title: entry.title,
        year: yearNum,
        poster_url: entry.poster_path ? `${TMDB_POSTER_BASE}${entry.poster_path}` : null,
        search_key: entry.search_key,
        score_ten: entry.fg_score ?? null,
        folder_id: folderId,
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
            folder_id: folderId,
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
    [authToken],
  );

  // Inline folder creation for the picker's "New folder…" path. Returns the
  // new folder's id on success, or null on validation/duplicate/network
  // failure so the caller can surface an error and keep the picker open.
  const createFolder = useCallback(
    async (rawName: string): Promise<string | null> => {
      if (!userId) return null;
      const name = String(rawName || "").trim().slice(0, 60);
      if (!name) return null;
      if (folders.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
        return null;
      }
      const position = folders.length;
      try {
        const { data, error } = await supabase
          .from("favorite_folders")
          .insert({ user_id: userId, name, position })
          .select()
          .single();
        if (error || !data) {
          console.error("[favorites] create folder failed:", error);
          return null;
        }
        const newFolder: FolderRow = {
          id: data.id,
          name: data.name,
          position: data.position ?? position,
        };
        setFolders((prev) => [...prev, newFolder]);
        return newFolder.id;
      } catch (e) {
        console.error("[favorites] create folder exception:", e);
        return null;
      }
    },
    [userId, folders],
  );

  return {
    signedIn,
    folders,
    isFavorited,
    addFavorite,
    removeFavorite,
    createFolder,
    requestSignIn,
  };
}
