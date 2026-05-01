"use client";

// components/GoldScrollbar.jsx
//
// Site-wide custom gold scrollbar. Originally lived inside film-glance.jsx;
// extracted in v5.12.0 round 10 so /boxoffice (and any future page) gets the
// same scroll indicator as the landing/result pages.
//
// What it renders:
//   • A thin gold-tinted track at the right edge of the viewport (4px from
//     the right, top:120, bottom:20 — clears the sticky header)
//   • A draggable thumb (gold gradient) positioned at scrollPct * 100%; turns
//     orange past 85% scroll for end-of-page emphasis
//   • A subtle gold bottom-fade overlay when scrollPct > 0.8 — matches the
//     "you're approaching the bottom" cue used elsewhere on the site
//
// Internally tracks scroll % via a window-scroll listener, rAF-throttled and
// rounded to 1% precision so React only re-renders ~100 times per full page
// scroll (the v5.10.39 perf fix from the result page).

import React, { useEffect, useRef, useState } from "react";

export default function GoldScrollbar() {
  const scrollTrackRef = useRef(null);
  const [scrollPct, setScrollPct] = useState(0);
  const [isDragging, setIsDragging] = useState(0);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const raw = max > 0 ? Math.min(window.scrollY / max, 1) : 0;
        setScrollPct(Math.round(raw * 100) / 100);
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e) => {
      const track = scrollTrackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const pct = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
      window.scrollTo(0, pct * (document.documentElement.scrollHeight - window.innerHeight));
    };
    const onUp = () => setIsDragging(0);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDragging]);

  return (
    <>
      <div
        ref={scrollTrackRef}
        onClick={(e) => {
          const track = scrollTrackRef.current;
          if (!track) return;
          const rect = track.getBoundingClientRect();
          const pct = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
          window.scrollTo(0, pct * (document.documentElement.scrollHeight - window.innerHeight));
        }}
        style={{
          position: "fixed",
          right: 4,
          top: 120,
          bottom: 20,
          width: 18,
          borderRadius: 4,
          zIndex: 200,
          cursor: "default",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 7,
            height: "100%",
            borderRadius: 4,
            background: "rgba(255,215,0,0.06)",
          }}
        />
        <div
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(1);
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow =
              "0 0 20px rgba(255,215,0,0.35), 0 0 40px rgba(255,215,0,0.12)";
            e.currentTarget.style.width = "9px";
            e.currentTarget.style.marginLeft = "-4.5px";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = `0 0 ${scrollPct > 0.85 ? "14px" : "6px"} ${scrollPct > 0.85 ? "rgba(255,107,0,0.5)" : "rgba(255,215,0,0.3)"}`;
            e.currentTarget.style.width = "7px";
            e.currentTarget.style.marginLeft = "-3.5px";
          }}
          style={{
            position: "absolute",
            top: `${scrollPct * 100}%`,
            width: 7,
            left: "50%",
            marginLeft: -3.5,
            height: 80,
            borderRadius: 4,
            background: `linear-gradient(180deg, #FFD700, ${scrollPct > 0.85 ? "#ff6b00" : "#E8A000"})`,
            boxShadow: `0 0 ${scrollPct > 0.85 ? "14px" : "6px"} ${scrollPct > 0.85 ? "rgba(255,107,0,0.5)" : "rgba(255,215,0,0.3)"}`,
            transition: isDragging ? "none" : "all 0.3s",
            transform: "translateY(-50%)",
            cursor: "default",
          }}
        />
      </div>
      {scrollPct > 0.8 && (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            height: 50,
            background: `linear-gradient(to top, rgba(255,215,0,${(scrollPct - 0.8) * 0.15}), transparent)`,
            pointerEvents: "none",
            zIndex: 150,
          }}
        />
      )}
    </>
  );
}
