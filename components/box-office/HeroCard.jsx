"use client";

// HeroCard — the #1 movie of the current chart, rendered cinematically:
// large poster (240×360 desktop, 130×195 mobile), Playfair italic title,
// big gold-gradient gross figure with count-up animation, theaters +
// per-theater average + FG score in a stat strip below.

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

export default function HeroCard({ entry }) {
  if (!entry) return null;
  const grossAnimated = useCountUp(entry.gross || 0, 800);
  const theatersAnimated = useCountUp(entry.theaters || 0, 800);
  const ptaAnimated = useCountUp(entry.pta || 0, 800);

  const posterUrl = entry.poster_path ? `${TMDB_POSTER_BASE}${entry.poster_path}` : null;

  return (
    <article
      style={{
        position: "relative",
        display: "grid",
        gridTemplateColumns: "minmax(0, 240px) minmax(0, 1fr)",
        gap: 32,
        padding: 28,
        background:
          "linear-gradient(180deg, rgba(14,11,4,0.78) 0%, rgba(8,6,2,0.84) 100%)",
        border: "1px solid rgba(255,215,0,0.16)",
        borderRadius: 22,
        backdropFilter: "blur(28px) saturate(1.1)",
        WebkitBackdropFilter: "blur(28px) saturate(1.1)",
        boxShadow:
          "0 32px 96px rgba(0,0,0,0.65), 0 0 120px rgba(255,215,0,0.05), inset 0 1px 0 rgba(255,215,0,0.08)",
        animation: "bomHeroIn 0.55s cubic-bezier(0.16,1,0.3,1) 0.1s both",
        overflow: "hidden",
      }}
      className="bom-hero-card"
    >
      {/* Rank badge top-left */}
      <div
        style={{
          position: "absolute",
          top: 18,
          left: 18,
          padding: "5px 12px",
          borderRadius: 999,
          background: "rgba(0,0,0,0.6)",
          border: "1px solid rgba(255,215,0,0.32)",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11.5,
          letterSpacing: 1.4,
          color: "#FFD700",
          zIndex: 2,
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
          borderRadius: 14,
          overflow: "hidden",
          background: "rgba(0,0,0,0.5)",
          boxShadow: "0 18px 60px rgba(0,0,0,0.55)",
        }}
      >
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={entry.title}
            loading="eager"
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
              fontSize: 28,
            }}
          >
            {entry.title.charAt(0)}
          </div>
        )}
      </div>

      {/* Right column */}
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", minWidth: 0 }}>
        <div>
          <h2
            style={{
              fontFamily: "'Playfair Display', serif",
              fontStyle: "italic",
              fontWeight: 700,
              fontSize: "clamp(34px, 4.4vw, 56px)",
              lineHeight: 1.05,
              margin: 0,
              color: "#fff",
              letterSpacing: -0.4,
              wordBreak: "break-word",
            }}
          >
            {entry.title}
          </h2>
          {entry.year && (
            <div
              style={{
                marginTop: 10,
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 13.5,
                letterSpacing: 1.4,
                color: "rgba(255,215,0,0.7)",
              }}
            >
              {entry.year}
            </div>
          )}
        </div>

        {/* Stat strip */}
        <div
          style={{
            marginTop: 28,
            display: "grid",
            gridTemplateColumns: "1fr auto auto auto",
            gap: 22,
            alignItems: "end",
          }}
          className="bom-hero-stats"
        >
          <Stat
            primary={true}
            label="Gross"
            value={formatExactDollars(grossAnimated)}
            valueSize="clamp(40px, 5vw, 76px)"
          />
          <Stat
            label="Theaters"
            value={formatNumber(theatersAnimated)}
            valueSize="clamp(22px, 2.2vw, 32px)"
          />
          <Stat
            label="Per-theater"
            value={formatDollars(ptaAnimated)}
            valueSize="clamp(22px, 2.2vw, 32px)"
          />
          <Stat
            label="FG Score"
            value={
              entry.fg_score != null
                ? entry.fg_score.toFixed(1)
                : "—"
            }
            sub={entry.fg_score == null ? "score pending" : null}
            valueSize="clamp(34px, 3.6vw, 56px)"
            primaryColor={entry.fg_score == null ? "rgba(255,255,255,0.55)" : "#FFD700"}
          />
        </div>
      </div>

      <style jsx global>{`
        @keyframes bomHeroIn {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @media (max-width: 720px) {
          .bom-hero-card {
            grid-template-columns: minmax(0, 130px) minmax(0, 1fr) !important;
            gap: 18px !important;
            padding: 18px !important;
          }
          .bom-hero-stats {
            grid-template-columns: 1fr 1fr !important;
            gap: 14px !important;
            row-gap: 18px !important;
          }
        }
      `}</style>
    </article>
  );
}

function Stat({ label, value, sub, primary, valueSize, primaryColor }) {
  const color = primaryColor ?? (primary ? "#FFD700" : "#fff");
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontFamily: "'Playfair Display', serif",
          fontWeight: 700,
          fontSize: valueSize || "clamp(28px, 3vw, 48px)",
          lineHeight: 1,
          background:
            primary
              ? "linear-gradient(135deg, #FFE27A 0%, #FFD700 48%, #E8A000 100%)"
              : "none",
          WebkitBackgroundClip: primary ? "text" : "border-box",
          backgroundClip: primary ? "text" : "border-box",
          WebkitTextFillColor: primary ? "transparent" : "currentColor",
          color: primary ? "transparent" : color,
          filter: primary
            ? "drop-shadow(0 0 18px rgba(255,215,0,0.5)) drop-shadow(0 0 56px rgba(255,215,0,0.22))"
            : "none",
          paddingBottom: primary ? "0.06em" : 0,
          letterSpacing: -0.5,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {value}
      </div>
      <div
        style={{
          marginTop: 6,
          fontFamily: "'Syne', sans-serif",
          fontSize: 11.5,
          letterSpacing: 1.4,
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.55)",
        }}
      >
        {label}
      </div>
      {sub && (
        <div
          style={{
            marginTop: 2,
            fontFamily: "'Syne', sans-serif",
            fontSize: 10.5,
            color: "rgba(255,255,255,0.4)",
            letterSpacing: 0.4,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}
