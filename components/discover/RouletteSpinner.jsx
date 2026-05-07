"use client";

// RouletteSpinner — Movie Reel Roulette. Decade picker + Spin button.
// On click: animate three vertically-scrolling poster reels (slot machine
// style), staggered 3.6s/3.9s/4.2s decel cubic-bezier(0.16,1,0.3,1).
// After the third reel stops, fade in the RouletteCard with the actual
// chosen movie.
//
// Mobile (<520px): single reel, full-width — same rhythm, less crowding.

import React, { useEffect, useMemo, useState } from "react";
import { Dice3 } from "lucide-react";
import FilterDropdown from "@/components/box-office/FilterDropdown";
import RouletteCard from "./RouletteCard";

const TMDB_POSTER_BASE = "https://image.tmdb.org/t/p/w300";

const DECADE_OPTIONS = [
  { value: "any",      label: "Any year" },
  { value: "2020s",    label: "2020s" },
  { value: "2010s",    label: "2010s" },
  { value: "2000s",    label: "2000s" },
  { value: "1990s",    label: "1990s" },
  { value: "1980s",    label: "1980s" },
  { value: "1970s",    label: "1970s" },
  { value: "pre-1970", label: "Pre-1970" },
];

const REEL_HEIGHT = 360;
const REEL_WIDTH = 240;
const REEL_DURATIONS = [3.6, 3.9, 4.2]; // seconds

function pickRandomPosters(pool, count) {
  if (!pool || pool.length === 0) return [];
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  return out;
}

