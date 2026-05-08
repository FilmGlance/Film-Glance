"use client";

// DiscoverCard — single movie card on /discover.
//
// v6.6.1: brought into visual parity with the v6.6.0 box-office PosterCard
// per user feedback "Fix the discover page so it is JUST AS GOOD AND
// PREMIUM as the box office page." Mirror moves:
//   • Big focal FG Score figure (Playfair, 30px, solid #FFD700) where
//     the box office card has its gross figure.
//   • Score bar — 6px gold-gradient horizontal bar visualizing
//     score/10 × 100% (analog of the box office gross-share bar). Score
//     of 8.6 → 86% bar; 7.0 → 70% bar; visual encoding of quality.
//   • Synopsis tightened from 5 lines → 3 to leave room for the score
//     block at the bottom.
//   • Dropped the redundant 2-stat strip (Year + FG Score) — Year
//     already lives in the director · year row above; FG Score is now
//     the headline.
//
// Click → /?q=<title>; landing-page URL hook auto-fires doSearch on mount.

import React from "react";
import Link from "next/link";
import { Heart } from "lucide-react";

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

export default function DiscoverCard({
  entry,
  staggerDelayMs = 0,
  favorited = false,
  onToggleFavorite,
}) {
  if (!entry) return null;
  const posterUrl = entry.poster_path ? `${TMDB_POSTER_BASE}${entry.poster_path}` : null;
  const scoreNum = entry.fg_score != null ? Number(entry.fg_score) : null;
  const scoreText = scoreNum != null ? scoreNum.toFixed(1) : null;
  // Score bar — clamp to [4%, 100%] so a 0.4 score still shows a tiny nub.
  const scorePct =
    scoreNum != null ? Math.min(100, Math.max(4, Math.round((scoreNum / 10) * 100))) : null;

  return (
    <Link
      href={buildHref(entry)}
      aria-label={`View ${entry.title} on Film Glance`}
      style={{ textDecoration: "none", color: "inherit", display: "block", height: "100%" }}
    >
      <style jsx>{`
        .dis-card:hover {
          transform: translateY(-6px) scale(1.015);
          border-color: rgba(255, 215, 0, 0.42) !important;
          box-shadow: 0 28px 70px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 215, 0, 0.16),
            0 0 60px rgba(255, 215, 0, 0.08) !important;
        }
        .dis-card:hover :global(.dis-card-poster) {
          transform: scale(1.06);
        }
        .dis-card:hover :global(.dis-card-bar-fill) {
          filter: brightness(1.12);
        }
      `}</style>
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
          transition:
            "transform 0.35s cubic-bezier(0.16,1,0.3,1), border-color 0.25s ease, box-shadow 0.25s ease",
          cursor: "pointer",
          overflow: "hidden",
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
              className="dis-card-poster"
              src={posterUrl}
              alt={entry.title}
              loading="lazy"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
                transition: "transform 0.55s cubic-bezier(0.16,1,0.3,1)",
                transform: "scale(1)",
              }}
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

          {/* Synopsis — 3-line clamp (was 5; tightened to make room for the
              score block below). Non-italic body so longer synopses stay
              legible at small sizes. */}
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
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {entry.overview}
            </p>
          )}

          {/* Spacer pushes the score block to the bottom */}
          <div style={{ flex: 1, minHeight: 6 }} />

          {/* FG Score — focal headline number (mirrors the box-office gross
              figure). Crisp solid Playfair gold, no gradient text smear, no
              drop-shadow glow. Tight against the score bar below. */}
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 6,
              fontFamily: "'Playfair Display', serif",
              fontWeight: 700,
              lineHeight: 1,
              color: scoreText ? "#FFD700" : "rgba(255,255,255,0.4)",
              letterSpacing: -0.5,
              paddingBottom: "0.06em",
            }}
          >
            <span style={{ fontSize: 30 }}>{scoreText ?? "—"}</span>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                letterSpacing: 1.2,
                color: "rgba(255, 215, 0, 0.55)",
                fontWeight: 600,
              }}
            >
              /10 FG SCORE
            </span>
          </div>

          {/* Score bar — visualizes score/10 × 100%, mirroring the
              box-office gross-share bar. */}
          {scorePct != null && (
            <div
              style={{
                position: "relative",
                width: "100%",
                height: 6,
                borderRadius: 999,
                background: "rgba(255,215,0,0.10)",
                overflow: "hidden",
              }}
            >
              <div
                className="dis-card-bar-fill"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: `${scorePct}%`,
                  background:
                    "linear-gradient(90deg, rgba(255,215,0,0.45) 0%, #FFD700 60%, #FFE27A 100%)",
                  borderRadius: 999,
                  boxShadow: "0 0 12px rgba(255,215,0,0.32)",
                  transition: "filter 0.25s ease, width 0.6s cubic-bezier(0.16,1,0.3,1)",
                }}
              />
            </div>
          )}
        </div>
      </article>
    </Link>
  );
}
