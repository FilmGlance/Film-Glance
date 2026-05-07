"use client";

// RouletteSpinner — Movie Reel Roulette. Decade + Genre pickers (both
// default "Any") + Spin button. On click: animate three vertically-
// scrolling poster reels (slot machine), staggered 3.6s/3.9s/4.2s decel
// cubic-bezier(0.16,1,0.3,1). After the third reel stops, fade in the
// RouletteCard with the actual chosen movie.
//
// Mobile (<520px): single reel, full-width — same rhythm, less crowding.
//
// v6.4.1: added Genre dropdown alongside Decade. Visual polish — italic
// Playfair gold-gradient section title, soft gold halo behind heading.

import React, { useEffect, useMemo, useState } from "react";
import { Dice3 } from "lucide-react";
import FilterDropdown from "@/components/box-office/FilterDropdown";
import RouletteCard from "./RouletteCard";

const TMDB_POSTER_BASE = "https://image.tmdb.org/t/p/w300";

const DECADE_OPTIONS = [
  { value: "any",      label: "Any year", italic: true },
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
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 60, background: "linear-gradient(180deg, rgba(8,6,2,0.95) 0%, rgba(8,6,2,0) 100%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 60, background: "linear-gradient(0deg, rgba(8,6,2,0.95) 0%, rgba(8,6,2,0) 100%)", pointerEvents: "none" }} />
    </div>
  );
}

export default function RouletteSpinner({ posterPool, availableGenres = [] }) {
  const [decade, setDecade] = useState("any");
  const [genre, setGenre] = useState(null); // null = "Any genre"
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

  const genreOptions = useMemo(() => [
    { value: null, label: "Any genre", italic: true },
    ...((availableGenres || []).map((g) => ({ value: g.genre, label: g.genre }))),
  ], [availableGenres]);

  async function spin() {
    if (spinState === "spinning" || spinState === "loading") return;
    setSpinState("loading");
    setPickedEntry(null);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams({ decade });
      if (genre) params.set("genre", genre);
      const r = await fetch(`/api/discover/random?${params.toString()}`);
      if (r.status === 404) {
        setErrorMsg(genre
          ? `No ${genre.toLowerCase()} films match this decade. Try another combo.`
          : "No movies match this decade. Try another.");
        setSpinState("error");
        return;
      }
      if (!r.ok) throw new Error(`API ${r.status}`);
      const d = await r.json();
      setPoolSize(d.pool_size ?? null);
      setFinalPoster(d.entry?.poster_path || null);
      setAnimKey((k) => k + 1);
      setSpinState("spinning");
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
        position: "relative",
        marginBottom: 28,
        padding: 24,
        borderRadius: 18,
        background: "linear-gradient(180deg, rgba(20,15,4,0.72) 0%, rgba(8,6,2,0.78) 100%)",
        border: "1.5px solid rgba(255,215,0,0.22)",
        backdropFilter: "blur(20px) saturate(1.1)",
        WebkitBackdropFilter: "blur(20px) saturate(1.1)",
        boxShadow: "0 16px 48px rgba(0,0,0,0.45), 0 0 80px rgba(255,215,0,0.06), inset 0 1px 0 rgba(255,215,0,0.08)",
      }}
    >
      {/* Soft gold halo behind heading */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: -16,
          top: -20,
          right: -16,
          height: 140,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse at 18% 50%, rgba(255,215,0,0.10), transparent 60%)",
          filter: "blur(6px)",
          zIndex: 0,
        }}
      />

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 14, marginBottom: 18 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h2
            style={{
              margin: 0,
              fontFamily: "'Playfair Display', serif",
              fontStyle: "italic",
              fontWeight: 700,
              fontSize: "clamp(28px, 3.4vw, 38px)",
              lineHeight: 1.05,
              letterSpacing: -0.4,
              background: "linear-gradient(135deg, #FFE27A 0%, #FFD700 48%, #E8A000 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
              color: "transparent",
              filter: "drop-shadow(0 0 18px rgba(255,215,0,0.22))",
              paddingBottom: "0.06em",
            }}
          >
            Movie Reel Roulette.
          </h2>
          <p
            style={{
              margin: "8px 0 0",
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
          onChange={(v) => setDecade(v ?? "any")}
          placeholder="Any year"
          width={160}
        />
        <FilterDropdown
          label="GENRE"
          value={genre}
          options={genreOptions}
          onChange={(v) => setGenre(v)}
          placeholder="Any genre"
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

      {showReels && (
        <div
          style={{
            position: "relative",
            zIndex: 1,
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
        <div style={{ position: "relative", zIndex: 1 }}>
          <RouletteCard entry={pickedEntry} onSpinAgain={spin} />
        </div>
      )}

      {spinState === "error" && errorMsg && (
        <div
          style={{
            position: "relative",
            zIndex: 1,
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