function Reel({ posters, finalPoster, durationSec, animKey, isMobile, hidden }) {
  // 23 random + 1 final at index 23 — total 24 frames.
  const frames = useMemo(() => [...posters.slice(0, 23), finalPoster], [posters, finalPoster]);
  const finalY = -23 * REEL_HEIGHT;

  if (hidden) return null;

  return (
    <div
      style={{
        width: isMobile ? "min(100%, 280px)" : REEL_WIDTH,
        height: REEL_HEIGHT,
        overflow: "hidden",
        borderRadius: 12,
        border: "1.5px solid rgba(255,215,0,0.32)",
        background: "rgba(0,0,0,0.55)",
        boxShadow: "0 16px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,215,0,0.14)",
        position: "relative",
      }}
    >
      <div
        key={animKey}
        style={{
          willChange: "transform",
          animation: `disSpinReel ${durationSec}s cubic-bezier(0.16, 1, 0.3, 1) both`,
          ["--reel-final"]: `translateY(${finalY}px)`,
        }}
      >
        {frames.map((p, i) => (
          <div
            key={i}
            style={{
              width: "100%",
              height: REEL_HEIGHT,
              background: "rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderBottom: "1px solid rgba(255,215,0,0.05)",
            }}
          >
            {p ? (
              <img
                src={`${TMDB_POSTER_BASE}${p}`}
                alt=""
                aria-hidden="true"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                loading="eager"
              />
            ) : (
              <span style={{ color: "rgba(255,215,0,0.32)", fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontSize: 36 }}>
                ★
              </span>
            )}
          </div>
        ))}
      </div>
      {/* Top + bottom gradient masks for slot-machine "window" feel */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 60, background: "linear-gradient(180deg, rgba(8,6,2,0.95) 0%, rgba(8,6,2,0) 100%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 60, background: "linear-gradient(0deg, rgba(8,6,2,0.95) 0%, rgba(8,6,2,0) 100%)", pointerEvents: "none" }} />
    </div>
  );
}

export default function RouletteSpinner({ posterPool }) {
  const [decade, setDecade] = useState("any");
  const [spinState, setSpinState] = useState("idle"); // idle | loading | spinning | done | error
  const [animKey, setAnimKey] = useState(0);
  const [poolSize, setPoolSize] = useState(null);
  const [pickedEntry, setPickedEntry] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [finalPoster, setFinalPoster] = useState(null);

  useEffect(() => {
    const mql = typeof window !== "undefined" ? window.matchMedia("(max-width: 520px)") : null;
    if (!mql) return;
    const upd = () => setIsMobile(mql.matches);
    upd();
    mql.addEventListener?.("change", upd);
    return () => mql.removeEventListener?.("change", upd);
  }, []);

  async function spin() {
    if (spinState === "spinning" || spinState === "loading") return;
    setSpinState("loading");
    setPickedEntry(null);
    setErrorMsg(null);
    try {
      const r = await fetch(`/api/discover/random?decade=${encodeURIComponent(decade)}`);
      if (r.status === 404) {
        setErrorMsg("No movies match this decade. Try another.");
        setSpinState("error");
        return;
      }
      if (!r.ok) throw new Error(`API ${r.status}`);
      const d = await r.json();
      setPoolSize(d.pool_size ?? null);
      setFinalPoster(d.entry?.poster_path || null);
      setAnimKey((k) => k + 1);
      setSpinState("spinning");
      // Stop after the third reel finishes
      setTimeout(() => {
        setPickedEntry(d.entry);
        setSpinState("done");
      }, REEL_DURATIONS[REEL_DURATIONS.length - 1] * 1000 + 100);
    } catch (e) {
      setErrorMsg(`Couldn't spin — ${String(e)}`);
      setSpinState("error");
    }
  }

  const pool = posterPool || [];
  const showReels = spinState === "spinning";

  return (
    <section
      aria-label="Movie Reel Roulette"
      style={{
        marginBottom: 28,
        padding: 22,
        borderRadius: 16,
        background: "rgba(8,6,2,0.55)",
        border: "1px solid rgba(255,215,0,0.16)",
        backdropFilter: "blur(20px) saturate(1.1)",
        WebkitBackdropFilter: "blur(20px) saturate(1.1)",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 14, marginBottom: 18 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h2
            style={{
              margin: 0,
              fontFamily: "'Playfair Display', serif",
              fontStyle: "italic",
              fontWeight: 700,
              fontSize: 26,
              color: "#fff",
              letterSpacing: -0.3,
            }}
          >
            Movie Reel Roulette
          </h2>
          <p
            style={{
              margin: "4px 0 0",
              fontFamily: "'Syne', sans-serif",
              fontSize: 13,
              color: "rgba(255,255,255,0.62)",
              letterSpacing: 0.2,
            }}
          >
            Spin for a random film with Film Glance score 8/10 or higher.
            {poolSize != null && spinState !== "idle"
              ? ` Spinning from ${poolSize} films.`
              : null}
          </p>
        </div>
        <FilterDropdown
          label="DECADE"
          value={decade}
          options={DECADE_OPTIONS}
          onChange={(v) => setDecade(v)}
          placeholder="Any year"
          width={180}
        />
        <button
          type="button"
          onClick={spin}
          disabled={spinState === "loading" || spinState === "spinning"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "11px 22px",
            borderRadius: 12,
            background: "linear-gradient(135deg, #FFE27A 0%, #FFD700 48%, #E8A000 100%)",
            color: "#0a0805",
            fontFamily: "'Syne', sans-serif",
            fontWeight: 700,
            fontSize: 14,
            letterSpacing: 0.4,
            border: "none",
            cursor: spinState === "loading" || spinState === "spinning" ? "wait" : "pointer",
            opacity: spinState === "loading" || spinState === "spinning" ? 0.7 : 1,
            boxShadow: "0 10px 28px rgba(255,215,0,0.35)",
          }}
        >
          <Dice3 size={15} aria-hidden="true" />
          {spinState === "loading" ? "Loading…" : spinState === "spinning" ? "Spinning…" : "Spin"}
        </button>
      </div>

      {/* Reels — visible only during spinning */}
      {showReels && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 14,
            marginBottom: 8,
            flexWrap: "nowrap",
          }}
        >
          {[0, 1, 2].map((idx) => {
            const reelPosters = pickRandomPosters(pool, 23);
            return (
              <Reel
                key={`reel-${idx}-${animKey}`}
                posters={reelPosters}
                finalPoster={finalPoster}
                durationSec={REEL_DURATIONS[idx]}
                animKey={animKey}
                isMobile={isMobile}
                hidden={isMobile && idx > 0}
              />
            );
          })}
        </div>
      )}

      {spinState === "done" && pickedEntry && (
        <RouletteCard entry={pickedEntry} onSpinAgain={spin} />
      )}

      {spinState === "error" && errorMsg && (
        <div
          style={{
            padding: 16,
            borderRadius: 10,
            background: "rgba(255,215,0,0.05)",
            border: "1px solid rgba(255,215,0,0.18)",
            fontFamily: "'Syne', sans-serif",
            fontSize: 14,
            color: "rgba(255,255,255,0.78)",
          }}
        >
          {errorMsg}
        </div>
      )}
    </section>
  );
}
