"use client";

// EmptyState — used when there's no data for the selected period or when
// an error occurs during fetch. Renders the same italic Playfair tone the
// rest of the page uses, so it doesn't feel like an error fallback.

import React from "react";

export default function EmptyState({ title, subtitle }) {
  return (
    <div
      style={{
        marginTop: 32,
        padding: "44px 32px",
        textAlign: "center",
        background: "rgba(8,6,2,0.62)",
        border: "1px solid rgba(255,215,0,0.10)",
        borderRadius: 16,
        backdropFilter: "blur(20px) saturate(1.1)",
        WebkitBackdropFilter: "blur(20px) saturate(1.1)",
      }}
    >
      <div
        style={{
          fontFamily: "'Playfair Display', serif",
          fontStyle: "italic",
          fontWeight: 700,
          fontSize: "clamp(20px, 2.4vw, 28px)",
          color: "#FFD700",
          letterSpacing: -0.3,
        }}
      >
        {title}
      </div>
      {subtitle && (
        <div
          style={{
            marginTop: 8,
            fontFamily: "'Syne', sans-serif",
            fontSize: 14,
            color: "rgba(255,255,255,0.62)",
            maxWidth: 420,
            margin: "8px auto 0",
            lineHeight: 1.5,
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
}
