"use client";

// FilterBar — three independent dropdowns (Year / Month / Week) + Region.
//
// Logic per user spec:
//   • Year only       → yearly Top 10 of that year
//   • Year + Month    → monthly Top 10 of that month
//   • Year + Month + Week → weekly Top 10 of that week
//
// Selecting "(Whole year)" in the Month dropdown clears month + week (drops to
// yearly view). Selecting "(Whole month)" in the Week dropdown clears just
// week (drops to monthly view). Year is always required.
//
// Default state on page load: latest week (= year + month + week all filled to
// the most recent ingested values), giving the user the freshest weekly chart
// immediately. Resolved by the parent (BoxOfficePage) before this component
// renders.

import React, { useMemo } from "react";
import FilterDropdown from "./FilterDropdown";

const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const REGION_OPTIONS = [
  { value: "domestic", label: "Domestic" },
  { value: "international", label: "International — Coming Soon", disabled: true, italic: true },
];

function formatWeekRange(periodStart) {
  // periodStart is YYYY-MM-DD (Monday of the ISO week). Format as "Mon DD".
  const d = new Date(periodStart + "T00:00:00Z");
  const end = new Date(d);
  end.setUTCDate(d.getUTCDate() + 6);
  const fmt = (x) =>
    `${x.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`;
  return `${fmt(d)} – ${fmt(end)}`;
}

export default function FilterBar({
  year,
  month, // 1-12 (number) or null
  week, // ISO-week period_start string (YYYY-MM-DD) or null — uniquely identifies the week
  region,
  availableYearly,    // [{ period_start, period_label }, ...]
  availableMonthly,   // ...
  availableWeekly,    // ...
  onChange,           // ({ year?, month?, week?, region? }) => void
}) {
  // --- Build year options from available_yearly ---
  const yearOptions = useMemo(
    () =>
      availableYearly.map((y) => {
        const yr = y.period_start.slice(0, 4);
        return { value: yr, label: yr };
      }),
    [availableYearly],
  );

  // --- Build month options for the selected year ---
  // Each option is { value: 1..12, label: "January", disabled: !hasData }
  const monthOptions = useMemo(() => {
    if (!year) return [];
    const monthsWithData = new Set();
    for (const m of availableMonthly) {
      const mYear = m.period_start.slice(0, 4);
      if (mYear !== year) continue;
      const monthIdx = parseInt(m.period_start.slice(5, 7), 10); // 1-12
      monthsWithData.add(monthIdx);
    }
    const opts = [
      { value: null, label: "(Whole year — no month selected)", italic: true },
      ...Array.from({ length: 12 }, (_, i) => {
        const m = i + 1;
        return {
          value: m,
          label: MONTH_LABELS[i],
          disabled: !monthsWithData.has(m),
        };
      }),
    ];
    return opts;
  }, [year, availableMonthly]);

  // --- Build week options for the selected year + month ---
  // Each weekly period_start is the Monday of an ISO week. We bucket by which
  // calendar month contains the Monday — so "Week 1 of October 2025" is the
  // first ISO week whose Monday falls in October.
  const weekOptions = useMemo(() => {
    if (!year || !month) return [];
    const monthStr = String(month).padStart(2, "0");
    const matching = availableWeekly
      .filter((w) => {
        const wYear = w.period_start.slice(0, 4);
        const wMonth = w.period_start.slice(5, 7);
        return wYear === year && wMonth === monthStr;
      })
      // Sort ASC chronologically so "Week 1" is the earliest
      .sort((a, b) => a.period_start.localeCompare(b.period_start));

    const opts = [
      { value: null, label: "(Whole month — no week selected)", italic: true },
      ...matching.map((w, i) => ({
        value: w.period_start,
        label: `Week ${i + 1} — ${formatWeekRange(w.period_start)}`,
      })),
    ];
    return opts;
  }, [year, month, availableWeekly]);

  return (
    <section
      style={{
        // No backdrop-filter here — moved the visual dark-glass treatment to
        // a child wrapper so the parent doesn't create a containing block for
        // any portal-rendered children. (Technically irrelevant since the
        // dropdowns now use portals — but cleaner separation.)
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: "18px 20px",
        marginBottom: 32,
        background: "rgba(8,6,2,0.62)",
        border: "1px solid rgba(255,215,0,0.10)",
        borderRadius: 16,
      }}
    >
      <div
        className="bom-filterbar-row"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 18,
          alignItems: "flex-end",
        }}
      >
        <FilterDropdown
          label="Year"
          value={year}
          options={yearOptions}
          onChange={(y) => onChange({ year: y, month: null, week: null })}
          placeholder="Pick a year…"
          width={140}
        />

        <FilterDropdown
          label="Month"
          value={month}
          options={monthOptions}
          onChange={(m) => onChange({ month: m, week: null })}
          placeholder="(Whole year)"
          disabled={!year}
          width={210}
        />

        <FilterDropdown
          label="Week"
          value={week}
          options={weekOptions}
          onChange={(w) => onChange({ week: w })}
          placeholder="(Whole month)"
          disabled={!month}
          width={260}
        />

        {/* Spacer pushes Region to the right */}
        <div style={{ flex: 1, minWidth: 12 }} />

        <FilterDropdown
          label="Region"
          value={region}
          options={REGION_OPTIONS}
          onChange={(r) => onChange({ region: r })}
          width={180}
        />
      </div>
    </section>
  );
}
