"use client";

// PosterCard — two visual variants:
//   • featured (#1): horizontal hero, full-width row, 🏆 trophy on rank,
//     larger gross figure, brighter glow + gold ring
//   • standard (#2-#10): vertical poster card, all same size, big italic
//     Playfair rank number overlaid on poster top-left, count-up gross,
//     3-stat strip
//
// Whole card is a <Link> to /?q=<title> — clicking navigates to the Film
// Glance landing page with the URL-param hook auto-firing doSearch on
// mount (existing logic at film-glance.jsx:1413-1432).

import React from "react";
import Link from "next/link";
import { Trophy } from "lucide-react";
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

function buildHref(entry) {
  const params = new URLSearchParams();
  params.set("q", entry.title);
  return `/?${params.toString()}`;
}

// ── Featured variant — #1 hero, horizontal layout ───────────────────────────

function FeaturedCard({ entry }) {
  const grossAnimated = useCountUp(entry.gross || 0, 800);
  const theatersAnimated = useCountUp(entry.theaters || 0, 800);
  const ptaAnimated = useCountUp(entry.pta || 0, 800);

  const posterUrl = entry.poster_path ? `${TMDB_POSTER_BASE}${entry.poster_path}` : null;

  return (
    <Link
      href={buildHref(entry)}
      aria-label={`View ${entry.title} on Film Glance`}
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
    >
      <article
        className="bom-pcard bom-pcard-featured"
        style={{
          position: "relative",
          display: "grid",
          gridTemplateColumns: "minmax(0, 280px) minmax(0, 1fr)",
          gap: 28,
          padding: 24,
          background:
            "linear-gradient(180deg, rgba(20,15,4,0.86) 0%, rgba(8,6,2,0.92) 100%)",
          border: "1.5px solid rgba(255,215,0,0.40)",
          borderRadius: 22,
          backdropFilter: "blur(28px) saturate(1.1)",
          WebkitBackdropFilter: "blur(28px) saturate(1.1)",
          boxShadow:
            "0 32px 96px rgba(0,0,0,0.65), 0 0 120px rgba(255,215,0,0.10), inset 0 1px 0 rgba(255,215,0,0.14)",
          animation: "bomCardIn 0.55s cubic-bezier(0.16,1,0.3,1) both",
          transition: "transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease",
          cursor: "pointer",
          overflow: "hidden",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-4px)";
          e.currentTarget.style.borderColor = "rgba(255,215,0,0.62)";
          e.currentTarget.style.boxShadow =
            "0 40px 120px rgba(0,0,0,0.75), 0 0 160px rgba(255,215,0,0.20), inset 0 1px 0 rgba(255,215,0,0.20)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.borderColor = "rgba(255,215,0,0.40)";
          e.currentTarget.style.boxShadow =
            "0 32px 96px rgba(0,0,0,0.65), 0 0 120px rgba(255,215,0,0.10), inset 0 1px 0 rgba(255,215,0,0.14)";
        }}
      >
        {/* Poster */}
        <div
          style={{
            position: "relative",
            aspectRatio: "2 / 3",
            width: "100%",
            borderRadius: 14,
            overflow: "hidden",
            background: "rgba(0,0,0,0.5)",
            boxShadow: "0 18px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,215,0,0.22)",
          }}
        >
          {posterUrl ? (
            <img
              src={posterUrl}
              alt={entry.title}
              loading="eager"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
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
                fontSize: 56,
              }}
            >
              {entry.title.charAt(0)}
            </div>
          )}
        </div>

        {/* Right column */}
        <div
          className="bom-feat-right"
          style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", minWidth: 0, gap: 16 }}
        >
          {/* Rank badge with trophy */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              alignSelf: "flex-start",
              padding: "8px 18px",
              borderRadius: 999,
              background: "linear-gradient(135deg, #FFE27A 0%, #FFD700 48%, #E8A000 100%)",
              border: "1px solid rgba(255,255,255,0.25)",
              boxShadow: "0 6px 22px rgba(255,215,0,0.40)",
            }}
          >
            <Trophy size={18} style={{ color: "#0a0805" }} aria-hidden="true" />
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 14,
                fontWeight: 800,
                letterSpacing: 1.6,
                color: "#0a0805",
              }}
            >
              #1 — TOP OF THE CHARTS
            </span>
          </div>

          {/* Title + meta */}
          <div style={{ minWidth: 0 }}>
            <h2
              style={{
                margin: 0,
                fontFamily: "'Playfair Display', serif",
                fontStyle: "italic",
                fontWeight: 700,
                fontSize: "clamp(34px, 4vw, 54px)",
                lineHeight: 1.05,
                color: "#fff",
                letterSpacing: -0.5,
                wordBreak: "break-word",
              }}
            >
              {entry.title}
            </h2>
            {(entry.director || entry.year) && (
              <div
                style={{
                  marginTop: 10,
                  fontFamily: "'Syne', sans-serif",
                  fontSize: 16,
                  color: "rgba(255,255,255,0.72)",
                  letterSpacing: 0.2,
                }}
              >
                {entry.director ? <span>Dir. {entry.director}</span> : null}
                {entry.director && entry.year ? <span> · </span> : null}
                {entry.year ? <span>{entry.year}</span> : null}
              </div>
            )}
          </div>

          {/* Gross — huge gold-gradient count-up */}
          <div
            style={{
              fontFamily: "'Playfair Display', serif",
              fontWeight: 700,
              fontSize: "clamp(48px, 5.8vw, 88px)",
              lineHeight: 1,
              background:
                "linear-gradient(135deg, #FFE27A 0%, #FFD700 48%, #E8A000 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
              color: "transparent",
              filter:
                "drop-shadow(0 0 22px rgba(255,215,0,0.55)) drop-shadow(0 0 80px rgba(255,215,0,0.25))",
              letterSpacing: -0.8,
              paddingBottom: "0.06em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {formatExactDollars(grossAnimated)}
          </div>

          {/* Stat strip */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 18,
              paddingTop: 14,
              borderTop: "1px solid rgba(255,215,0,0.16)",
            }}
          >
            <FeaturedStat label="Theaters" value={formatNumber(theatersAnimated)} />
            <FeaturedStat label="Per-theater" value={formatDollars(ptaAnimated)} />
            <FeaturedStat
              label="FG Score"
              value={entry.fg_score != null ? entry.fg_score.toFixed(1) : "—"}
              sub={entry.fg_score == null ? "score pending" : null}
              isScore
              scoreLoaded={entry.fg_score != null}
            />
          </div>
        </div>
      </article>
    </Link>
  );
}

