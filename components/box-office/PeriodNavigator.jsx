"use client";

// Period navigator — ←/→ buttons + a dropdown of available periods.
// `availablePeriods` comes from the read API as the distinct period_starts
// for the current (period_type, region). The dropdown groups by year so
// 40-year backfills don't render as a 2,000-row dropdown.

import React, { useMemo, useRef, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";

function groupByYear(items) {
  const groups = new Map();
  for (const it of items) {
    const yr = (it.period_start || "").slice(0, 4);
    if (!yr) continue;
    if (!groups.has(yr)) groups.set(yr, []);
    groups.get(yr).push(it);
  }
  return groups;
}

export default function PeriodNavigator({
  period,
  date,
  availablePeriods,
  onChange,
}) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef(null);

  const currentIndex = useMemo(() => {
    if (!date) return 0; // "latest" → first item in DESC list
    return availablePeriods.findIndex((p) => p.period_start === date);
  }, [date, availablePeriods]);

  const groups = useMemo(() => groupByYear(availablePeriods), [availablePeriods]);
  const yearList = useMemo(
    () => Array.from(groups.keys()).sort((a, b) => parseInt(b) - parseInt(a)),
    [groups],
  );

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const goPrev = () => {
    // Periods are DESC by date; "previous in time" = LATER in array
    if (currentIndex < 0 || availablePeriods.length === 0) return;
    const target =
      currentIndex + 1 < availablePeriods.length
        ? availablePeriods[currentIndex + 1]
        : null;
    if (target) onChange(target.period_start);
  };

  const goNext = () => {
    // "next in time" = EARLIER in array (more recent)
    if (currentIndex <= 0) return;
    const target = availablePeriods[currentIndex - 1];
    if (target) onChange(target.period_start);
  };

  const currentLabel =
    currentIndex >= 0 && availablePeriods[currentIndex]
      ? availablePeriods[currentIndex].period_label
      : availablePeriods[0]?.period_label || "—";

  const navBtnStyle = (disabled) => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 30,
    height: 30,
    borderRadius: 8,
    background: "rgba(0,0,0,0.32)",
    border: "1px solid rgba(255,255,255,0.10)",
    color: disabled ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.72)",
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "color 0.2s ease, border-color 0.2s ease, background 0.2s ease",
  });

  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 6 }}>
      <button
        type="button"
        onClick={goPrev}
        disabled={currentIndex >= availablePeriods.length - 1 || availablePeriods.length === 0}
        aria-label="Previous period"
        style={navBtnStyle(currentIndex >= availablePeriods.length - 1)}
      >
        <ChevronLeft size={16} />
      </button>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          minWidth: 200,
          padding: "8px 14px",
          borderRadius: 10,
          background: "rgba(0,0,0,0.32)",
          border: `1px solid ${open ? "rgba(255,215,0,0.32)" : "rgba(255,255,255,0.12)"}`,
          color: "#fff",
          fontFamily: "'Syne', sans-serif",
          fontSize: 13.5,
          letterSpacing: 0.3,
          cursor: "pointer",
          transition: "border-color 0.25s ease",
        }}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span style={{ flex: 1, textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {currentLabel}
        </span>
        <ChevronDown
          size={14}
          style={{
            color: "rgba(255,215,0,0.6)",
            transition: "transform 0.25s ease",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      <button
        type="button"
        onClick={goNext}
        disabled={currentIndex <= 0}
        aria-label="Next period"
        style={navBtnStyle(currentIndex <= 0)}
      >
        <ChevronRight size={16} />
      </button>

      {open && (
        <div
          ref={popoverRef}
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            zIndex: 50,
            minWidth: 280,
            maxHeight: 420,
            overflowY: "auto",
            padding: 10,
            background: "rgba(8,6,2,0.96)",
            border: "1px solid rgba(255,215,0,0.18)",
            borderRadius: 12,
            backdropFilter: "blur(28px) saturate(1.1)",
            WebkitBackdropFilter: "blur(28px) saturate(1.1)",
            boxShadow: "0 24px 70px rgba(0,0,0,0.65)",
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(255,215,0,0.32) transparent",
          }}
        >
          {availablePeriods.length === 0 && (
            <div
              style={{
                padding: 12,
                fontFamily: "'Syne', sans-serif",
                fontSize: 13,
                color: "rgba(255,255,255,0.55)",
              }}
            >
              No data yet. The first weekly cron will populate this.
            </div>
          )}
          {yearList.map((yr) => (
            <div key={yr} style={{ marginBottom: 8 }}>
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11,
                  letterSpacing: 1.4,
                  color: "rgba(255,215,0,0.62)",
                  padding: "6px 8px 4px",
                }}
              >
                {yr}
              </div>
              {groups.get(yr).map((p) => {
                const isActive = p.period_start === (date || availablePeriods[0]?.period_start);
                return (
                  <button
                    key={p.period_start}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => {
                      onChange(p.period_start);
                      setOpen(false);
                    }}
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 8,
                      background: isActive
                        ? "linear-gradient(135deg, rgba(255,215,0,0.13), rgba(255,165,0,0.04))"
                        : "transparent",
                      border: `1px solid ${isActive ? "rgba(255,215,0,0.30)" : "transparent"}`,
                      color: isActive ? "#FFD700" : "rgba(255,255,255,0.78)",
                      fontFamily: "'Syne', sans-serif",
                      fontSize: 13,
                      textAlign: "left",
                      cursor: "pointer",
                      transition: "background 0.2s ease, border-color 0.2s ease, color 0.2s ease",
                    }}
                  >
                    {p.period_label || p.period_start}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
