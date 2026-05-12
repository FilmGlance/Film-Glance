"use client";

// CinematicBoxOfficeHero — full-bleed top hero for /boxoffice. The #1 film's
// backdrop image dominates the first viewport; period chip + Box Office
// headline + a glass strip showing #1 / gross / theaters live underneath.
//
// Replaces both the text-only PageHero and the horizontal FeaturedCard
// variant of PosterCard. The hero IS the #1 film — no separate hero card
// below — same architectural move as v6.5.3 on /discover.
//
// v6.6.0 — image-forward Box Office redesign per user "apply that same
// review rigor to improve the UI of the Box Office page" feedback.

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { useCountUp } from "@/lib/use-count-up";

const TMDB_BACKDROP_W1280 = "https://image.tmdb.org/t/p/w1280";

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Format the headline subline based on period_type + dates.
// v6.6.1: dropped the period chip — info was redundant with the subline.
//
//   weekly  Oct 6 — 12, 2025  → "The Top 10 of Oct 6 — 12, 2025."
//   monthly Oct 2025          → "The Top 10 of October 2025."
//   yearly  2025              → "The Top 10 of 2025."
function formatPeriodSubline(periodType, periodStart, periodEnd) {
  if (!periodStart) return "The Top 10.";
  const start = new Date(`${periodStart}T00:00:00Z`);
  const startMonthShort = MONTH_SHORT[start.getUTCMonth()];
  const startMonthLong = MONTH_LONG[start.getUTCMonth()];
  const startDay = start.getUTCDate();
  const startYear = start.getUTCFullYear();

  if (periodType === "yearly") {
    return `The Top 10 of ${startYear}.`;
  }
  if (periodType === "monthly") {
    return `The Top 10 of ${startMonthLong} ${startYear}.`;
  }
  // weekly — render "Oct 6 — 12, 2025" if start/end share a month, else
  // "Sep 28 — Oct 4, 2025" if it crosses a boundary.
  if (periodEnd) {
    const end = new Date(`${periodEnd}T00:00:00Z`);
    const endMonthShort = MONTH_SHORT[end.getUTCMonth()];
    const endDay = end.getUTCDate();
    const endYear = end.getUTCFullYear();
    if (start.getUTCMonth() === end.getUTCMonth() && startYear === endYear) {
      return `The Top 10 of ${startMonthShort} ${startDay} — ${endDay}, ${startYear}.`;
    }
    return `The Top 10 of ${startMonthShort} ${startDay} — ${endMonthShort} ${endDay}, ${endYear}.`;
  }
  return `The Top 10 of ${startMonthShort} ${startDay}, ${startYear}.`;
}

function formatExactDollars(d) {
  if (d == null) return "—";
  return `$${Math.round(d).toLocaleString("en-US")}`;
}

function formatNumber(n) {
  if (n == null) return "—";
  return Math.round(n).toLocaleString("en-US");
}

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

