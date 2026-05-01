"use client";

// Page hero — italic Playfair "Box Office" + Syne subhead + a small
// gold-on-dark "period stamp" chip that displays the current filter
// state ("APRIL 2024 · DOMESTIC · TOP 10"). The stamp animates in on
// filter change and reads more "magazine cover" than spreadsheet.

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

function statusBadge(status) {
  if (!status) return null;
  if (status === "estimate")
    return { label: "ESTIMATE", color: "#FFD700" };
  if (status === "actual")
    return { label: "ACTUAL", color: "#7be38c" };
  if (status === "historical")
    return { label: "HISTORICAL", color: "rgba(255,255,255,0.55)" };
  return null;
}

function timeAgo(iso) {
  if (!iso) return null;
  try {
    const t = new Date(iso).getTime();
    const diff = Date.now() - t;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} h ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  } catch {
    return null;
  }
}

export default function PageHero({
  periodLabel,
  periodType,
  region,
  dataStatus,
  retrievedAt,
}) {
  const stampKey = `${periodType}-${region}-${periodLabel || ""}`;
  const status = statusBadge(dataStatus);
  const ago = timeAgo(retrievedAt);

  return (
    <header style={{ marginBottom: 28 }}>
      {/* Hero — uses the shared `.hero-accent` class (defined in app/globals.css)
          so the gradient + halo match the landing page's "One True Rating Score."
          treatment exactly. Italic 700 Playfair Display sized for a page hero. */}
      <h1
        className="hero-accent"
        style={{
          fontFamily: "'Playfair Display', serif",
          fontStyle: "italic",
          fontWeight: 700,
          fontSize: "clamp(44px, 6vw, 72px)",
          margin: 0,
          lineHeight: 1.18,
          letterSpacing: -0.5,
          paddingBottom: "0.08em",
          display: "block",
        }}
      >
        Box Office
      </h1>
      <p
        style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: 16,
          color: "rgba(255,255,255,0.72)",
          margin: "8px 0 0",
          letterSpacing: 0.2,
        }}
      >
        The Movies Topping The Box Office Charts.
      </p>

      {periodLabel && (
        <div
          key={stampKey}
          style={{
            marginTop: 18,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 10,
            animation: "bomStampIn 0.55s cubic-bezier(0.16,1,0.3,1) both",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              borderRadius: 999,
              border: "1px solid rgba(255, 215, 0, 0.32)",
              background:
                "linear-gradient(135deg, rgba(255,215,0,0.08), rgba(255,165,0,0.02))",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11.5,
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
        @keyframes bomStampIn {
          from {
            opacity: 0;
            transform: scale(0.96) translateY(-2px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </header>
  );
}
