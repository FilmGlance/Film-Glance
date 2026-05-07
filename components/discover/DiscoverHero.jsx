"use client";

// DiscoverHero — page title + subtitle. Mirrors box-office's PageHero
// visually (italic Playfair, soft gold halo, cubic-bezier line-in).

import React from "react";

export default function DiscoverHero() {
  return (
    <div style={{ marginBottom: 28, textAlign: "center" }}>
      <h1
        className="dis-hero-line"
        style={{
          margin: 0,
          fontFamily: "'Playfair Display', serif",
          fontStyle: "italic",
          fontWeight: 700,
          fontSize: "clamp(40px, 6vw, 72px)",
          lineHeight: 1.05,
          color: "#fff",
          letterSpacing: -0.5,
          textShadow: "0 0 22px rgba(255, 215, 0, 0.18)",
          animation: "disHeroLineIn 0.7s cubic-bezier(0.16,1,0.3,1) both",
        }}
      >
        Discover<span style={{ color: "#FFD700" }}>.</span>
      </h1>
      <p
        style={{
          margin: "16px auto 0",
          maxWidth: 620,
          fontFamily: "'Syne', sans-serif",
          fontSize: 16,
          lineHeight: 1.5,
          color: "rgba(255, 255, 255, 0.62)",
          letterSpacing: 0.2,
          animation: "disHeroLineIn 0.7s cubic-bezier(0.16,1,0.3,1) 120ms both",
        }}
      >
        100 hand-picked films per filter, ranked by Film Glance score. Spin the
        Movie Reel Roulette for a random ≥8/10 pick.
      </p>
      <style jsx global>{`
        @keyframes disHeroLineIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
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
    </div>
  );
}
