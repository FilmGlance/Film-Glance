"use client";

// RouletteCard — result card after a Roulette spin completes. Hero variant
// of DiscoverCard with "🎬 Roulette pick" badge + larger Watch It CTA.

import React from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

const TMDB_POSTER_BASE = "https://image.tmdb.org/t/p/w500";

export default function RouletteCard({ entry, onSpinAgain }) {
  if (!entry) return null;
  const posterUrl = entry.poster_path ? `${TMDB_POSTER_BASE}${entry.poster_path}` : null;
  const score = entry.fg_score != null ? Number(entry.fg_score).toFixed(1) : "—";

  return (
    <article
      className="dis-roulette-card"
      style={{
        position: "relative",
        display: "grid",
        gridTemplateColumns: "minmax(0, 220px) minmax(0, 1fr)",
        gap: 24,
        padding: 22,
        borderRadius: 18,
        background: "linear-gradient(180deg, rgba(20,15,4,0.86) 0%, rgba(8,6,2,0.92) 100%)",
        border: "1.5px solid rgba(255,215,0,0.40)",
        boxShadow: "0 28px 80px rgba(0,0,0,0.6), 0 0 100px rgba(255,215,0,0.16)",
        animation: "disResultIn 0.6s cubic-bezier(0.16,1,0.3,1) both",
      }}
    >
      {/* Poster */}
      <div
        style={{
          position: "relative",
          aspectRatio: "2 / 3",
          width: "100%",
          borderRadius: 12,
          overflow: "hidden",
          background: "rgba(0,0,0,0.5)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,215,0,0.22)",
        }}
      >
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={entry.title}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center", height: "100%",
            fontFamily: "'Playfair Display', serif", fontStyle: "italic",
            color: "rgba(255,215,0,0.32)", fontSize: 56,
          }}>
            {entry.title?.charAt(0)}
          </div>
        )}
      </div>

      {/* Right column */}
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 14, minWidth: 0 }}>
        <div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 12px",
              borderRadius: 999,
              background: "linear-gradient(135deg, #FFE27A 0%, #FFD700 48%, #E8A000 100%)",
              color: "#0a0805",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 1.4,
            }}
          >
            <Sparkles size={12} aria-hidden="true" />
            ROULETTE PICK
          </div>

          <h2
            style={{
              margin: "12px 0 8px",
              fontFamily: "'Playfair Display', serif",
              fontStyle: "italic",
              fontWeight: 700,
              fontSize: "clamp(28px, 3.5vw, 44px)",
              lineHeight: 1.05,
              color: "#fff",
              wordBreak: "break-word",
            }}
          >
            {entry.title}
          </h2>

          <div
            style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: 14,
              color: "rgba(255,255,255,0.78)",
              letterSpacing: 0.2,
            }}
          >
            {entry.director ? <span>{entry.director}</span> : null}
            {entry.director && entry.year ? <span> · </span> : null}
            {entry.year ? <span>{entry.year}</span> : null}
          </div>

          {entry.genre && (
            <div
              style={{
                marginTop: 6,
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                color: "rgba(255, 215, 0, 0.55)",
                letterSpacing: 0.6,
              }}
            >
              {entry.genre}
            </div>
          )}
        </div>

        {/* Score */}
        <div
          style={{
            fontFamily: "'Playfair Display', serif",
            fontStyle: "italic",
            fontWeight: 700,
            fontSize: "clamp(48px, 6vw, 80px)",
            lineHeight: 1,
            background: "linear-gradient(135deg, #FFE27A 0%, #FFD700 48%, #E8A000 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
            color: "transparent",
            filter: "drop-shadow(0 0 22px rgba(255,215,0,0.5)) drop-shadow(0 0 80px rgba(255,215,0,0.22))",
            letterSpacing: -0.6,
            paddingBottom: "0.06em",
          }}
        >
          {score}
          <span
            style={{
              marginLeft: 8,
              fontFamily: "'JetBrains Mono', monospace",
              fontStyle: "normal",
              fontSize: 14,
              color: "rgba(255,215,0,0.6)",
              letterSpacing: 1.2,
              WebkitTextFillColor: "rgba(255,215,0,0.6)",
              filter: "none",
            }}
          >
            /10
          </span>
        </div>

        {/* CTAs */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link
            href={`/?q=${encodeURIComponent(entry.title)}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "11px 22px",
              borderRadius: 12,
              background: "linear-gradient(135deg, #FFE27A 0%, #FFD700 48%, #E8A000 100%)",
              color: "#0a0805",
              fontFamily: "'Syne', sans-serif",
              fontWeight: 700,
              fontSize: 14,
              letterSpacing: 0.4,
              textDecoration: "none",
              boxShadow: "0 8px 22px rgba(255,215,0,0.32)",
            }}
          >
            Watch it
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
          {onSpinAgain && (
            <button
              type="button"
              onClick={onSpinAgain}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "11px 18px",
                borderRadius: 12,
                background: "rgba(0,0,0,0.32)",
                border: "1px solid rgba(255,255,255,0.16)",
                color: "rgba(255,255,255,0.85)",
                fontFamily: "'Syne', sans-serif",
                fontWeight: 600,
                fontSize: 13,
                letterSpacing: 0.4,
                cursor: "pointer",
              }}
            >
              Spin again
            </button>
          )}
        </div>
      </div>

      <style jsx global>{`
        @media (max-width: 640px) {
          .dis-roulette-card {
            grid-template-columns: 1fr !important;
            padding: 16px !important;
          }
        }
      `}</style>
    </article>
  );
}
