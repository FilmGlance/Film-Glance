"use client";

// SkeletonRows — placeholder for the loading state. One large hero
// skeleton at the top, then 9 smaller row skeletons below. Pulse via
// keyframes — same pattern as the existing Skeleton at film-glance.jsx:1023.

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

function HeroSkeleton() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "240px 1fr",
        gap: 32,
        padding: 28,
        background: "rgba(8,6,2,0.62)",
        border: "1px solid rgba(255,215,0,0.08)",
        borderRadius: 22,
      }}
    >
      <div style={{ ...cellStyle, aspectRatio: "2 / 3", width: 240 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 12 }}>
        <div style={{ ...cellStyle, height: 56, width: "70%" }} />
        <div style={{ ...cellStyle, height: 18, width: 80 }} />
        <div style={{ flex: 1 }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 18 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ ...cellStyle, height: 44 }} />
              <div style={{ ...cellStyle, height: 12, width: "70%" }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RowSkeleton() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "110px 1fr",
        gap: 22,
        padding: "16px 20px",
        background: "rgba(8,6,2,0.5)",
        border: "1px solid rgba(255,215,0,0.06)",
        borderRadius: 16,
      }}
    >
      <div style={{ ...cellStyle, aspectRatio: "2 / 3", width: 110 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ ...cellStyle, height: 22, width: "60%" }} />
        <div style={{ ...cellStyle, height: 14, width: 60 }} />
        <div style={{ flex: 1, minHeight: 12 }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ ...cellStyle, height: 22 }} />
              <div style={{ ...cellStyle, height: 10, width: "70%" }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SkeletonRows() {
  return (
    <div>
      <style>{PULSE_KEYFRAMES}</style>
      <HeroSkeleton />
      <div style={{ marginTop: 36, display: "flex", flexDirection: "column", gap: 16 }}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <RowSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
