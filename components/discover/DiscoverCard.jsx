"use client";

// DiscoverCard — single movie card on /discover.
//
// v6.4.1 round 2: dropped the big gold-gradient FG-score "headline" (the
// user called it a "yellow smear"); FG score now lives in the small stat
// strip alongside Year — exactly the box-office StandardCard treatment.
// Synopsis snippet (first 2 lines, italic) fills the visual middle of the
// card so it doesn't feel empty without the headline. Genre row is
// full-width (no longer in the stat strip) so it can't truncate.
// Sources count removed (per user request).
//
// Click → /?q=<title>; landing-page URL hook auto-fires doSearch on mount.

import React from "react";
import Link from "next/link";
import { Heart, Tv, Film as FilmIcon } from "lucide-react";

const TMDB_POSTER_BASE = "https://image.tmdb.org/t/p/w500";

function buildHref(entry) {
  const params = new URLSearchParams();
  params.set("q", entry.title);
  return `/?${params.toString()}`;
}

function FavoriteButton({ favorited, onToggle, ariaLabel }) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      style={{
        position: "absolute",
        top: 10,
        right: 10,
        width: 36,
        height: 36,
        borderRadius: 999,
        background: favorited ? "rgba(255, 215, 0, 0.18)" : "rgba(8, 6, 2, 0.78)",
        border: `1px solid ${favorited ? "rgba(255, 215, 0, 0.62)" : "rgba(255, 215, 0, 0.32)"}`,
        backdropFilter: "blur(12px) saturate(1.1)",
        WebkitBackdropFilter: "blur(12px) saturate(1.1)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        boxShadow: favorited
          ? "0 4px 16px rgba(255,215,0,0.35), 0 0 18px rgba(255,215,0,0.22)"
          : "0 4px 14px rgba(0,0,0,0.5)",
        transition: "transform 0.2s ease, background 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease",
        zIndex: 3,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.08)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
    >
      <Heart
        size={18}
        strokeWidth={2.2}
        fill={favorited ? "#FFD700" : "none"}
        color={favorited ? "#FFD700" : "rgba(255, 215, 0, 0.88)"}
        aria-hidden="true"
      />
    </button>
  );
}

function StandardStat({ label, value, isScore, scoreLoaded, monoValue }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontFamily: monoValue ? "'JetBrains Mono', monospace" : (isScore ? "'Playfair Display', serif" : "'Syne', sans-serif"),
          fontStyle: isScore ? "italic" : "normal",
          fontWeight: 700,
          fontSize: 20,
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
          letterSpacing: 1.2,
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.55)",
          fontWeight: 600,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function ReleasePill({ window: rw }) {
  const isTheaters = rw === "in_theaters";
  const Icon = isTheaters ? FilmIcon : Tv;
  const label = isTheaters ? "In Theaters" : "At Home";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px",
        borderRadius: 999,
        border: `1px solid ${isTheaters ? "rgba(255,215,0,0.42)" : "rgba(255,255,255,0.16)"}`,
        background: isTheaters ? "rgba(255, 215, 0, 0.06)" : "rgba(255, 255, 255, 0.04)",
        color: isTheaters ? "#FFD700" : "rgba(255,255,255,0.78)",
        fontFamily: "'Syne', sans-serif",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.4,
        whiteSpace: "nowrap",
      }}
    >
      <Icon size={11} aria-hidden="true" />
      {label}
    </span>
  );
}

