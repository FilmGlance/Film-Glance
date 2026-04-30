"use client";

// BoxOfficeRow — denser horizontal row for entries #2-#10. Poster on the
// left, title/year + a 4-stat strip (gross/theaters/per-theater/FG score)
// on the right. Stagger-fades in on filter change via animation-delay.

import React from "react";

const TMDB_POSTER_BASE = "https://image.tmdb.org/t/p/w185";

function formatDollars(d) {
  if (d == null) return "—";
  if (d >= 1_000_000_000) return `$${(d / 1_000_000_000).toFixed(2)}B`;
  if (d >= 1_000_000) return `$${(d / 1_000_000).toFixed(1)}M`;
  if (d >= 1_000) return `$${(d / 1_000).toFixed(1)}K`;
  return `$${Math.round(d).toLocaleString("en-US")}`;
}

function formatNumber(n) {
  if (n == null) return "—";
  return Math.round(n).toLocaleString("en-US");
}

export default function BoxOfficeRow({ entry, staggerDelayMs = 0 }) {
  const posterUrl = entry.poster_path ? `${TMDB_POSTER_BASE}${entry.poster_path}` : null;

  return (
    <article
      className="bom-row"
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 110px) minmax(0, 1fr)",
        gap: 22,
        padding: "16px 20px",
        background: "rgba(8,6,2,0.62)",
        border: "1px solid rgba(255,215,0,0.10)",
        borderRadius: 16,
        backdropFilter: "blur(20px) saturate(1.1)",
        WebkitBackdropFilter: "blur(20px) saturate(1.1)",
        animation: `bomRowIn 0.45s cubic-bezier(0.16,1,0.3,1) ${staggerDelayMs}ms both`,
        transition: "transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease",
        position: "relative",
        cursor: "default",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.borderColor = "rgba(255,215,0,0.24)";
        e.currentTarget.style.boxShadow = "0 18px 60px rgba(0,0,0,0.5), 0 0 80px rgba(255,215,0,0.04)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.borderColor = "rgba(255,215,0,0.10)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* Rank badge top-left */}
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          padding: "3px 10px",
          borderRadius: 999,
          background: "rgba(0,0,0,0.6)",
          border: "1px solid rgba(255,215,0,0.22)",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10.5,
          letterSpacing: 1.2,
          color: "#FFD700",
          zIndex: 2,
        }}
      >
        #{entry.rank}
      </div>

      {/* Poster */}
      <div
        style={{
          aspectRatio: "2 / 3",
          width: "100%",
          borderRadius: 8,
          overflow: "hidden",
          background: "rgba(0,0,0,0.5)",
          boxShadow: "0 6px 18px rgba(0,0,0,0.4)",
        }}
      >
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={entry.title}
            loading="lazy"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              fontFamily: "'Playfair Display', serif",
              fontStyle: "italic",
              color: "rgba(255,215,0,0.32)",
              fontSize: 22,
            }}
          >
            {entry.title.charAt(0)}
          </div>
        )}
      </div>

      {/* Right column: title + stats */}
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", minWidth: 0 }}>
        <div style={{ minWidth: 0 }}>
          <h3
            style={{
              fontFamily: "'Playfair Display', serif",
              fontStyle: "italic",
              fontWeight: 700,
              fontSize: "clamp(20px, 2.4vw, 26px)",
              lineHeight: 1.15,
              margin: 0,
              color: "#fff",
              wordBreak: "break-word",
            }}
          >
            {entry.title}
          </h3>
          {entry.year && (
            <div
              style={{
                marginTop: 4,
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11.5,
                letterSpacing: 1.2,
                color: "rgba(255,215,0,0.55)",
              }}
            >
              {entry.year}
            </div>
          )}
        </div>

        <div
          className="bom-row-stats"
          style={{
            marginTop: 14,
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 1fr",
            gap: 14,
            alignItems: "end",
          }}
        >
          <Stat label="Gross" value={formatDollars(entry.gross)} primary={true} />
          <Stat label="Theaters" value={formatNumber(entry.theaters)} />
          <Stat label="Per-theater" value={formatDollars(entry.pta)} />
          <Stat
            label="FG Score"
            value={entry.fg_score != null ? entry.fg_score.toFixed(1) : "—"}
            sub={entry.fg_score == null ? "pending" : null}
            primaryColor={entry.fg_score == null ? "rgba(255,255,255,0.5)" : "#FFD700"}
            primaryFont="'Playfair Display', serif"
          />
        </div>
      </div>

      <style jsx global>{`
        @keyframes bomRowIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @media (max-width: 640px) {
          .bom-row {
            grid-template-columns: minmax(0, 78px) minmax(0, 1fr) !important;
            gap: 14px !important;
            padding: 12px 14px !important;
          }
          .bom-row-stats {
            grid-template-columns: 1fr 1fr !important;
            row-gap: 12px !important;
          }
        }
      `}</style>
    </article>
  );
}

function Stat({ label, value, sub, primary, primaryColor, primaryFont }) {
  const color = primaryColor ?? (primary ? "#FFD700" : "#fff");
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontFamily: primaryFont || "'Syne', sans-serif",
          fontWeight: 700,
          fontSize: primary ? "clamp(20px, 2.4vw, 28px)" : "clamp(15px, 1.6vw, 18px)",
          lineHeight: 1,
          color,
          letterSpacing: -0.2,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {value}
      </div>
      <div
        style={{
          marginTop: 5,
          fontFamily: "'Syne', sans-serif",
          fontSize: 10.5,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.5)",
        }}
      >
        {label}
      </div>
      {sub && (
        <div
          style={{
            marginTop: 1,
            fontFamily: "'Syne', sans-serif",
            fontSize: 9.5,
            color: "rgba(255,255,255,0.36)",
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}
