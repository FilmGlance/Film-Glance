"use client";

// CinematicHero — full-bleed top hero for /discover. The #1 film's
// backdrop image dominates; hero text floats over a vignette. Replaces the
// text-only DiscoverHero and the separate TOP PICK card with one
// cinematic statement.
//
// v6.5.3 — image-forward redesign per user "really make some graphical
// UI changes that will WOW users" feedback.

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Heart, Play } from "lucide-react";

const TMDB_BACKDROP_W1280 = "https://image.tmdb.org/t/p/w1280";

function HeartButton({ favorited, onToggle, ariaLabel }) {
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
        width: 44,
        height: 44,
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
          ? "0 4px 16px rgba(255,215,0,0.35), 0 0 22px rgba(255,215,0,0.22)"
          : "0 4px 16px rgba(0,0,0,0.55)",
        transition: "transform 0.2s cubic-bezier(0.16,1,0.3,1), background 0.25s ease, border-color 0.25s ease",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.08)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
    >
      <Heart
        size={22}
        strokeWidth={2.2}
        fill={favorited ? "#FFD700" : "none"}
        color={favorited ? "#FFD700" : "rgba(255, 215, 0, 0.92)"}
        aria-hidden="true"
      />
    </button>
  );
}

export default function CinematicHero({ entry, loading, favorited, onToggleFavorite }) {
  const [animKey, setAnimKey] = useState(0);

  // Bump animKey when the featured film changes so the entrance replays
  // for the new backdrop. Keeps the page feeling alive when filters change.
  useEffect(() => {
    if (entry?.search_key) setAnimKey((k) => k + 1);
  }, [entry?.search_key]);

  const backdrop = entry?.backdrop_path ? `${TMDB_BACKDROP_W1280}${entry.backdrop_path}` : null;
  const score = entry?.fg_score != null ? Number(entry.fg_score).toFixed(1) : null;
  const buildHref = (e) => `/?q=${encodeURIComponent(e.title)}`;

  return (
    <header
      key={animKey}
      style={{
        position: "relative",
        width: "100%",
        height: "min(62vh, 580px)",
        minHeight: 420,
        overflow: "hidden",
        marginBottom: 48,
      }}
    >
      {/* Backdrop layer */}
      {backdrop ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url("${backdrop}")`,
            backgroundSize: "cover",
            backgroundPosition: "center 28%",
            transform: "scale(1.05)",
            animation: "cinematicBackdropFade 1.2s cubic-bezier(0.16,1,0.3,1) both",
          }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(135deg, rgba(20,15,4,0.92), rgba(8,6,2,0.96))",
          }}
        />
      )}

      {/* Multi-stop vignette: darken behind sticky nav (top), brighten in
          middle so the still is visible, then heavy darken at bottom for
          legibility. Plus a left-edge fade so text floats clean. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.22) 22%, rgba(0,0,0,0.18) 50%, rgba(5,5,5,0.78) 82%, rgba(5,5,5,1) 100%)",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, rgba(5,5,5,0.78) 0%, rgba(5,5,5,0.30) 32%, rgba(5,5,5,0) 60%)",
        }}
      />

      {/* Content — pinned to bottom, aligned with the page's 1200px column */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 24px 56px",
        }}
      >
        {/* Right-floating heart button for the featured film */}
        {entry && onToggleFavorite && (
          <div
            style={{
              position: "absolute",
              right: 24,
              top: "calc(-1 * min(62vh, 580px) + 24px)",
              zIndex: 2,
            }}
          >
            <HeartButton
              favorited={!!favorited}
              onToggle={() => onToggleFavorite(entry)}
              ariaLabel={favorited ? `Remove ${entry.title} from favorites` : `Save ${entry.title} to favorites`}
            />
          </div>
        )}

        <h1
          style={{
            margin: 0,
            fontFamily: "'Playfair Display', serif",
            fontWeight: 700,
            fontSize: "clamp(56px, 8.4vw, 116px)",
            lineHeight: 1.02,
            letterSpacing: -1.8,
            color: "#fff",
            animation: "cinematicHeroLineIn 0.85s cubic-bezier(0.16,1,0.3,1) both",
          }}
        >
          Discover.
        </h1>
        <p
          style={{
            margin: "6px 0 0",
            fontFamily: "'Playfair Display', serif",
            fontWeight: 700,
            fontSize: "clamp(28px, 4.4vw, 56px)",
            lineHeight: 1.18,
            letterSpacing: -0.8,
            color: "#FFD700",
            animation: "cinematicHeroLineIn 0.85s cubic-bezier(0.16,1,0.3,1) 0.14s both",
          }}
        >
          Films Worth Your Evening.
        </p>

        {/* Now-featuring caption */}
        {entry && !loading && (
          <Link
            href={buildHref(entry)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 14,
              marginTop: 22,
              padding: "10px 20px",
              borderRadius: 999,
              background: "rgba(8,6,2,0.65)",
              border: "1px solid rgba(255,215,0,0.32)",
              backdropFilter: "blur(12px) saturate(1.1)",
              WebkitBackdropFilter: "blur(12px) saturate(1.1)",
              textDecoration: "none",
              color: "#fff",
              animation: "cinematicHeroLineIn 0.85s cubic-bezier(0.16,1,0.3,1) 0.32s both",
              transition: "border-color 0.25s ease, background 0.25s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,215,0,0.62)";
              e.currentTarget.style.background = "rgba(8,6,2,0.82)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,215,0,0.32)";
              e.currentTarget.style.background = "rgba(8,6,2,0.65)";
            }}
          >
            <Play size={14} fill="#FFD700" color="#FFD700" aria-hidden="true" />
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                letterSpacing: 1.6,
                textTransform: "uppercase",
                color: "rgba(255,215,0,0.78)",
                fontWeight: 600,
              }}
            >
              Now featuring
            </span>
            <span
              style={{
                fontFamily: "'Playfair Display', serif",
                fontStyle: "italic",
                fontSize: 18,
                fontWeight: 700,
                color: "#fff",
                letterSpacing: -0.2,
              }}
            >
              {entry.title}
            </span>
            {score && (
              <>
                <span style={{ color: "rgba(255,255,255,0.32)", fontFamily: "'Syne', sans-serif" }}>·</span>
                <span
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    fontWeight: 700,
                    fontSize: 18,
                    color: "#FFD700",
                    letterSpacing: -0.2,
                  }}
                >
                  {score}
                  <span
                    style={{
                      marginLeft: 4,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 10,
                      letterSpacing: 1.2,
                      color: "rgba(255,215,0,0.55)",
                    }}
                  >
                    /10
                  </span>
                </span>
              </>
            )}
          </Link>
        )}
      </div>

      <style jsx global>{`
        @keyframes cinematicHeroLineIn {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes cinematicBackdropFade {
          from { opacity: 0; transform: scale(1.10); }
          to   { opacity: 1; transform: scale(1.05); }
        }
        @keyframes disCardIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes disSpinReel {
          from { transform: translateY(0); }
          to   { transform: var(--reel-final); }
        }
        @keyframes disResultIn {
          from { opacity: 0; transform: scale(0.92); filter: drop-shadow(0 0 0 rgba(255,215,0,0)); }
          to   { opacity: 1; transform: scale(1);    filter: drop-shadow(0 0 22px rgba(255,215,0,0.45)); }
        }
      `}</style>
    </header>
  );
}