export default function DiscoverCard({
  entry,
  staggerDelayMs = 0,
  favorited = false,
  onToggleFavorite,
  releaseWindow,
}) {
  if (!entry) return null;
  const posterUrl = entry.poster_path ? `${TMDB_POSTER_BASE}${entry.poster_path}` : null;
  const score = entry.fg_score != null ? Number(entry.fg_score).toFixed(1) : null;

  return (
    <Link
      href={buildHref(entry)}
      aria-label={`View ${entry.title} on Film Glance`}
      style={{ textDecoration: "none", color: "inherit", display: "block", height: "100%" }}
    >
      <article
        className="dis-card"
        style={{
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
          animation: `disCardIn 0.45s cubic-bezier(0.16,1,0.3,1) ${staggerDelayMs}ms both`,
          transition: "transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease",
          cursor: "pointer",
          overflow: "hidden",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-4px)";
          e.currentTarget.style.borderColor = "rgba(255,215,0,0.32)";
          e.currentTarget.style.boxShadow = "0 22px 60px rgba(0,0,0,0.6), 0 0 80px rgba(255,215,0,0.06)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.borderColor = "rgba(255,215,0,0.10)";
          e.currentTarget.style.boxShadow = "0 6px 22px rgba(0,0,0,0.4)";
        }}
      >
        {/* Poster */}
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
                display: "flex", alignItems: "center", justifyContent: "center",
                height: "100%",
                fontFamily: "'Playfair Display', serif", fontStyle: "italic",
                color: "rgba(255,215,0,0.32)", fontSize: 36,
              }}
            >
              {entry.title?.charAt(0)}
            </div>
          )}

          <div
            style={{
              position: "absolute", left: 0, right: 0, bottom: 0,
              height: 64,
              background: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 100%)",
              pointerEvents: "none",
            }}
          />

          {onToggleFavorite && (
            <FavoriteButton
              favorited={!!favorited}
              onToggle={() => onToggleFavorite(entry)}
              ariaLabel={
                favorited
                  ? `Remove ${entry.title} from favorites`
                  : `Save ${entry.title} to favorites`
              }
            />
          )}
        </div>

        {/* Body */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            padding: 16,
            flex: 1,
            minWidth: 0,
          }}
        >
          {/* Title — italic Playfair, 2-line clamp */}
          <h3
            style={{
              margin: 0,
              fontFamily: "'Playfair Display', serif",
              fontStyle: "italic",
              fontWeight: 700,
              fontSize: 20,
              lineHeight: 1.2,
              color: "#fff",
              wordBreak: "break-word",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              minHeight: "2.4em",
              letterSpacing: -0.2,
            }}
          >
            {entry.title}
          </h3>

          {/* Director · year */}
          <div
            style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: 13,
              color: "rgba(255,255,255,0.7)",
              letterSpacing: 0.2,
              lineHeight: 1.35,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              minHeight: "1.35em",
            }}
          >
            {entry.director ? <span>Director: {entry.director}</span> : null}
            {entry.director && entry.year ? <span> · </span> : null}
            {entry.year ? <span>{entry.year}</span> : null}
          </div>

          {/* Genre — full-width row, won't truncate inside a 1/3-column stat */}
          {entry.genre && (
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10.5,
                color: "rgba(255, 215, 0, 0.55)",
                letterSpacing: 0.6,
                lineHeight: 1.4,
                wordBreak: "break-word",
              }}
            >
              {entry.genre}
            </div>
          )}

          {/* Synopsis — 5-line clamp, non-italic body. v6.4.1 round-4 polish:
              user found italic + 3-line clamp truncated mid-sentence on
              cards like Schindler's List ("his Jewish workfor..."). Dropped
              italic, raised clamp to 5, added ellipsis. */}
          {entry.overview && (
            <p
              style={{
                margin: 0,
                fontFamily: "'Syne', sans-serif",
                fontSize: 13,
                lineHeight: 1.55,
                color: "rgba(255,255,255,0.72)",
                letterSpacing: 0.05,
                display: "-webkit-box",
                WebkitLineClamp: 5,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {entry.overview}
            </p>
          )}

          {/* Spacer pushes stats + pill to bottom */}
          <div style={{ flex: 1, minHeight: 6 }} />

          {/* 2-stat strip: Year · FG Score (clean — no smear) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              paddingTop: 10,
              borderTop: "1px solid rgba(255,215,0,0.10)",
            }}
          >
            <StandardStat label="Year" value={entry.year ?? "—"} monoValue />
            <StandardStat
              label="FG Score"
              value={score ?? "—"}
              isScore
              scoreLoaded={score != null}
            />
          </div>

          {/* Release pill removed v6.4.1 round 4 — was redundant with the
              In Theaters / At Home filter the user already chose. */}
        </div>
      </article>
    </Link>
  );
}
