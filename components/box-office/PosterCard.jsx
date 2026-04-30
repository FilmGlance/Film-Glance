"use client";

// PosterCard — single card used for all 10 entries in the 2×5 grid.
// `featured` prop applies the #1 elevated treatment (gold ring, brighter
// glow, slightly larger gross figure). Layout intentionally poster-forward
// to maximize the visual asset (movie art) per the project design guideline.

import React from "react";
import { useCountUp } from "@/lib/use-count-up";

const TMDB_POSTER_BASE = "https://image.tmdb.org/t/p/w500";

function formatDollars(d) {
  if (d == null) return "—";
  if (d >= 1_000_000_000) return `$${(d / 1_000_000_000).toFixed(2)}B`;
  if (d >= 1_000_000) return `$${(d / 1_000_000).toFixed(1)}M`;
  if (d >= 1_000) return `$${(d / 1_000).toFixed(1)}K`;
  return `$${Math.round(d).toLocaleString("en-US")}`;
}

function formatExactDollars(d) {
  if (d == null) return "—";
  return `$${Math.round(d).toLocaleString("en-US")}`;
}

function formatNumber(n) {
  if (n == null) return "—";
  return Math.round(n).toLocaleString("en-US");
}

export default function PosterCard({ entry, featured = false, staggerDelayMs = 0 }) {
  if (!entry) return null;

  const grossAnimated = useCountUp(entry.gross || 0, 800);
  const theatersAnimated = useCountUp(entry.theaters || 0, 800);
  const ptaAnimated = useCountUp(entry.pta || 0, 800);

  const posterUrl = entry.poster_path ? `${TMDB_POSTER_BASE}${entry.poster_path}` : null;

  return (
    <article
      className={`bom-pcard ${featured ? "bom-pcard-featured" : ""}`}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        padding: featured ? 16 : 12,
        background: featured
          ? "linear-gradient(180deg, rgba(20,15,4,0.86) 0%, rgba(8,6,2,0.92) 100%)"
          : "rgba(8,6,2,0.62)",
        border: featured
          ? "1.5px solid rgba(255,215,0,0.40)"
          : "1px solid rgba(255,215,0,0.10)",
        borderRadius: featured ? 18 : 14,
        backdropFilter: "blur(20px) saturate(1.1)",
        WebkitBackdropFilter: "blur(20px) saturate(1.1)",
        boxShadow: featured
          ? "0 24px 80px rgba(0,0,0,0.65), 0 0 80px rgba(255,215,0,0.10), inset 0 1px 0 rgba(255,215,0,0.12)"
          : "0 6px 22px rgba(0,0,0,0.4)",
        animation: `bomCardIn 0.45s cubic-bezier(0.16,1,0.3,1) ${staggerDelayMs}ms both`,
        transition: "transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-3px)";
        if (!featured) {
          e.currentTarget.style.borderColor = "rgba(255,215,0,0.28)";
          e.currentTarget.style.boxShadow =
            "0 18px 50px rgba(0,0,0,0.55), 0 0 60px rgba(255,215,0,0.06)";
        } else {
          e.currentTarget.style.borderColor = "rgba(255,215,0,0.55)";
          e.currentTarget.style.boxShadow =
            "0 30px 96px rgba(0,0,0,0.7), 0 0 110px rgba(255,215,0,0.16), inset 0 1px 0 rgba(255,215,0,0.16)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.borderColor = featured
          ? "rgba(255,215,0,0.40)"
          : "rgba(255,215,0,0.10)";
        e.currentTarget.style.boxShadow = featured
          ? "0 24px 80px rgba(0,0,0,0.65), 0 0 80px rgba(255,215,0,0.10), inset 0 1px 0 rgba(255,215,0,0.12)"
          : "0 6px 22px rgba(0,0,0,0.4)";
      }}
    >
      {/* Rank badge — top-left over the poster */}
      <div
        style={{
          position: "absolute",
          top: featured ? 12 : 8,
          left: featured ? 12 : 8,
          padding: featured ? "5px 13px" : "3px 10px",
          borderRadius: 999,
          background: featured
            ? "linear-gradient(135deg, #FFE27A, #FFD700, #E8A000)"
            : "rgba(0,0,0,0.7)",
          border: featured ? "1px solid rgba(255,255,255,0.25)" : "1px solid rgba(255,215,0,0.28)",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: featured ? 12.5 : 10.5,
          letterSpacing: 1.4,
          color: featured ? "#0a0805" : "#FFD700",
          fontWeight: 700,
          zIndex: 2,
          boxShadow: featured ? "0 4px 16px rgba(255,215,0,0.32)" : "none",
        }}
      >
        #{entry.rank}
      </div>

      {/* Poster */}
      <div
        style={{
          position: "relative",
          aspectRatio: "2 / 3",
          width: "100%",
          borderRadius: 12,
          overflow: "hidden",
          background: "rgba(0,0,0,0.5)",
          boxShadow: featured
            ? "0 12px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,215,0,0.18)"
            : "0 6px 18px rgba(0,0,0,0.4)",
        }}
      >
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={entry.title}
            loading={featured ? "eager" : "lazy"}
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
              fontSize: 36,
            }}
          >
            {entry.title.charAt(0)}
          </div>
        )}
      </div>

      {/* Title + meta */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        <h3
          style={{
            margin: 0,
            fontFamily: "'Playfair Display', serif",
            fontStyle: "italic",
            fontWeight: 700,
            fontSize: featured ? "clamp(22px, 2.2vw, 28px)" : "clamp(17px, 1.4vw, 20px)",
            lineHeight: 1.15,
            color: "#fff",
            wordBreak: "break-word",
          }}
        >
          {entry.title}
        </h3>
        {(entry.director || entry.year) && (
          <div
            style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: featured ? 13 : 11.5,
              color: "rgba(255,255,255,0.62)",
              letterSpacing: 0.2,
              lineHeight: 1.35,
              wordBreak: "break-word",
            }}
          >
            {entry.director ? <span>Dir. {entry.director}</span> : null}
            {entry.director && entry.year ? <span> · </span> : null}
            {entry.year ? <span>{entry.year}</span> : null}
          </div>
        )}
      </div>

      {/* Gross — primary metric, count-up, gold gradient */}
      <div
        style={{
          fontFamily: "'Playfair Display', serif",
          fontWeight: 700,
          fontSize: featured ? "clamp(34px, 3.4vw, 50px)" : "clamp(24px, 2vw, 32px)",
          lineHeight: 1,
          background:
            "linear-gradient(135deg, #FFE27A 0%, #FFD700 48%, #E8A000 100%)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          WebkitTextFillColor: "transparent",
          color: "transparent",
          filter: featured
            ? "drop-shadow(0 0 16px rgba(255,215,0,0.55)) drop-shadow(0 0 56px rgba(255,215,0,0.22))"
            : "drop-shadow(0 0 10px rgba(255,215,0,0.32))",
          letterSpacing: -0.5,
          paddingBottom: "0.06em",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {featured ? formatExactDollars(grossAnimated) : formatDollars(grossAnimated)}
      </div>

      {/* Stat row — theaters / PTA / FG score */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 10,
          marginTop: 2,
          paddingTop: 10,
          borderTop: "1px solid rgba(255,215,0,0.10)",
        }}
      >
        <Stat
          label="Theaters"
          value={formatNumber(theatersAnimated)}
          big={featured}
        />
        <Stat
          label="Per-theater"
          value={formatDollars(ptaAnimated)}
          big={featured}
        />
        <Stat
          label="FG Score"
          value={entry.fg_score != null ? entry.fg_score.toFixed(1) : "—"}
          sub={entry.fg_score == null ? "pending" : null}
          big={featured}
          isScore
          scoreLoaded={entry.fg_score != null}
        />
      </div>

      <style jsx global>{`
        @keyframes bomCardIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </article>
  );
}

function Stat({ label, value, sub, big, isScore, scoreLoaded }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontFamily: isScore ? "'Playfair Display', serif" : "'Syne', sans-serif",
          fontWeight: 700,
          fontSize: big ? "clamp(16px, 1.4vw, 20px)" : "clamp(14px, 1.1vw, 16px)",
          lineHeight: 1,
          color: isScore && scoreLoaded ? "#FFD700" : isScore ? "rgba(255,255,255,0.4)" : "#fff",
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
          marginTop: 4,
          fontFamily: "'Syne', sans-serif",
          fontSize: 9.5,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.45)",
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
            color: "rgba(255,255,255,0.35)",
            fontStyle: "italic",
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}
