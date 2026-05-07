"use client";

// DiscoverFilterBar — release-window toggle + Genre + Year + Hidden Gems
// toggle. Uses the existing portal FilterDropdown from box-office for the
// genre/year selectors so the visual identity matches.
//
// v6.4.1 round 2: ToggleButton restyled — gold-gradient pill when active
// (same family as other CTA buttons on the site), subtle hover lift, more
// presence than a flat tinted background.

import React from "react";
import { Tv, Film as FilmIcon, Sparkles } from "lucide-react";
import FilterDropdown from "@/components/box-office/FilterDropdown";

function ToggleButton({ active, onClick, icon: Icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "9px 18px",
        borderRadius: 999,
        border: active
          ? "1px solid rgba(0,0,0,0.18)"
          : "1px solid rgba(255,255,255,0.12)",
        background: active
          ? "linear-gradient(135deg, #FFE27A 0%, #FFD700 48%, #E8A000 100%)"
          : "rgba(0,0,0,0.32)",
        color: active ? "#0a0805" : "rgba(255,255,255,0.78)",
        fontFamily: "'Syne', sans-serif",
        fontSize: 13,
        fontWeight: active ? 800 : 600,
        letterSpacing: active ? 0.6 : 0.4,
        cursor: "pointer",
        boxShadow: active
          ? "0 8px 22px rgba(255,215,0,0.32), 0 0 0 1px rgba(255,215,0,0.45) inset"
          : "0 4px 14px rgba(0,0,0,0.32)",
        transition:
          "transform 0.2s ease, border-color 0.25s ease, background 0.25s ease, color 0.25s ease, box-shadow 0.25s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-1px)";
        if (!active) {
          e.currentTarget.style.borderColor = "rgba(255,215,0,0.42)";
          e.currentTarget.style.color = "#FFD700";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        if (!active) {
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
          e.currentTarget.style.color = "rgba(255,255,255,0.78)";
        }
      }}
    >
      <Icon size={13} aria-hidden="true" strokeWidth={active ? 2.4 : 2} />
      {label}
    </button>
  );
}

export default function DiscoverFilterBar({
  releaseWindow,
  genre,
  year,
  hiddenGems,
  availableGenres,
  availableYears,
  onChange,
}) {
  const genreOptions = [
    { value: null, label: "All genres", italic: true },
    ...((availableGenres || []).map((g) => ({
      value: g.genre,
      label: g.genre,
    }))),
  ];

  const yearOptions = [
    { value: null, label: "Any year", italic: true },
    ...((availableYears || []).map((y) => ({
      value: y.year,
      label: String(y.year),
    }))),
  ];

  return (
    <div
      className="dis-filterbar"
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "flex-end",
        gap: 14,
        marginBottom: 28,
        padding: 16,
        borderRadius: 14,
        background: "rgba(8,6,2,0.45)",
        border: "1px solid rgba(255,215,0,0.10)",
        backdropFilter: "blur(20px) saturate(1.1)",
        WebkitBackdropFilter: "blur(20px) saturate(1.1)",
      }}
    >
      <div
        className="dis-release-toggle"
        style={{ display: "flex", gap: 8, paddingBottom: 1 }}
        role="group"
        aria-label="Where can I watch"
      >
        <ToggleButton
          active={releaseWindow === "in_theaters"}
          onClick={() => onChange?.({ release_window: "in_theaters" })}
          icon={FilmIcon}
          label="In Theaters"
        />
        <ToggleButton
          active={releaseWindow === "at_home"}
          onClick={() => onChange?.({ release_window: "at_home" })}
          icon={Tv}
          label="At Home"
        />
      </div>

      <FilterDropdown
        label="GENRE"
        value={genre}
        options={genreOptions}
        onChange={(v) => onChange?.({ genre: v })}
        placeholder="All genres"
        width={200}
      />
      <FilterDropdown
        label="YEAR"
        value={year}
        options={yearOptions}
        onChange={(v) => onChange?.({ year: v })}
        placeholder="Any year"
        width={150}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10.5,
            letterSpacing: 1.6,
            textTransform: "uppercase",
            color: "rgba(255,215,0,0.62)",
            fontWeight: 600,
          }}
        >
          DISCOVER MODE
        </span>
        <ToggleButton
          active={!!hiddenGems}
          onClick={() => onChange?.({ hidden_gems: !hiddenGems })}
          icon={Sparkles}
          label={hiddenGems ? "Hidden Gems on" : "Hidden Gems"}
        />
      </div>

      <style jsx global>{`
        @media (max-width: 720px) {
          .dis-filterbar {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .dis-filterbar > * { width: 100% !important; }
          .dis-release-toggle { justify-content: center !important; }
        }
      `}</style>
    </div>
  );
}
