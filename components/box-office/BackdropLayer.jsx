"use client";

// Fixed-position blurred backdrop. Pulls TMDB backdrop_path from #1 movie of
// the current chart and renders it behind everything with heavy blur + gold
// radial overlay. On filter change, the new backdrop crossfades in over 600ms.

import React, { useEffect, useState } from "react";

const TMDB_BACKDROP_BASE = "https://image.tmdb.org/t/p/w1280";

export default function BackdropLayer({ backdropPath }) {
  // Track previous + next so we can crossfade by stacking two layers
  const [current, setCurrent] = useState(backdropPath);
  const [outgoing, setOutgoing] = useState(null);

  useEffect(() => {
    if (backdropPath === current) return;
    setOutgoing(current);
    setCurrent(backdropPath);
    const t = setTimeout(() => setOutgoing(null), 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backdropPath]);

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      {/* Outgoing layer fades out */}
      {outgoing && (
        <div
          key={`out-${outgoing}`}
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url("${TMDB_BACKDROP_BASE}${outgoing}")`,
            backgroundSize: "cover",
            backgroundPosition: "center top",
            filter: "blur(32px) brightness(0.35) saturate(1.05)",
            transform: "scale(1.08)",
            opacity: 0,
            transition: "opacity 0.6s ease",
          }}
        />
      )}

      {/* Incoming layer fades in */}
      {current && (
        <div
          key={`in-${current}`}
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url("${TMDB_BACKDROP_BASE}${current}")`,
            backgroundSize: "cover",
            backgroundPosition: "center top",
            filter: "blur(32px) brightness(0.35) saturate(1.05)",
            transform: "scale(1.08)",
            opacity: 1,
            animation: "bomBackdropFade 0.6s ease both",
          }}
        />
      )}

      {/* Gold radial overlay (always on, regardless of backdrop) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at center top, rgba(255, 215, 0, 0.06), transparent 60%), linear-gradient(180deg, rgba(5,5,5,0.65) 0%, rgba(5,5,5,0.92) 100%)",
        }}
      />

      <style jsx global>{`
        @keyframes bomBackdropFade {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
