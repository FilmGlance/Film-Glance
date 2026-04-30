"use client";

// Filter bar — period chips (Yearly → Seasonal → Monthly → Weekly), region
// chips (Domestic active, International "Coming Soon"), and the period
// navigator. Uses the shared `.fg-shiny` chip pattern from app/globals.css
// so chips match the rest of the site (Favourites filter bar, modals).

import React from "react";
import PeriodNavigator from "./PeriodNavigator";

// Ordered largest-period → smallest-period per user spec (v5.12.0 round 2):
const PERIOD_OPTIONS = [
  { id: "yearly", label: "Yearly" },
  { id: "seasonal", label: "Seasonal" },
  { id: "monthly", label: "Monthly" },
  { id: "weekly", label: "Weekly" },
];

function ShinyChip({ active, disabled, comingSoon, onClick, ariaLabel, children }) {
  const cls = [
    "fg-shiny",
    active ? "active" : "",
    disabled ? "fg-shiny-disabled" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={cls}
      aria-label={ariaLabel}
      aria-pressed={active ? true : undefined}
      title={comingSoon ? "International coverage shipping in a future update" : undefined}
      style={{
        // Slightly larger than the base .fg-shiny defaults to feel like
        // primary filter affordances rather than secondary chips.
        padding: "10px 18px",
        fontSize: 13.5,
      }}
    >
      <span className="fg-shiny-label">
        {children}
        {comingSoon && <span className="fg-shiny-coming-soon">Coming Soon</span>}
      </span>
    </button>
  );
}

export default function FilterBar({
  period,
  region,
  date,
  availablePeriods,
  onChange,
}) {
  return (
    <section
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 14,
        alignItems: "center",
        padding: "16px 18px",
        marginBottom: 28,
        background: "rgba(8,6,2,0.62)",
        border: "1px solid rgba(255,215,0,0.10)",
        borderRadius: 16,
        backdropFilter: "blur(20px) saturate(1.1)",
        WebkitBackdropFilter: "blur(20px) saturate(1.1)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center",
        }}
      >
        {PERIOD_OPTIONS.map((p) => (
          <ShinyChip
            key={p.id}
            active={period === p.id}
            ariaLabel={`Show ${p.label.toLowerCase()} chart`}
            onClick={() => onChange({ period: p.id, date: null })}
          >
            {p.label}
          </ShinyChip>
        ))}
      </div>

      <div
        style={{
          width: 1,
          height: 26,
          background: "rgba(255,215,0,0.18)",
          margin: "0 4px",
        }}
      />

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center",
        }}
      >
        <ShinyChip
          active={region === "domestic"}
          ariaLabel="Domestic chart"
          onClick={() => onChange({ region: "domestic" })}
        >
          Domestic
        </ShinyChip>
        <ShinyChip
          active={false}
          disabled={true}
          comingSoon={true}
          ariaLabel="International chart — coming soon"
        >
          International
        </ShinyChip>
      </div>

      <div
        style={{
          width: 1,
          height: 26,
          background: "rgba(255,215,0,0.18)",
          margin: "0 4px",
        }}
      />

      <PeriodNavigator
        period={period}
        date={date}
        availablePeriods={availablePeriods}
        onChange={(d) => onChange({ date: d })}
      />
    </section>
  );
}
