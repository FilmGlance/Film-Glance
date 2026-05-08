"use client";

// PosterCard — single Box Office grid card (#2-#10). The #1 film is now
// rendered by CinematicBoxOfficeHero (full-bleed top hero) so this file
// only needs the standard variant.
//
// v6.6.0 redesign:
//   • Drop the gold-gradient text smear on the gross figure → crisp solid
//     Playfair gold (mirrors the v6.5.3 anti-smear treatment on /discover).
//   • Add a gross-share bar visualizing gross / maxGross — gives the chart
//     visual drama (#2 might be ~80% bar, #10 might be ~10%, "you can see
//     the gap" at a glance).
//   • Ken-Burns poster zoom on hover via styled-jsx :hover (replaces the
//     prior JS-mutation onMouseEnter/onMouseLeave) — same pattern that
//     polished DiscoverCard in v6.5.3.
//
// Whole card is a <Link> to /?q=<title> — clicking navigates to the Film
// Glance landing page with the URL-param hook auto-firing doSearch on
// mount (existing logic at film-glance.jsx:1413-1432).

import React from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { useCountUp } from "@/lib/use-count-up";

const TMDB_POSTER_BASE = "https://image.tmdb.org/t/p/w500";

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

function buildHref(entry) {
  const params = new URLSearchParams();
  params.set("q", entry.title);
  return `/?${params.toString()}`;
}

function FavoriteButton({ favorited, onToggle, ariaLabel }) {
  return (
    <button
      type="button"
      aria-label={ariaLabel || (favorited ? "Remove from favorites" : "Save to favorites")}
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
          ? "0 4px 16px rgba(255, 215, 0, 0.35), 0 0 18px rgba(255, 215, 0, 0.22)"
          : "0 4px 14px rgba(0, 0, 0, 0.5)",
        transition: "transform 0.2s ease, background 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease",
        zIndex: 3,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "scale(1.08)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
      }}
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

function StandardStat({ label, value, isScore, scoreLoaded }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontFamily: isScore ? "'Playfair Display', serif" : "'Syne', sans-serif",
          fontWeight: 700,
          fontSize: 16,
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
          fontSize: 10.5,
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

export default function PosterCard({
  entry,
  staggerDelayMs = 0,
  favorited = false,
  onToggleFavorite, // (entry) => void; if omitted, the heart button is hidden
  maxGross = null,  // #1 film's gross (from CinematicBoxOfficeHero), used to
                     //  scale the gross-share bar; null hides the bar.
}) {
  const grossAnimated = useCountUp(entry?.gross || 0, 800);

  if (!entry) return null;

  const posterUrl = entry.poster_path ? `${TMDB_POSTER_BASE}${entry.poster_path}` : null;

  // Gross-share bar — clamp to [4%, 100%] so the smallest entry still has a
  // visible nub (4% of card width is ~12px, enough to read as "very small"
  // without disappearing). #2 might land at ~80%, #10 at ~10% on a typical
  // weekly chart — the gap is the storytelling.
  const sharePct =
    maxGross && maxGross > 0
      ? Math.min(100, Math.max(4, Math.round((entry.gross / maxGross) * 100)))
      : null;

  return (
    <Link
      href={buildHref(entry)}
      aria-label={`View ${entry.title} on Film Glance`}
      style={{ textDecoration: "none", color: "inherit", display: "block", height: "100%" }}
    >
      <style jsx>{`
        .bo-pcard:hover {
          transform: translateY(-6px) scale(1.012);
          border-color: rgba(255, 215, 0, 0.42) !important;
          box-shadow: 0 26px 64px rgba(0, 0, 0, 0.66), 0 0 0 1px rgba(255, 215, 0, 0.16),
            0 0 60px rgba(255, 215, 0, 0.08) !important;
        }
        .bo-pcard:hover :global(.bo-pcard-poster) {
          transform: scale(1.06);
        }
        .bo-pcard:hover :global(.bo-pcard-bar-fill) {
          filter: brightness(1.12);
        }
      `}</style>
      <article
        className="bo-pcard"
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
          animation: `bomCardIn 0.45s cubic-bezier(0.16,1,0.3,1) ${staggerDelayMs}ms both`,
          transition:
            "transform 0.35s cubic-bezier(0.16,1,0.3,1), border-color 0.25s ease, box-shadow 0.25s ease",
          cursor: "pointer",
          overflow: "hidden",
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
              className="bo-pcard-poster"
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

          {/* Rank pill — dark glass + crisp solid-gold italic Playfair so
              it reads at a distance against any poster art. v6.6.0: dropped
              the gold-gradient text-clip so it doesn't smear. */}
          <div
            style={{
              position: "absolute",
              top: 10,
              left: 10,
              padding: "2px 11px",
              borderRadius: 10,
              background: "rgba(8, 6, 2, 0.80)",
              backdropFilter: "blur(12px) saturate(1.1)",
              WebkitBackdropFilter: "blur(12px) saturate(1.1)",
              border: "1px solid rgba(255, 215, 0, 0.38)",
              boxShadow: "0 4px 14px rgba(0,0,0,0.5)",
              userSelect: "none",
              pointerEvents: "none",
              lineHeight: 0.9,
            }}
          >
            <span
              style={{
                fontFamily: "'Playfair Display', serif",
                fontStyle: "italic",
                fontWeight: 700,
                fontSize: 28,
                lineHeight: 0.95,
                color: "#FFD700",
                letterSpacing: -0.8,
                display: "inline-block",
                paddingBottom: "0.06em",
              }}
            >
              #{entry.rank}
            </span>
          </div>

          {/* Subtle bottom-of-poster gradient for legibility if title intrudes */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
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

          {/* Spacer pushes gross + bar + stats to bottom */}
          <div style={{ flex: 1, minHeight: 4 }} />

          {/* Gross — crisp solid-gold Playfair, no gradient text smear, no
              heavy drop-shadow glow. v6.6.0 anti-smear treatment. */}
          <div
            style={{
              fontFamily: "'Playfair Display', serif",
              fontWeight: 700,
              fontSize: 30,
              lineHeight: 1,
              color: "#FFD700",
              letterSpacing: -0.5,
              paddingBottom: "0.06em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {formatDollars(grossAnimated)}
          </div>

          {/* Gross-share bar — visualizes gross/maxGross. The chart's drama
              made visible: a tall bar means "close to #1," a stub means
              "long way back." */}
          {sharePct != null && (
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
                className="bo-pcard-bar-fill"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: `${sharePct}%`,
                  background:
                    "linear-gradient(90deg, rgba(255,215,0,0.45) 0%, #FFD700 60%, #FFE27A 100%)",
                  borderRadius: 999,
                  boxShadow: "0 0 12px rgba(255,215,0,0.32)",
                  transition: "filter 0.25s ease, width 0.6s cubic-bezier(0.16,1,0.3,1)",
                }}
              />
            </div>
          )}

          {/* Stat row — Theaters · Per-theater · FG Score */}
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

// Global keyframes
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
