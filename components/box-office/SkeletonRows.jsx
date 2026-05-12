"use client";

// SkeletonRows — placeholder for the loading state. Matches the v6.6.0
// layout: cinematic hero placeholder is implicit (handled inside
// CinematicBoxOfficeHero when entry is null) so this only needs to mirror
// the "Browse the Chart" section + 3×3 grid for #2..#10. Eliminates the
// layout flash from the prior hero+9-stacked-rows skeleton mismatch.

import React from "react";

const PULSE_KEYFRAMES = `
  @keyframes bomSkeletonPulse {
    0%, 100% { opacity: 0.55; }
    50% { opacity: 0.85; }
  }
`;

const cellStyle = {
  background:
    "linear-gradient(90deg, rgba(255,215,0,0.06) 0%, rgba(255,215,0,0.12) 50%, rgba(255,215,0,0.06) 100%)",
  borderRadius: 10,
  animation: "bomSkeletonPulse 1.6s ease-in-out infinite",
};

function CardSkeleton() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: "rgba(8,6,2,0.50)",
        border: "1px solid rgba(255,215,0,0.06)",
        borderRadius: 16,
        overflow: "hidden",
      }}
    >
      {/* Poster placeholder — same 2:3 aspect as real card */}
      <div style={{ ...cellStyle, aspectRatio: "2 / 3", borderRadius: 0 }} />
      {/* Body placeholder */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 14 }}>
        <div style={{ ...cellStyle, height: 18, width: "85%" }} />
        <div style={{ ...cellStyle, height: 18, width: "60%" }} />
        <div style={{ ...cellStyle, height: 14, width: "55%", marginTop: 4 }} />
        <div style={{ height: 18 }} />
        <div style={{ ...cellStyle, height: 26, width: "45%" }} />
        <div style={{ ...cellStyle, height: 6 }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, paddingTop: 8 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ ...cellStyle, height: 14 }} />
            <div style={{ ...cellStyle, height: 9, width: "70%" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ ...cellStyle, height: 14 }} />
            <div style={{ ...cellStyle, height: 9, width: "70%" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ ...cellStyle, height: 14 }} />
            <div style={{ ...cellStyle, height: 9, width: "70%" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SkeletonRows() {
  return (
    <div>
      <style>{PULSE_KEYFRAMES}</style>
      {/* Small uppercase mono label placeholder (matches the "The Rest of
          the Top 10" header in the real layout). */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 18,
        }}
      >
        <div style={{ ...cellStyle, height: 13, width: 200 }} />
        <div style={{ ...cellStyle, height: 13, width: 180 }} />
      </div>
      {/* 3×3 grid placeholder — same shape the page renders for #2..#10. */}
      <div
        className="bom-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 300px))",
          justifyContent: "center",
          gap: 22,
          gridAutoRows: "1fr",
        }}
      >
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
