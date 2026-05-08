"use client";

// Page hero — two-line italic Playfair gold-gradient treatment that mirrors
// the landing page's "Every Film. / One True Rating Score." pattern.
// v5.12.0 round 9: dropped the period stamp pill below the tagline (per user
// feedback). Filter state now lives entirely in the dropdowns below.

import React from "react";

export default function PageHero() {
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
          animation: "bomHeroLineIn 0.7s cubic-bezier(0.16,1,0.3,1) both",
        }}
      >
        Box Office.
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
            animation: "bomHeroLineIn 0.7s cubic-bezier(0.16,1,0.3,1) 0.12s both",
          }}
        >
          The Movies Topping The Charts.
        </span>
      </h1>

      <style jsx global>{`
        @keyframes bomHeroLineIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </header>
  );
}
