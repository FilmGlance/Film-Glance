"use client";

// components/discover/DiscoverPage.jsx
//
// Main client component for /discover. Owns:
//   • Filter state (release_window, genre, year, hidden_gems) + URL sync
//   • Data fetching from /api/discover
//   • Layout: SiteHeader → DiscoverHero → RecentlyAddedRail → RouletteSpinner
//             → DiscoverFilterBar → DiscoverGrid → DecadeBrowseRail
//   • Favorites integration (heart on each card → folder picker modal)
//
// v6.4.0.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import SiteHeader from "@/components/SiteHeader";
import GoldScrollbar from "@/components/GoldScrollbar";
import { useFavorites } from "@/lib/use-favorites";
import FolderPickerModal from "@/components/box-office/FolderPickerModal";
import BackdropLayer from "@/components/box-office/BackdropLayer";

import DiscoverHero from "./DiscoverHero";
import DiscoverFilterBar from "./DiscoverFilterBar";
import DiscoverGrid from "./DiscoverGrid";
import DiscoverFeatured from "./DiscoverFeatured";
import RecentlyAddedRail from "./RecentlyAddedRail";
import RouletteSpinner from "./RouletteSpinner";
import DecadeBrowseRail from "./DecadeBrowseRail";

const VALID_RELEASE_WINDOWS = ["in_theaters", "at_home"];

function parseInitialFilters(params) {
  const rw = (params?.get("rw") || "at_home").toLowerCase();
  const genre = params?.get("genre") || null;
  const yearRaw = params?.get("year");
  const year = yearRaw ? parseInt(yearRaw, 10) : null;
  const hg = params?.get("hg") === "1";
  return {
    release_window: VALID_RELEASE_WINDOWS.includes(rw) ? rw : "at_home",
    genre,
    year: Number.isFinite(year) ? year : null,
    hidden_gems: hg,
  };
}

