"use client";

// components/box-office/BoxOfficePage.jsx
//
// v6.6.0 — image-forward redesign. CinematicBoxOfficeHero replaces both
// PageHero (text-only) and the horizontal #1 PosterCard (featured variant).
// FilterBar wrapped in a "Browse the Chart" section pill for context. Grid
// renders #2-#N with a gross-share bar scaled to #1's gross.
//
// Filter logic:
//   • Year only             → yearly Top N (period_type=yearly)
//   • Year + Season         → seasonal Top N (period_type=seasonal)   ← v6.7.0
//   • Year + Month          → monthly Top N (period_type=monthly)
//   • Year + Month + Week   → weekly Top N (period_type=weekly)
//
// Season and Month are mutually exclusive — choosing one clears the other
// (and clears Week below). Year is always required.
//
// v6.7.0 D1: lifted the prior `Top 10` cap. Cache now holds up to 100 ranks
// per period after the bom-deep-rescrape, so the grid renders every rank
// returned by the API (default `?limit=100`).
//
// Default state on first load (no URL params): fetch weekly latest, derive
// year/month/week from the response's period_start, push to URL. From there
// URL is the source of truth — every dropdown change updates the URL, which
// triggers a re-fetch.

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import SiteHeader from "../SiteHeader";
import GoldScrollbar from "../GoldScrollbar";
import BackdropLayer from "./BackdropLayer";
import CinematicBoxOfficeHero from "./CinematicBoxOfficeHero";
import FilterBar from "./FilterBar";
import PosterCard from "./PosterCard";
import EmptyState from "./EmptyState";
import SkeletonRows from "./SkeletonRows";
import FolderPickerModal from "./FolderPickerModal";
import { useFavorites } from "@/lib/use-favorites";

const VALID_REGIONS = ["domestic", "international"];

const VALID_SEASONS = ["winter", "spring", "summer", "fall"];

function parseInitialFilters(params) {
  const yearParam = params?.get("year") || null;
  const seasonParam = (params?.get("season") || "").toLowerCase();
  const monthParam = params?.get("month");
  const weekParam = params?.get("week") || null;
  const regionParam = (params?.get("region") || "domestic").toLowerCase();
  return {
    year: yearParam,
    season: VALID_SEASONS.includes(seasonParam) ? seasonParam : null,
    month: monthParam ? parseInt(monthParam, 10) || null : null,
    week: weekParam,
    region: VALID_REGIONS.includes(regionParam) ? regionParam : "domestic",
  };
}

