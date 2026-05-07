"use client";

// DiscoverFeatured — #1 hero card on /discover, mirrors box-office's
// FeaturedCard rhythm. Horizontal layout (poster left, meta right) with
// large gold-gradient FG score (instead of gross), italic Playfair title,
// release-window pill, and a Crown badge.

import React from "react";
import Link from "next/link";
import { Crown, Heart, Tv, Film as FilmIcon } from "lucide-react";

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
        top: 12, right: 12,
        width: 42, height: 42,
        borderRadius: 999,
        background: favorited ? "rgba(255, 215, 0, 0.18)" : "rgba(8, 6, 2, 0.78)",
        border: `1px solid ${favorited ? "rgba(255, 215, 0, 0.62)" : "rgba(255, 215, 0, 0.32)"}`,
        backdropFilter: "blur(12px) saturate(1.1)",
        WebkitBackdropFilter: "blur(12px) saturate(1.1)",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
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
        size={20}
        strokeWidth={2.2}
        fill={favorited ? "#FFD700" : "none"}
        color={favorited ? "#FFD700" : "rgba(255, 215, 0, 0.88)"}
        aria-hidden="true"
      />
    </button>
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
        gap: 7,
        padding: "5px 14px",
        borderRadius: 999,
        border: `1px solid ${isTheaters ? "rgba(255,215,0,0.42)" : "rgba(255,255,255,0.16)"}`,
        background: isTheaters ? "rgba(255, 215, 0, 0.08)" : "rgba(255, 255, 255, 0.04)",
        color: isTheaters ? "#FFD700" : "rgba(255,255,255,0.78)",
        fontFamily: "'Syne', sans-serif",
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: 0.4,
      }}
    >
      <Icon size={12} aria-hidden="true" />
      {label}
    </span>
  );
}

export default function DiscoverFeatured({ entry, releaseWindow, favorited = false, onToggleFavorite }) {
  if (!entry) return null;
  const posterUrl = entry.poster_path ? `${TMDB_POSTER_BASE}${entry.poster_path}` : null;
  const score = entry.fg_score != null ? Number(entry.fg_score).toFixed(1) : "—";

  return (
    <Link
      href={buildHref(entry)}
      aria-label={`View ${entry.title} on Film Glance`}
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
    >
      <article
        className="dis-featured"
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
          animation: "disCardIn 0.55s cubic-bezier(0.16,1,0.3,1) both",
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
                display: "flex", alignItems: "center", justifyContent: "center",
                height: "100%",
                fontFamily: "'Playfair Display', serif", fontStyle: "italic",
                color: "rgba(255,215,0,0.32)", fontSize: 56,
              }}
            >
              {entry.title?.charAt(0)}
            </div>
          )}
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

        {/* Right column */}
        <div
          className="dis-featured-right"
          style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", minWidth: 0, gap: 16 }}
        >
          {/* Top row: rank crown + release pill */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 9,
                padding: "6px 16px",
                borderRadius: 999,
                background: "linear-gradient(135deg, #FFE27A 0%, #FFD700 48%, #E8A000 100%)",
                border: "1px solid rgba(0,0,0,0.18)",
                boxShadow: "0 5px 18px rgba(255,215,0,0.40)",
              }}
            >
              <Crown size={16} style={{ color: "#0a0805" }} aria-hidden="true" strokeWidth={2.4} />
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: 1.4,
                  color: "#0a0805",
                }}
              >
                TOP PICK
              </span>
            </div>
            {releaseWindow && <ReleasePill window={releaseWindow} />}
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
                  fontSize: 17,
                  color: "rgba(255,255,255,0.78)",
                  letterSpacing: 0.2,
                }}
              >
                {entry.director ? <span>Director: {entry.director}</span> : null}
                {entry.director && entry.year ? <span> · </span> : null}
                {entry.year ? <span>{entry.year}</span> : null}
              </div>
            )}
            {entry.genre && (
              <div
                style={{
                  marginTop: 6,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11.5,
                  color: "rgba(255, 215, 0, 0.6)",
                  letterSpacing: 0.6,
                }}
              >
                {entry.genre}
              </div>
            )}
          </div>

          {/* FG score — huge gold-gradient */}
          <div
            style={{
              fontFamily: "'Playfair Display', serif",
              fontStyle: "italic",
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
            {score}
            <span
              style={{
                marginLeft: 10,
                fontFamily: "'JetBrains Mono', monospace",
                fontStyle: "normal",
                fontSize: 14,
                color: "rgba(255,215,0,0.6)",
                letterSpacing: 1.4,
                WebkitTextFillColor: "rgba(255,215,0,0.6)",
                filter: "none",
              }}
            >
              /10 FILM GLANCE SCORE
            </span>
          </div>
        </div>
      </article>

      <style jsx global>{`
        @media (max-width: 720px) {
          .dis-featured {
            grid-template-columns: 1fr !important;
            padding: 18px !important;
            gap: 18px !important;
          }
          .dis-featured-right h2 { font-size: 32px !important; }
        }
      `}</style>
    </Link>
  );
}
