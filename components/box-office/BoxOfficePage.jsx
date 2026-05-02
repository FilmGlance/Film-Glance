"use client";

// components/box-office/BoxOfficePage.jsx
//
// Main client component for /boxoffice. v5.12.0 round 9 reworked the filter
// model from a single period_type chip strip + period-navigator dropdown to
// THREE independent dropdowns: Year, Month, Week.
//
// Filter logic:
//   • Year only       → yearly Top 10 (period_type=yearly)
//   • Year + Month    → monthly Top 10 (period_type=monthly)
//   • Year + Month + Week → weekly Top 10 (period_type=weekly)
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
import PageHero from "./PageHero";
import FilterBar from "./FilterBar";
import PosterCard from "./PosterCard";
import EmptyState from "./EmptyState";
import SkeletonRows from "./SkeletonRows";
import { useFavorites } from "@/lib/use-favorites";

const VALID_REGIONS = ["domestic", "international"];

function parseInitialFilters(params) {
  const yearParam = params?.get("year") || null;
  const monthParam = params?.get("month");
  const weekParam = params?.get("week") || null;
  const regionParam = (params?.get("region") || "domestic").toLowerCase();
  return {
    year: yearParam,
    month: monthParam ? parseInt(monthParam, 10) || null : null,
    week: weekParam,
    region: VALID_REGIONS.includes(regionParam) ? regionParam : "domestic",
  };
}

export default function BoxOfficePage() {
  const router = useRouter();
  const params = useSearchParams();

  const [year, setYear] = useState(() => parseInitialFilters(params).year);
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
    return { period: "yearly", date: `${year}-01-01` };
  }, [year, month, week]);

  // Push current filter state to URL (replaces, no scroll, doesn't add history)
  const syncURL = useCallback(
    (next) => {
      const qs = new URLSearchParams();
      if (next.year) qs.set("year", next.year);
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
        // from the response's period_start and seed the dropdowns.
        if (!year && d?.period_start) {
          const ps = d.period_start;
          const y = ps.slice(0, 4);
          const m = parseInt(ps.slice(5, 7), 10) || null;
          const w = ps;
          setYear(y);
          setMonth(m);
          setWeek(w);
          syncURL({ year: y, month: m, week: w, region });
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

  // Handle filter changes from FilterBar
  const onFilterChange = useCallback(
    (patch) => {
      let nextYear = year;
      let nextMonth = month;
      let nextWeek = week;
      let nextRegion = region;
      if ("year" in patch) {
        nextYear = patch.year;
        nextMonth = null;
        nextWeek = null;
      }
      if ("month" in patch) {
        nextMonth = patch.month;
        nextWeek = null;
      }
      if ("week" in patch) nextWeek = patch.week;
      if ("region" in patch) nextRegion = patch.region;
      setYear(nextYear);
      setMonth(nextMonth);
      setWeek(nextWeek);
      setRegion(nextRegion);
      syncURL({ year: nextYear, month: nextMonth, week: nextWeek, region: nextRegion });
    },
    [year, month, week, region, syncURL],
  );

  const allEntries = (data?.entries || []).slice(0, 10);
  const heroEntry = allEntries[0] || null;

  // Favorites — heart button on each card. Hook handles auth, optimistic
  // update, and fallback-to-signin redirect when the user is signed out.
  const { isFavorited, toggleFavorite } = useFavorites();

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
          `position: sticky` actually sticks against the body's scroll context.
          Wrapping it in a fixed-height parent (as we did pre-round-10) makes
          the sticky element only "stick" within that ~64px parent, which means
          it scrolls away as soon as the user gets past 64px of scroll. */}
      <SiteHeader active="boxoffice" />

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
        <PageHero />

        <FilterBar
          year={year}
          month={month}
          week={week}
          region={region}
          availableYearly={data?.available_yearly || []}
          availableMonthly={data?.available_monthly || []}
          availableWeekly={data?.available_weekly || []}
          onChange={onFilterChange}
        />

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
            {/* Row 1 — featured #1, full width, horizontal hero */}
            {heroEntry && (
              <div style={{ marginBottom: 28 }}>
                <PosterCard
                  key={`hero-${heroEntry.search_key}-${data.period_start}`}
                  entry={heroEntry}
                  featured
                  favorited={isFavorited(heroEntry)}
                  onToggleFavorite={toggleFavorite}
                />
              </div>
            )}
            {/* Rows 2-4 — symmetric 3×3 grid of #2..#10, all uniform */}
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
              {allEntries.slice(1).map((entry, i) => (
                <PosterCard
                  key={`card-${entry.search_key}-${data.period_start}`}
                  entry={entry}
                  staggerDelayMs={i * 60}
                  favorited={isFavorited(entry)}
                  onToggleFavorite={toggleFavorite}
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
          @media (max-width: 720px) {
            .bom-pcard-featured {
              grid-template-columns: 1fr !important;
              padding: 18px !important;
              gap: 18px !important;
            }
            .bom-pcard-featured .bom-feat-right h2 {
              font-size: 32px !important;
            }
          }
        `}</style>
      </main>

      {/* Site-wide gold scrollbar — same as landing/result pages. */}
      <GoldScrollbar />
    </div>
  );
}
