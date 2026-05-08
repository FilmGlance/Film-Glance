"use client";

// DiscoverGrid — IntersectionObserver-batched grid wrapper. Renders an
// initial batch of 30 cards, then loads the next batch when a sentinel
// near the bottom of the list comes into view. Avoids paying the cost of
// 100 simultaneous poster image requests on first paint.

import React, { useEffect, useRef, useState } from "react";
import DiscoverCard from "./DiscoverCard";

const INITIAL_BATCH = 30;
const STEP = 30;

export default function DiscoverGrid({
  entries,
  releaseWindow,
  isFavorited,
  onToggleFavorite,
}) {
  const [visible, setVisible] = useState(INITIAL_BATCH);
  const sentinelRef = useRef(null);

  // Reset when entries change (filter switch).
  useEffect(() => {
    setVisible(INITIAL_BATCH);
  }, [entries]);

  useEffect(() => {
    if (!sentinelRef.current) return;
    if (visible >= entries.length) return;
    const obs = new IntersectionObserver(
      (entriesObs) => {
        if (entriesObs.some((e) => e.isIntersecting)) {
          setVisible((v) => Math.min(v + STEP, entries.length));
        }
      },
      { rootMargin: "400px" }
    );
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [visible, entries.length]);

  const shown = entries.slice(0, visible);

  return (
    <div>
      <div
        className="dis-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 300px))",
          justifyContent: "center",
          gap: 22,
          gridAutoRows: "1fr",
        }}
      >
        {shown.map((entry, i) => (
          <DiscoverCard
            key={`dc-${entry.search_key}-${entry.year || ""}`}
            entry={entry}
            staggerDelayMs={(i % STEP) * 30}
            favorited={isFavorited?.(entry) || false}
            onToggleFavorite={onToggleFavorite}
            releaseWindow={releaseWindow}
          />
        ))}
      </div>
      {visible < entries.length && (
        <div
          ref={sentinelRef}
          aria-hidden="true"
          style={{
            height: 32,
            marginTop: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            letterSpacing: 1.6,
            color: "rgba(255,215,0,0.45)",
            textTransform: "uppercase",
          }}
        >
          Loading more…
        </div>
      )}

      <style jsx global>{`
        @media (max-width: 960px) {
          .dis-grid {
            grid-template-columns: repeat(2, minmax(0, 300px)) !important;
            gap: 18px !important;
          }
        }
        @media (max-width: 640px) {
          .dis-grid {
            grid-template-columns: minmax(0, 360px) !important;
            gap: 16px !important;
          }
        }
      `}</style>
    </div>
  );
}
