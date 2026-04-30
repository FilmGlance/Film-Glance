"use client";

// components/box-office/BoxOfficePage.jsx
//
// Main client component for /boxoffice. Owns:
//   • URL-state wiring (period, region, date params)
//   • Data fetch from /api/boxoffice on filter change
//   • Composition of: BackdropLayer + PageHero + FilterBar + HeroCard
//     (#1) + BoxOfficeRow (#2..#10) + EmptyState / SkeletonRows
//
// Visual register matches the existing site theme — dark + gold, italic
// Playfair headers, Syne body, JetBrains Mono numerics. The cinematic
// feel comes from real movie posters/backdrops, oversized gold-gradient
// typography, count-up animation, and stagger-fade row entry. No "AI slop"
// chrome — every element earns its visual weight.

import React, { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import SiteHeader from "../SiteHeader";
import BackdropLayer from "./BackdropLayer";
import PageHero from "./PageHero";
import FilterBar from "./FilterBar";
import PosterCard from "./PosterCard";
import EmptyState from "./EmptyState";
import SkeletonRows from "./SkeletonRows";

const VALID_PERIODS = ["weekly", "monthly", "seasonal", "yearly"];
const VALID_REGIONS = ["domestic", "international"];

export default function BoxOfficePage() {
  const router = useRouter();
  const params = useSearchParams();

  const periodRaw = (params?.get("period") || "weekly").toLowerCase();
  const regionRaw = (params?.get("region") || "domestic").toLowerCase();
  const date = params?.get("date") || null;

  const period = VALID_PERIODS.includes(periodRaw) ? periodRaw : "weekly";
  const region = VALID_REGIONS.includes(regionRaw) ? regionRaw : "domestic";

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const setFilter = useCallback(
    (patch) => {
      const next = new URLSearchParams(params?.toString() || "");
      Object.entries(patch).forEach(([k, v]) => {
        if (v == null || v === "") next.delete(k);
        else next.set(k, v);
      });
      router.replace(`/boxoffice?${next.toString()}`, { scroll: false });
    },
    [params, router],
  );

  // International is locked v1 — clicks are no-op, displays "Coming Soon"
  useEffect(() => {
    if (region === "international") {
      // Force back to domestic in URL silently
      const next = new URLSearchParams(params?.toString() || "");
      next.set("region", "domestic");
      router.replace(`/boxoffice?${next.toString()}`, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({ period, region });
    if (date) qs.set("date", date);
    fetch(`/api/boxoffice?${qs.toString()}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`API ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (!cancelled) setData(d);
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
  }, [period, region, date]);

  const allEntries = (data?.entries || []).slice(0, 10);
  const heroEntry = allEntries[0] || null;

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        color: "#f0f0f0",
      }}
    >
      <BackdropLayer backdropPath={heroEntry?.backdrop_path || null} />

      <div style={{ position: "relative", zIndex: 3 }}>
        <SiteHeader active="boxoffice" />
      </div>

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
        <PageHero
          periodLabel={data?.period_label}
          periodType={period}
          region={region}
          dataStatus={data?.data_status}
          retrievedAt={data?.retrieved_at}
        />

        <FilterBar
          period={period}
          region={region}
          date={date}
          availablePeriods={data?.available_periods || []}
          onChange={setFilter}
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
          <div
            className="bom-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: 18,
            }}
          >
            {allEntries.map((entry, i) => (
              <PosterCard
                key={`card-${entry.search_key}-${data.period_start}`}
                entry={entry}
                featured={i === 0}
                staggerDelayMs={i * 60}
              />
            ))}
          </div>
        )}

        <style jsx global>{`
          /* 2 cols × 4 cols × 5 cols responsive grid.
             #1 (featured) spans the full row on tablet & mobile so it
             stays visually elevated rather than getting cramped. */
          @media (max-width: 1280px) {
            .bom-grid {
              grid-template-columns: repeat(4, 1fr) !important;
            }
          }
          @media (max-width: 960px) {
            .bom-grid {
              grid-template-columns: repeat(3, 1fr) !important;
            }
            .bom-grid > .bom-pcard-featured {
              grid-column: span 3;
            }
          }
          @media (max-width: 640px) {
            .bom-grid {
              grid-template-columns: repeat(2, 1fr) !important;
              gap: 14px !important;
            }
            .bom-grid > .bom-pcard-featured {
              grid-column: span 2;
            }
          }
        `}</style>
      </main>
    </div>
  );
}