export default function DiscoverPage() {
  const router = useRouter();
  const params = useSearchParams();

  const initial = useMemo(() => parseInitialFilters(params), []); // intentional one-shot
  const [releaseWindow, setReleaseWindow] = useState(initial.release_window);
  const [genre, setGenre] = useState(initial.genre);
  const [year, setYear] = useState(initial.year);
  const [hiddenGems, setHiddenGems] = useState(initial.hidden_gems);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const syncURL = useCallback(
    (next) => {
      const qs = new URLSearchParams();
      if (next.release_window && next.release_window !== "at_home") qs.set("rw", next.release_window);
      if (next.genre) qs.set("genre", next.genre);
      if (next.year != null) qs.set("year", String(next.year));
      if (next.hidden_gems) qs.set("hg", "1");
      const q = qs.toString();
      router.replace(q ? `/discover?${q}` : "/discover", { scroll: false });
    },
    [router],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({ release_window: releaseWindow });
    if (genre) qs.set("genre", genre);
    if (year != null) qs.set("year", String(year));
    if (hiddenGems) qs.set("hidden_gems", "1");
    fetch(`/api/discover?${qs.toString()}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`API ${r.status}`);
        return r.json();
      })
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [releaseWindow, genre, year, hiddenGems]);

  const onFilterChange = useCallback(
    (patch) => {
      let nrw = releaseWindow, ng = genre, ny = year, nh = hiddenGems;
      if ("release_window" in patch) {
        nrw = patch.release_window;
        // Year/genre lists differ between in_theaters and at_home; reset
        // narrower filters to avoid empty grids on toggle.
        ny = null;
      }
      if ("genre" in patch) { ng = patch.genre; ny = null; }
      if ("year" in patch) ny = patch.year;
      if ("hidden_gems" in patch) nh = patch.hidden_gems;
      setReleaseWindow(nrw);
      setGenre(ng);
      setYear(ny);
      setHiddenGems(nh);
      syncURL({ release_window: nrw, genre: ng, year: ny, hidden_gems: nh });
    },
    [releaseWindow, genre, year, hiddenGems, syncURL],
  );

  const onSelectDecade = useCallback(
    (d) => {
      // Filtering by decade isn't a single year — set the most recent year in
      // the decade to land the user roughly there. The decade rail's primary
      // role is wayfinding; for finer control they use the year dropdown.
      setYear(d.end);
      syncURL({ release_window: releaseWindow, genre, year: d.end, hidden_gems: hiddenGems });
    },
    [releaseWindow, genre, hiddenGems, syncURL],
  );

  // Favorites — same pattern as box-office.
  const { signedIn, folders, isFavorited, addFavorite, removeFavorite, createFolder, requestSignIn } = useFavorites();
  const [pickerEntry, setPickerEntry] = useState(null);

  const handleHeartClick = useCallback(
    (entry) => {
      if (!signedIn) { requestSignIn(entry); return; }
      if (isFavorited(entry)) { removeFavorite(entry); return; }
      setPickerEntry(entry);
    },
    [signedIn, isFavorited, removeFavorite, requestSignIn],
  );

  const handlePickerConfirm = useCallback(
    (folderId) => {
      const entry = pickerEntry;
      setPickerEntry(null);
      if (entry) addFavorite(entry, folderId);
    },
    [pickerEntry, addFavorite],
  );

  // Pool of poster paths for the roulette reels (random fillers — the actual
  // chosen poster is fetched per spin).
  const posterPool = useMemo(
    () => (data?.entries || []).map((e) => e.poster_path).filter(Boolean),
    [data],
  );

  const entries = data?.entries || [];
  const heroEntry = entries[0] || null;
  const restEntries = entries.slice(1);

  return (
    <div style={{ position: "relative", minHeight: "100vh", color: "#f0f0f0" }}>
      <BackdropLayer backdropPath={heroEntry?.backdrop_path || null} />
      <SiteHeader active="discover" />

      <main
        style={{
          position: "relative",
          zIndex: 2,
          maxWidth: 1200,
          margin: "0 auto",
          padding: "44px 24px 96px",
          fontFamily: "'Syne', sans-serif",
        }}
      >
        <DiscoverHero />

        <RecentlyAddedRail />

        <RouletteSpinner posterPool={posterPool} />

        <DiscoverFilterBar
          releaseWindow={releaseWindow}
          genre={genre}
          year={year}
          hiddenGems={hiddenGems}
          availableGenres={data?.available_genres || []}
          availableYears={data?.available_years || []}
          onChange={onFilterChange}
        />

        {/* Result count line */}
        <div
          style={{
            margin: "0 0 18px",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11.5,
            letterSpacing: 1.4,
            textTransform: "uppercase",
            color: "rgba(255, 215, 0, 0.62)",
          }}
        >
          {loading
            ? "Loading…"
            : error
              ? "Error — try refreshing"
              : entries.length === 0
                ? "No films match — try clearing a filter"
                : entries.length < 100
                  ? `Showing ${entries.length} of 100 — your filters narrowed the pool`
                  : `100 films · ranked by Film Glance score`}
        </div>

        {heroEntry && (
          <div style={{ marginBottom: 28 }}>
            <DiscoverFeatured
              entry={heroEntry}
              releaseWindow={releaseWindow}
              favorited={isFavorited(heroEntry)}
              onToggleFavorite={handleHeartClick}
            />
          </div>
        )}

        {restEntries.length > 0 && (
          <DiscoverGrid
            entries={restEntries}
            releaseWindow={releaseWindow}
            isFavorited={isFavorited}
            onToggleFavorite={handleHeartClick}
          />
        )}

        <DecadeBrowseRail
          availableYears={data?.available_years || []}
          onSelectDecade={onSelectDecade}
        />
      </main>

      <GoldScrollbar />

      {pickerEntry && (
        <FolderPickerModal
          entry={pickerEntry}
          folders={folders}
          onConfirm={handlePickerConfirm}
          onCreateFolder={createFolder}
          onClose={() => setPickerEntry(null)}
        />
      )}
    </div>
  );
}