function FeaturedStat({ label, value, sub, isScore, scoreLoaded }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontFamily: isScore ? "'Playfair Display', serif" : "'Syne', sans-serif",
          fontWeight: 700,
          fontSize: "clamp(20px, 1.8vw, 26px)",
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
          marginTop: 5,
          fontFamily: "'Syne', sans-serif",
          fontSize: 11,
          letterSpacing: 1.4,
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
            fontSize: 10,
            color: "rgba(255,255,255,0.36)",
            fontStyle: "italic",
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

// ── Standard variant — #2..#10 uniform vertical card ────────────────────────

function StandardCard({ entry, staggerDelayMs = 0 }) {
  const grossAnimated = useCountUp(entry.gross || 0, 800);
  const posterUrl = entry.poster_path ? `${TMDB_POSTER_BASE}${entry.poster_path}` : null;

  return (
    <Link
      href={buildHref(entry)}
      aria-label={`View ${entry.title} on Film Glance`}
      style={{ textDecoration: "none", color: "inherit", display: "block", height: "100%" }}
    >
      <article
        className="bom-pcard"
        style={{
          // Fixed structural shape so all cards align identically.
          // - Poster: aspect-ratio 2:3, top of card
          // - Title block: fixed 2-line height (line-clamped)
          // - Meta: fixed line height
          // - Gross: 1 line
          // - Stats: fixed grid
          // - flex with consistent padding/gap, all cards same height in grid
          position: "relative",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          background: "rgba(8,6,2,0.62)",
          border: "1px solid rgba(255,215,0,0.10)",
          borderRadius: 16,
          backdropFilter: "blur(20px) saturate(1.1)",
          WebkitBackdropFilter: "blur(20px) saturate(1.1)",
          boxShadow: "0 6px 22px rgba(0,0,0,0.4)",
          animation: `bomCardIn 0.45s cubic-bezier(0.16,1,0.3,1) ${staggerDelayMs}ms both`,
          transition: "transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease",
          cursor: "pointer",
          overflow: "hidden",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-4px)";
          e.currentTarget.style.borderColor = "rgba(255,215,0,0.32)";
          e.currentTarget.style.boxShadow =
            "0 22px 60px rgba(0,0,0,0.6), 0 0 80px rgba(255,215,0,0.06)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.borderColor = "rgba(255,215,0,0.10)";
          e.currentTarget.style.boxShadow = "0 6px 22px rgba(0,0,0,0.4)";
        }}
      >
        {/* Poster with rank overlay */}
        <div
          style={{
            position: "relative",
            aspectRatio: "2 / 3",
            width: "100%",
            background: "rgba(0,0,0,0.5)",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {posterUrl ? (
            <img
              src={posterUrl}
              alt={entry.title}
              loading="lazy"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
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

          {/* Big italic Playfair rank overlay — gold gradient with halo */}
          <div
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              fontFamily: "'Playfair Display', serif",
              fontStyle: "italic",
              fontWeight: 700,
              fontSize: 64,
              lineHeight: 0.9,
              background:
                "linear-gradient(135deg, #FFE27A 0%, #FFD700 48%, #E8A000 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
              color: "transparent",
              filter:
                "drop-shadow(0 4px 8px rgba(0,0,0,0.95)) drop-shadow(0 0 18px rgba(255,215,0,0.55))",
              letterSpacing: -2,
              userSelect: "none",
              pointerEvents: "none",
            }}
          >
            #{entry.rank}
          </div>

          {/* Subtle bottom-of-poster gradient for legibility if title intrudes */}
          <div
            style={{
              position: "absolute",
              left: 0, right: 0, bottom: 0,
              height: 64,
              background: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 100%)",
              pointerEvents: "none",
            }}
          />
        </div>

        {/* Card body — fixed structure, consistent across all cards */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            padding: 14,
            flex: 1,
            minWidth: 0,
          }}
        >
          {/* Title — clamped to 2 lines so all cards align */}
          <h3
            style={{
              margin: 0,
              fontFamily: "'Playfair Display', serif",
              fontStyle: "italic",
              fontWeight: 700,
              fontSize: 18,
              lineHeight: 1.2,
              color: "#fff",
              wordBreak: "break-word",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              minHeight: "2.4em",
            }}
          >
            {entry.title}
          </h3>

          {/* Director · year — single line clipped */}
          <div
            style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: 11.5,
              color: "rgba(255,255,255,0.62)",
              letterSpacing: 0.2,
              lineHeight: 1.35,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              minHeight: "1.35em",
            }}
          >
            {entry.director ? <span>Dir. {entry.director}</span> : null}
            {entry.director && entry.year ? <span> · </span> : null}
            {entry.year ? <span>{entry.year}</span> : null}
          </div>

          {/* Spacer pushes gross + stats to bottom */}
          <div style={{ flex: 1, minHeight: 4 }} />

          {/* Gross */}
          <div
            style={{
              fontFamily: "'Playfair Display', serif",
              fontWeight: 700,
              fontSize: 28,
              lineHeight: 1,
              background:
                "linear-gradient(135deg, #FFE27A 0%, #FFD700 48%, #E8A000 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
              color: "transparent",
              filter: "drop-shadow(0 0 10px rgba(255,215,0,0.32))",
              letterSpacing: -0.5,
              paddingBottom: "0.06em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {formatDollars(grossAnimated)}
          </div>

          {/* Stat row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 8,
              paddingTop: 8,
              borderTop: "1px solid rgba(255,215,0,0.10)",
            }}
          >
            <StandardStat label="Theaters" value={formatNumber(entry.theaters)} />
            <StandardStat label="Per-theater" value={formatDollars(entry.pta)} />
            <StandardStat
              label="FG Score"
              value={entry.fg_score != null ? entry.fg_score.toFixed(1) : "—"}
              isScore
              scoreLoaded={entry.fg_score != null}
            />
          </div>
        </div>
      </article>
    </Link>
  );
}

function StandardStat({ label, value, isScore, scoreLoaded }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontFamily: isScore ? "'Playfair Display', serif" : "'Syne', sans-serif",
          fontWeight: 700,
          fontSize: 15,
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
    </div>
  );
}

// ── Default export — chooses variant based on featured prop ────────────────

export default function PosterCard({ entry, featured = false, staggerDelayMs = 0 }) {
  if (!entry) return null;
  if (featured) return <FeaturedCard entry={entry} />;
  return <StandardCard entry={entry} staggerDelayMs={staggerDelayMs} />;
}

// Global keyframes (used by both variants)
if (typeof document !== "undefined" && !document.getElementById("bom-pcard-keyframes")) {
  const style = document.createElement("style");
  style.id = "bom-pcard-keyframes";
  style.textContent = `
    @keyframes bomCardIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
}
