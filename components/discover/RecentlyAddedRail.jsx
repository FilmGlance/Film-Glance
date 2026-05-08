"use client";

// RecentlyAddedRail — horizontal-scroll strip of last 10 cached films.
// Sits at the top of the page so /discover feels alive between user
// searches.

import React, { useEffect, useState } from "react";
import Link from "next/link";

const TMDB_POSTER_BASE = "https://image.tmdb.org/t/p/w300";

function MiniCard({ entry, idx }) {
  const posterUrl = entry.poster_path ? `${TMDB_POSTER_BASE}${entry.poster_path}` : null;
  return (
    <Link
      href={`/?q=${encodeURIComponent(entry.title)}`}
      aria-label={`View ${entry.title} on Film Glance`}
      style={{
        flex: "0 0 auto",
        width: 124,
        textDecoration: "none",
        color: "inherit",
        animation: `disCardIn 0.5s cubic-bezier(0.16,1,0.3,1) ${idx * 40}ms both`,
      }}
    >
      <div
        style={{
          position: "relative",
          width: 124,
          aspectRatio: "2 / 3",
          borderRadius: 10,
          overflow: "hidden",
          background: "rgba(0,0,0,0.5)",
          border: "1px solid rgba(255, 215, 0, 0.10)",
          boxShadow: "0 4px 14px rgba(0,0,0,0.45)",
          transition: "transform 0.25s ease, border-color 0.25s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-3px)";
          e.currentTarget.style.borderColor = "rgba(255,215,0,0.32)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.borderColor = "rgba(255,215,0,0.10)";
        }}
      >
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={entry.title}
            loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center", height: "100%",
            fontFamily: "'Playfair Display', serif", fontStyle: "italic",
            color: "rgba(255,215,0,0.32)", fontSize: 28,
          }}>
            {entry.title?.charAt(0)}
          </div>
        )}
        <div
          style={{
            position: "absolute", bottom: 6, left: 6,
            padding: "2px 7px", borderRadius: 8,
            background: "rgba(8,6,2,0.86)",
            border: "1px solid rgba(255,215,0,0.32)",
            fontFamily: "'Playfair Display', serif",
            fontStyle: "italic",
            fontWeight: 700,
            fontSize: 13,
            color: "#FFD700",
            lineHeight: 1,
            paddingBottom: "0.1em",
          }}
        >
          {entry.fg_score != null ? Number(entry.fg_score).toFixed(1) : "—"}
        </div>
      </div>
      <div
        style={{
          marginTop: 6,
          fontFamily: "'Syne', sans-serif",
          fontSize: 12,
          fontWeight: 600,
          color: "#fff",
          lineHeight: 1.25,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {entry.title}
      </div>
    </Link>
  );
}

export default function RecentlyAddedRail() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/discover/recent")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => { if (!cancelled) setEntries(d.entries || []); })
      .catch(() => { /* silent — rail just hides */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (!loading && entries.length === 0) return null;

  return (
    <section aria-label="Recently added" style={{ marginBottom: 28 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontFamily: "'Playfair Display', serif",
            fontStyle: "italic",
            fontWeight: 700,
            fontSize: 22,
            color: "#fff",
            letterSpacing: -0.2,
          }}
        >
          Recently added
        </h2>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10.5,
            letterSpacing: 1.4,
            textTransform: "uppercase",
            color: "rgba(255,215,0,0.55)",
          }}
        >
          New to the cache
        </span>
      </div>
      <div
        style={{
          display: "flex",
          gap: 14,
          overflowX: "auto",
          paddingBottom: 8,
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(255,215,0,0.32) transparent",
        }}
      >
        {entries.map((entry, idx) => (
          <MiniCard key={entry.search_key} entry={entry} idx={idx} />
        ))}
      </div>
    </section>
  );
}
