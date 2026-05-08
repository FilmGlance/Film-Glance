"use client";

// DecadeBrowseRail — six tiles below the grid that filter the page to a
// decade. Each tile holds the decade label and a count of qualifying films.
// Counts come from the available_years aggregation in the parent.

import React from "react";

const DECADES = [
  { label: "2020s", start: 2020, end: 2029 },
  { label: "2010s", start: 2010, end: 2019 },
  { label: "2000s", start: 2000, end: 2009 },
  { label: "1990s", start: 1990, end: 1999 },
  { label: "1980s", start: 1980, end: 1989 },
  { label: "1970s", start: 1970, end: 1979 },
];

export default function DecadeBrowseRail({ availableYears = [], onSelectDecade }) {
  // Bucket counts from available_years
  const counts = new Map(DECADES.map((d) => [d.label, 0]));
  for (const { year, n } of availableYears) {
    for (const d of DECADES) {
      if (year >= d.start && year <= d.end) {
        counts.set(d.label, (counts.get(d.label) || 0) + n);
        break;
      }
    }
  }

  return (
    <section aria-label="Browse by decade" style={{ marginTop: 48, marginBottom: 16 }}>
      <h2
        style={{
          margin: "0 0 14px",
          fontFamily: "'Playfair Display', serif",
          fontStyle: "italic",
          fontWeight: 700,
          fontSize: 24,
          color: "#fff",
          letterSpacing: -0.2,
          textAlign: "center",
        }}
      >
        Browse by decade
      </h2>
      <div
        className="dis-decade-rail"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        {DECADES.map((d) => {
          const n = counts.get(d.label) || 0;
          return (
            <button
              key={d.label}
              type="button"
              onClick={() => onSelectDecade?.(d)}
              disabled={n === 0}
              style={{
                padding: "16px 10px",
                borderRadius: 12,
                background: n === 0 ? "rgba(8,6,2,0.4)" : "rgba(8,6,2,0.62)",
                border: `1px solid ${n === 0 ? "rgba(255,215,0,0.05)" : "rgba(255,215,0,0.16)"}`,
                cursor: n === 0 ? "not-allowed" : "pointer",
                color: "inherit",
                fontFamily: "inherit",
                transition: "transform 0.25s ease, border-color 0.25s ease, background 0.25s ease",
                opacity: n === 0 ? 0.45 : 1,
              }}
              onMouseEnter={(e) => {
                if (n === 0) return;
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.borderColor = "rgba(255,215,0,0.42)";
                e.currentTarget.style.background = "rgba(255,215,0,0.06)";
              }}
              onMouseLeave={(e) => {
                if (n === 0) return;
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.borderColor = "rgba(255,215,0,0.16)";
                e.currentTarget.style.background = "rgba(8,6,2,0.62)";
              }}
            >
              <div
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontStyle: "italic",
                  fontWeight: 700,
                  fontSize: 22,
                  background: n === 0
                    ? "rgba(255,255,255,0.32)"
                    : "linear-gradient(135deg, #FFE27A 0%, #FFD700 48%, #E8A000 100%)",
                  WebkitBackgroundClip: n === 0 ? "border-box" : "text",
                  backgroundClip: n === 0 ? "border-box" : "text",
                  WebkitTextFillColor: n === 0 ? undefined : "transparent",
                  color: n === 0 ? "rgba(255,255,255,0.4)" : "transparent",
                  letterSpacing: -0.4,
                  paddingBottom: "0.06em",
                }}
              >
                {d.label}
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10.5,
                  letterSpacing: 1.2,
                  color: "rgba(255,255,255,0.55)",
                }}
              >
                {n} {n === 1 ? "film" : "films"}
              </div>
            </button>
          );
        })}
      </div>
      <style jsx global>{`
        @media (max-width: 720px) {
          .dis-decade-rail {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          }
        }
        @media (max-width: 420px) {
          .dis-decade-rail {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }
      `}</style>
    </section>
  );
}