export default function BoxOfficePage() {
  const router = useRouter();
  const params = useSearchParams();

  const [year, setYear] = useState(() => parseInitialFilters(params).year);
  const [season, setSeason] = useState(() => parseInitialFilters(params).season);
  const [month, setMonth] = useState(() => parseInitialFilters(params).month);
  const [week, setWeek] = useState(() => parseInitialFilters(params).week);
  const [region, setRegion] = useState(() => parseInitialFilters(params).region);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // International is locked v1 — silently force back to domestic
  useEffect(() => {
    if (region === "international") setRegion("domestic");
  }, [region]);

  // Derive period_type + date for the API call from the current filter state
  const apiQuery = useMemo(() => {
    if (!year) return { period: "weekly" }; // initial fetch — latest weekly
    if (week) return { period: "weekly", date: week };
    if (month) return { period: "monthly", date: `${year}-${String(month).padStart(2, "0")}-01` };
    if (season) {
      // BOM season bounds — keep in lockstep with lib/bom-scraper.ts
      const SEASON_MONTH = { winter: "01", spring: "04", summer: "07", fall: "10" };
      return { period: "seasonal", date: `${year}-${SEASON_MONTH[season]}-01` };
    }
    return { period: "yearly", date: `${year}-01-01` };
  }, [year, season, month, week]);

  // Push current filter state to URL (replaces, no scroll, doesn't add history)
  const syncURL = useCallback(
    (next) => {
      const qs = new URLSearchParams();
      if (next.year) qs.set("year", next.year);
      if (next.season) qs.set("season", next.season);
      if (next.month != null) qs.set("month", String(next.month));
      if (next.week) qs.set("week", next.week);
      if (next.region && next.region !== "domestic") qs.set("region", next.region);
      const q = qs.toString();
      router.replace(q ? `/boxoffice?${q}` : "/boxoffice", { scroll: false });
    },
    [router],
  );

  // Fetch box office data whenever the API query changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({ period: apiQuery.period, region });
    if (apiQuery.date) qs.set("date", apiQuery.date);
    fetch(`/api/boxoffice?${qs.toString()}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`API ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (cancelled) return;
        setData(d);
        // First-load default-derivation: if the URL had no year, take it
        // from the response's period_start and seed the dropdowns to a
        // weekly view (the initial fetch is the latest weekly chart).
        if (!year && d?.period_start) {
          const ps = d.period_start;
          const y = ps.slice(0, 4);
          const m = parseInt(ps.slice(5, 7), 10) || null;
          const w = ps;
          setYear(y);
          setSeason(null);
          setMonth(m);
          setWeek(w);
          syncURL({ year: y, season: null, month: m, week: w, region });
        }
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiQuery.period, apiQuery.date, region]);

  // Handle filter changes from FilterBar. Season and Month are mutually
  // exclusive — selecting one clears the other (and Week below it).
  const onFilterChange = useCallback(
    (patch) => {
      let nextYear = year;
      let nextSeason = season;
      let nextMonth = month;
      let nextWeek = week;
      let nextRegion = region;
      if ("year" in patch) {
        nextYear = patch.year;
        nextSeason = null;
        nextMonth = null;
        nextWeek = null;
      }
      if ("season" in patch) {
        nextSeason = patch.season;
        nextMonth = null;
        nextWeek = null;
      }
      if ("month" in patch) {
        nextSeason = null;
        nextMonth = patch.month;
        nextWeek = null;
      }
      if ("week" in patch) nextWeek = patch.week;
      if ("region" in patch) nextRegion = patch.region;
      setYear(nextYear);
      setSeason(nextSeason);
      setMonth(nextMonth);
      setWeek(nextWeek);
      setRegion(nextRegion);
      syncURL({
        year: nextYear,
        season: nextSeason,
        month: nextMonth,
        week: nextWeek,
        region: nextRegion,
      });
    },
    [year, season, month, week, region, syncURL],
  );

  // v6.7.0 D1 — render every entry the API returns (up to 100). #1 fills
  // the cinematic hero; #2..N flow into the grid below with the gross-share
  // bar scaled to #1.
  const allEntries = data?.entries || [];
  const heroEntry = allEntries[0] || null;
  const restEntries = allEntries.slice(1);
  const maxGross = heroEntry?.gross || null;

  // Favorites — heart button on each card.
  //   • Signed-out heart click → requestSignIn (persists intent + bounces to
  //     /#signin; PendingFavoriteHandler completes the save post-auth, into
  //     Unsorted since the picker can't show without a session).
  //   • Signed-in + already favorited → removeFavorite (optimistic delete).
  //   • Signed-in + not yet favorited → opens the folder picker; on confirm
  //     we addFavorite(entry, folderId) so the user picks a destination
  //     (matches the result-page UX exactly).
  const { signedIn, folders, isFavorited, addFavorite, removeFavorite, createFolder, requestSignIn } =
    useFavorites();
  const [pickerEntry, setPickerEntry] = useState(null);

  const handleHeartClick = useCallback(
    (entry) => {
      if (!signedIn) {
        requestSignIn(entry);
        return;
      }
      if (isFavorited(entry)) {
        removeFavorite(entry);
        return;
      }
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

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        color: "#f0f0f0",
      }}
    >
      <BackdropLayer backdropPath={heroEntry?.backdrop_path || null} />

      {/* SiteHeader is rendered as a direct child of the page wrapper so its
          `position: sticky` actually sticks against the body's scroll context. */}
      <SiteHeader active="boxoffice" />

      {/* Cinematic hero — full-bleed, dominates first viewport. The #1 film
          IS the page's headline; no separate horizontal hero card below.
          Same architectural move as v6.5.3 on /discover. */}
      <CinematicBoxOfficeHero
        entry={heroEntry}
        periodType={data?.period_type || apiQuery.period}
        periodStart={data?.period_start || null}
        periodEnd={data?.period_end || null}
        totalCount={allEntries.length}
        loading={loading}
        favorited={heroEntry ? isFavorited(heroEntry) : false}
        onToggleFavorite={handleHeartClick}
      />

      <main
        style={{
          position: "relative",
          zIndex: 2,
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 24px 96px",
          fontFamily: "'Syne', sans-serif",
        }}
      >
        {/* "Browse the Chart" section pill — wraps the period selectors so
            the filter bar reads as a deliberate slice of the page rather
            than a floating strip. Mirrors the Reel Gems pill on /discover. */}
        <section
          style={{
            marginBottom: 28,
            padding: 24,
            borderRadius: 18,
            background: "rgba(8,6,2,0.62)",
            border: "1px solid rgba(255,215,0,0.10)",
            backdropFilter: "blur(20px) saturate(1.1)",
            WebkitBackdropFilter: "blur(20px) saturate(1.1)",
            boxShadow: "0 6px 22px rgba(0,0,0,0.4)",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontFamily: "'Playfair Display', serif",
              fontWeight: 700,
              fontSize: "clamp(28px, 3.4vw, 38px)",
              lineHeight: 1.05,
              letterSpacing: -0.4,
              color: "#FFD700",
              paddingBottom: "0.06em",
            }}
          >
            Browse the Chart
          </h2>
          <p
            style={{
              margin: "8px 0 18px",
              maxWidth: 720,
              fontFamily: "'Syne', sans-serif",
              fontSize: 14,
              lineHeight: 1.5,
              color: "rgba(255, 255, 255, 0.7)",
              letterSpacing: 0.2,
            }}
          >
            Pick a year. Narrow to a season, month, or single week. The chart
            updates instantly — every BOM ranking back to 1977, up to 100 deep.
          </p>

          <FilterBar
            year={year}
            season={season}
            month={month}
            week={week}
            region={region}
            availableYearly={data?.available_yearly || []}
            availableSeasonal={data?.available_seasonal || []}
            availableMonthly={data?.available_monthly || []}
            availableWeekly={data?.available_weekly || []}
            onChange={onFilterChange}
          />
        </section>

        {loading && !data && <SkeletonRows />}
        {error && (
          <EmptyState
            title="Couldn't load box office"
            subtitle={`${error} — try again in a moment`}
          />
        )}
        {!loading && data && data.entries?.length === 0 && (
          <EmptyState
            title="No data for this period"
            subtitle="Try a different period or check back after the next refresh."
          />
        )}
        {data && data.entries?.length > 0 && (
          <>
            {/* "The Rest of the Top N" anchor — small uppercase mono label
                so the chart-grid below has a clear identity (the cinematic
                hero already announced #1; this names #2..#N). The count is
                dynamic now that v6.7.0 lifted the prior 10-row cap. */}
            {restEntries.length > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  marginBottom: 18,
                }}
              >
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 11,
                    letterSpacing: 1.6,
                    textTransform: "uppercase",
                    color: "rgba(255,215,0,0.62)",
                    fontWeight: 600,
                  }}
                >
                  The Rest of the Top {allEntries.length}
                </div>
                <div
                  style={{
                    fontFamily: "'Syne', sans-serif",
                    fontSize: 12,
                    color: "rgba(255,255,255,0.45)",
                    letterSpacing: 0.4,
                  }}
                >
                  Bar shows gross relative to #1
                </div>
              </div>
            )}
            {/* Symmetric 3×3 grid of #2..#10, all uniform */}
            <div
              className="bom-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 300px))",
                justifyContent: "center",
                gap: 22,
                gridAutoRows: "1fr",
              }}
            >
              {restEntries.map((entry, i) => (
                <PosterCard
                  key={`card-${entry.search_key}-${data.period_start}`}
                  entry={entry}
                  staggerDelayMs={i * 60}
                  favorited={isFavorited(entry)}
                  onToggleFavorite={handleHeartClick}
                  maxGross={maxGross}
                />
              ))}
            </div>
          </>
        )}

        <style jsx global>{`
          @media (max-width: 960px) {
            .bom-grid {
              grid-template-columns: repeat(2, minmax(0, 300px)) !important;
              gap: 18px !important;
            }
          }
          @media (max-width: 640px) {
            .bom-grid {
              grid-template-columns: minmax(0, 360px) !important;
              gap: 16px !important;
            }
          }
        `}</style>
      </main>

      {/* Site-wide gold scrollbar — same as landing/result pages. */}
      <GoldScrollbar />

      {/* Folder picker — opens on heart click for signed-in users adding a
          new favorite. Mirrors the result-page picker (italic gold heading,
          shiny rows, inline new-folder reveal). Cancelling closes without
          saving. */}
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
