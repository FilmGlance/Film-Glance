"use client";

// Filter bar — period tabs (Weekly/Monthly/Seasonal/Yearly), region tabs
// (Domestic active, International "Coming Soon"), and the period navigator
// for browsing historical periods.

import React from "react";
import PeriodNavigator from "./PeriodNavigator";

const PERIOD_OPTIONS = [
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "seasonal", label: "Seasonal" },
  { id: "yearly", label: "Yearly" },
];

function Chip({ active, disabled, onClick, children, comingSoon }) {
  const baseColor = active ? "#FFD700" : "rgba(255,255,255,0.62)";
  const baseBg = active
    ? "linear-gradient(135deg, rgba(255,215,0,0.13), rgba(255,165,0,0.04))"
    : "rgba(0,0,0,0.32)";
  const baseBorder = active
    ? "rgba(255, 215, 0, 0.32)"
    : "rgba(255,255,255,0.10)";
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={comingSoon ? "International coverage shipping in a future update" : undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "9px 16px",
        borderRadius: 12,
        background: baseBg,
        border: `1px solid ${baseBorder}`,
        color: baseColor,
        fontFamily: "'Syne', sans-serif",
        fontSize: 14,
        fontWeight: active ? 700 : 500,
        letterSpacing: 0.3,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        whiteSpace: "nowrap",
        transition:
          "background 0.25s ease, border-color 0.25s ease, color 0.25s ease, box-shadow 0.3s ease",
        boxShadow: active
          ? "0 0 22px rgba(255,215,0,0.10), inset 0 1px 0 rgba(255,215,0,0.08)"
          : "none",
      }}
    >
      {children}
      {comingSoon && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "2px 7px",
            borderRadius: 999,
            background: "rgba(255,215,0,0.16)",
            color: "#FFD700",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9.5,
            letterSpacing: 1.1,
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          Coming Soon
        </span>
      )}
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
        gap: 16,
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
          <Chip
            key={p.id}
            active={period === p.id}
            onClick={() => onChange({ period: p.id, date: null })}
          >
            {p.label}
          </Chip>
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
        <Chip active={region === "domestic"} onClick={() => onChange({ region: "domestic" })}>
          Domestic
        </Chip>
        <Chip
          active={false}
          disabled={true}
          comingSoon={true}
        >
          International
        </Chip>
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
