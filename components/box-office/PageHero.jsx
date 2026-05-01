"use client";

// Page hero — two-line italic Playfair gold-gradient treatment that mirrors
// the landing page's "Every Film. / One True Rating Score." pattern. The
// first line carries the page name with gold gradient + halo; the second
// line is the cinematic tagline.
//
// Below that: the period stamp pill ("WEEKLY · DOMESTIC 2026 WEEK 16 ·
// DOMESTIC · TOP 10") — animates in on filter change so the user sees
// the filter take effect immediately.

import React from "react";

function periodTypeLabel(t) {
  switch (t) {
    case "weekly":
      return "WEEKLY";
    case "monthly":
      return "MONTHLY";
    case "seasonal":
      return "SEASONAL";
    case "yearly":
      return "YEARLY";
    default:
      return "";
  }
}

function regionLabel(r) {
  switch (r) {
    case "domestic":
      return "DOMESTIC";
    case "international":
      return "INTERNATIONAL";
    case "worldwide":
      return "WORLDWIDE";
    default:
      return "";
  }
}

export default function PageHero({
  periodLabel,
  periodType,
  region,
}) {
  const stampKey = `${periodType}-${region}-${periodLabel || ""}`;

  return (
    <header
      style={{
        position: "relative",
        marginBottom: 36,
        textAlign: "left",
      }}
    >
      {/* Soft gold halo behind the title — same trick the landing page uses */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: -24,
          top: -32,
          right: -24,
          bottom: -16,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse at 24% 50%, rgba(255,215,0,0.10), transparent 62%)",
          filter: "blur(4px)",
          zIndex: -1,
        }}
      />

      <h1
        style={{
          fontFamily: "'Playfair Display', serif",
          fontWeight: 700,
          fontSize: "clamp(56px, 8.4vw, 116px)",
          margin: 0,
          lineHeight: 1.02,
          letterSpacing: -1.8,
          color: "#fff",
          textShadow: "0 0 24px rgba(255,215,0,0.10)",
          animation: "bomHeroLineIn 0.7s cubic-bezier(0.16,1,0.3,1) both",
        }}
      >
        Box Office.
        <span
          className="hero-accent"
          style={{
            display: "block",
            fontStyle: "italic",
            fontSize: "clamp(34px, 5vw, 70px)",
            lineHeight: 1.18,
            paddingBottom: "0.08em",
            letterSpacing: -0.8,
            marginTop: 4,
            animation: "bomHeroLineIn 0.7s cubic-bezier(0.16,1,0.3,1) 0.12s both",
          }}
        >
          The Movies Topping The Charts.
        </span>
      </h1>

      {periodLabel && (
        <div
          key={stampKey}
          style={{
            marginTop: 22,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 10,
            animation: "bomStampIn 0.55s cubic-bezier(0.16,1,0.3,1) 0.28s both",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 14px",
              borderRadius: 999,
              border: "1px solid rgba(255, 215, 0, 0.32)",
              background:
                "linear-gradient(135deg, rgba(255,215,0,0.10), rgba(255,165,0,0.02))",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12,
              letterSpacing: 1.6,
              color: "#FFD700",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
            }}
          >
            <span>{periodTypeLabel(periodType)}</span>
            <span style={{ color: "rgba(255,215,0,0.4)" }}>·</span>
            <span style={{ color: "#fff", letterSpacing: 1.2 }}>{periodLabel}</span>
            <span style={{ color: "rgba(255,215,0,0.4)" }}>·</span>
            <span>{regionLabel(region)}</span>
            <span style={{ color: "rgba(255,215,0,0.4)" }}>·</span>
            <span>TOP 10</span>
          </span>
        </div>
      )}

      <style jsx global>{`
        @keyframes bomHeroLineIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes bomStampIn {
          from { opacity: 0; transform: scale(0.96) translateY(-2px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </header>
  );
}