export default function CinematicBoxOfficeHero({
  entry,                  // the #1 film (or null while loading)
  periodType,             // "weekly" | "monthly" | "yearly"
  periodStart,            // YYYY-MM-DD
  periodEnd,              // YYYY-MM-DD
  loading,
  favorited,
  onToggleFavorite,
}) {
  const [animKey, setAnimKey] = useState(0);

  // Bump animKey when the featured film changes so the entrance replays
  // for the new backdrop. Keeps the page feeling alive when filters change.
  useEffect(() => {
    if (entry?.search_key) setAnimKey((k) => k + 1);
  }, [entry?.search_key, periodStart]);

  const grossAnimated = useCountUp(entry?.gross || 0, 900);

  const backdrop = entry?.backdrop_path ? `${TMDB_BACKDROP_W1280}${entry.backdrop_path}` : null;
  const score = entry?.fg_score != null ? Number(entry.fg_score).toFixed(1) : null;
  const buildHref = (e) => `/?q=${encodeURIComponent(e.title)}`;
  const subline = formatPeriodSubline(periodType, periodStart, periodEnd);

  return (
    <header
      key={animKey}
      style={{
        position: "relative",
        width: "100%",
        height: "min(64vh, 600px)",
        minHeight: 440,
        overflow: "hidden",
        marginBottom: 48,
      }}
    >
      {/* Backdrop layer — v6.6.1: moved from CSS background-image to a real
          <img> with loading="eager" + fetchpriority="high" so the browser
          starts the fetch on parse instead of after first paint. Result:
          the still appears on first paint instead of flashing in late. */}
      {backdrop ? (
        <img
          src={backdrop}
          alt=""
          aria-hidden="true"
          fetchPriority="high"
          loading="eager"
          decoding="async"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center 28%",
            transform: "scale(1.05)",
            animation: "boCinematicBackdropFade 1.2s cubic-bezier(0.16,1,0.3,1) both",
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
          padding: "0 24px 44px",
        }}
      >
        {/* Right-floating heart button for the #1 film */}
        {entry && onToggleFavorite && (
          <div
            style={{
              position: "absolute",
              right: 24,
              top: "calc(-1 * min(64vh, 600px) + 24px)",
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

        {/* v6.6.1: period chip removed — the dynamic subline already says
            "The Top 10 of [period]." Period info was duplicated. */}
        <h1
          style={{
            margin: 0,
            fontFamily: "'Playfair Display', serif",
            fontWeight: 700,
            fontSize: "clamp(56px, 8.4vw, 116px)",
            lineHeight: 1.02,
            letterSpacing: -1.8,
            color: "#fff",
            animation: "boCinematicLineIn 0.85s cubic-bezier(0.16,1,0.3,1) 0.06s both",
          }}
        >
          Box Office.
        </h1>
        <p
          style={{
            margin: "6px 0 0",
            fontFamily: "'Playfair Display', serif",
            fontStyle: "italic",
            fontWeight: 700,
            fontSize: "clamp(28px, 4.4vw, 56px)",
            lineHeight: 1.18,
            letterSpacing: -0.8,
            color: "#FFD700",
            animation: "boCinematicLineIn 0.85s cubic-bezier(0.16,1,0.3,1) 0.18s both",
          }}
        >
          {subline}
        </p>

        {/* "Now leading" glass strip — surfaces the #1 film's identity +
            gross + theaters in clean type. No gold-gradient text smear:
            crisp italic Playfair title + crisp solid-gold mono numbers. */}
        {entry && !loading && (
          <Link
            href={buildHref(entry)}
            className="bo-cin-pill"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
              marginTop: 22,
              padding: "12px 22px",
              borderRadius: 999,
              background: "rgba(8,6,2,0.65)",
              border: "1px solid rgba(255,215,0,0.32)",
              backdropFilter: "blur(12px) saturate(1.1)",
              WebkitBackdropFilter: "blur(12px) saturate(1.1)",
              textDecoration: "none",
              color: "#fff",
              animation: "boCinematicLineIn 0.85s cubic-bezier(0.16,1,0.3,1) 0.34s both",
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
              #1
            </span>
            <span
              style={{
                fontFamily: "'Playfair Display', serif",
                fontStyle: "italic",
                fontSize: 19,
                fontWeight: 700,
                color: "#fff",
                letterSpacing: -0.2,
                maxWidth: "min(56vw, 460px)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {entry.title}
            </span>
            <span style={{ color: "rgba(255,255,255,0.32)", fontFamily: "'Syne', sans-serif" }}>·</span>
            <span
              style={{
                fontFamily: "'Playfair Display', serif",
                fontWeight: 700,
                fontSize: 19,
                color: "#FFD700",
                letterSpacing: -0.2,
              }}
            >
              {formatExactDollars(grossAnimated)}
            </span>
            {entry.theaters != null && (
              <>
                <span style={{ color: "rgba(255,255,255,0.32)", fontFamily: "'Syne', sans-serif" }}>·</span>
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 12,
                    letterSpacing: 0.8,
                    color: "rgba(255,255,255,0.72)",
                    fontWeight: 600,
                  }}
                >
                  {formatNumber(entry.theaters)} theaters
                </span>
              </>
            )}
            {score && (
              <>
                <span style={{ color: "rgba(255,255,255,0.32)", fontFamily: "'Syne', sans-serif" }}>·</span>
                <span
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    fontWeight: 700,
                    fontSize: 16,
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
        @keyframes boCinematicLineIn {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes boCinematicBackdropFade {
          from { opacity: 0; transform: scale(1.10); }
          to   { opacity: 1; transform: scale(1.05); }
        }
        @media (max-width: 600px) {
          .bo-cin-pill {
            border-radius: 18px !important;
            padding: 14px 18px !important;
            gap: 10px !important;
          }
        }
      `}</style>
    </header>
  );
}
