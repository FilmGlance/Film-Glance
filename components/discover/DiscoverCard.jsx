"use client";

// DiscoverCard — single movie card on /discover.
//
// v6.4.1 rewrite: mirrors components/box-office/PosterCard.jsx StandardCard
// structure (per user feedback "format the movie suggestions in the same
// formatting as the Box Office page"). Adaptations:
//   • Where box-office shows gross → big gold-gradient italic Playfair
//     FG score with "/10 FILM GLANCE SCORE" subtitle
//   • Where box-office shows Theaters / Per-theater / FG Score 3-stat strip
//     → Year / Genre / Sources (the relevant Discover dimensions)
//   • No rank badge (Discover ranking shifts per filter)
//   • Adds release-window pill (In Theaters / At Home) at the bottom
//
// Click → /?q=<title>; landing page's URL hook auto-fires doSearch on mount.
// Heart button stop-propagates the click so the card's <Link> doesn't fire.

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
          fontWeight: 700,
          fontSize: 18,
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
      }}
    >
      <Icon size={11} aria-hidden="true" />
      {label}
    </span>
  );
}

function firstGenre(g) {
  if (!g) return null;
  const i = g.indexOf(" · ");
  return i > 0 ? g.slice(0, i) : g;
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
  const sourceCount = typeof entry.source_count === "number" ? entry.source_count : null;
  const primaryGenre = firstGenre(entry.genre);

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
        {/* Poster — heart only (no rank badge for Discover; rank shifts per filter) */}
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

          {/* Bottom-of-poster legibility gradient */}
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

        {/* Body — same fixed structure as box-office StandardCard */}
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
          {/* Title — italic Playfair, 2-line clamp */}
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
              fontSize: 13.5,
              color: "rgba(255,255,255,0.72)",
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

          {/* Spacer pushes score + stats to bottom */}
          <div style={{ flex: 1, minHeight: 4 }} />

          {/* FG score — big gold-gradient (where box-office has gross) */}
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 8,
            }}
          >
            <span
              style={{
                fontFamily: "'Playfair Display', serif",
                fontStyle: "italic",
                fontWeight: 700,
                fontSize: 38,
                lineHeight: 1,
                background: score
                  ? "linear-gradient(135deg, #FFE27A 0%, #FFD700 48%, #E8A000 100%)"
                  : "rgba(255,255,255,0.3)",
                WebkitBackgroundClip: score ? "text" : "border-box",
                backgroundClip: score ? "text" : "border-box",
                WebkitTextFillColor: score ? "transparent" : "rgba(255,255,255,0.3)",
                color: score ? "transparent" : "rgba(255,255,255,0.3)",
                filter: score ? "drop-shadow(0 0 12px rgba(255,215,0,0.42))" : "none",
                letterSpacing: -0.6,
                paddingBottom: "0.06em",
              }}
            >
              {score ?? "—"}
            </span>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                color: "rgba(255,215,0,0.6)",
                letterSpacing: 1.2,
              }}
            >
              /10 FILM GLANCE SCORE
            </span>
          </div>

          {/* 3-stat strip */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 8,
              paddingTop: 8,
              borderTop: "1px solid rgba(255,215,0,0.10)",
            }}
          >
            <StandardStat label="Year" value={entry.year ?? "—"} monoValue />
            <StandardStat label="Genre" value={primaryGenre ?? "—"} />
            <StandardStat label="Sources" value={sourceCount ?? "—"} monoValue />
          </div>

          {/* Release-window pill at the very bottom */}
          {releaseWindow && (
            <div style={{ display: "flex", marginTop: 4 }}>
              <ReleasePill window={releaseWindow} />
            </div>
          )}
        </div>
      </article>
    </Link>
  );
}
