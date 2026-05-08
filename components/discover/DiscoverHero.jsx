"use client";

// DiscoverHero — page hero matching the box-office PageHero treatment:
// two-line italic Playfair, left-aligned, gold-gradient subtitle, with
// the soft gold halo that the landing page uses.
//
// v6.4.1 rewrite — closes the visual identity gap with /boxoffice.

import React from "react";

export default function DiscoverHero() {
  return (
    <header
      style={{
        position: "relative",
        marginBottom: 36,
        textAlign: "left",
      }}
    >
      <h1
        style={{
          fontFamily: "'Playfair Display', serif",
          fontWeight: 700,
          fontSize: "clamp(56px, 8.4vw, 116px)",
          margin: 0,
          lineHeight: 1.02,
          letterSpacing: -1.8,
          color: "#fff",
          animation: "disHeroLineIn 0.7s cubic-bezier(0.16,1,0.3,1) both",
        }}
      >
        Discover.
        <span
          className="hero-accent"
          style={{
            display: "block",
            fontSize: "clamp(34px, 5vw, 70px)",
            lineHeight: 1.18,
            paddingBottom: "0.08em",
            letterSpacing: -0.8,
            marginTop: 4,
            color: "#FFD700",
            animation: "disHeroLineIn 0.7s cubic-bezier(0.16,1,0.3,1) 0.12s both",
          }}
        >
          Films Worth Your Evening.
        </span>
      </h1>

      <style jsx global>{`
        @keyframes disHeroLineIn {
          from { opacity: 0; transform: translateY(8px); }
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
    </header>
  );
}
