"use client";

// FilterDropdown — reusable portal dropdown for Year/Month/Week selectors.
// Renders the popover via React Portal to document.body so FilterBar's
// backdrop-filter (which creates a CSS containing block for fixed children)
// can't clip or reposition it. Same lesson learned in PeriodNavigator.
//
// Props:
//   label    — visible label above the trigger ("YEAR", "MONTH", "WEEK")
//   value    — current selected option value (any) or null
//   options  — [{ value, label, disabled? }, ...]; the first option may be a
//              "clear" option (e.g. "(Whole year)") if the dropdown allows
//              clearing — its `value` should be null.
//   onChange — called with the new value (or null for clear)
//   placeholder — text shown when no value selected
//   disabled — locks the trigger
//   width    — desktop width (default 220)

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

export default function FilterDropdown({
  label,
  value,
  options,
  onChange,
  placeholder = "Select…",
  disabled = false,
  width = 220,
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 280, maxHeight: 360 });
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);

  const computePos = () => {
    if (!triggerRef.current) return null;
    const r = triggerRef.current.getBoundingClientRect();
    const margin = 8;
    const top = r.bottom + margin;
    const left = r.left;
    const popoverWidth = Math.max(r.width, 200);
    const maxHeight = Math.max(180, window.innerHeight - top - 16);
    return { top, left, width: popoverWidth, maxHeight };
  };

  const toggle = () => {
    if (disabled) return;
    if (open) {
      setOpen(false);
      return;
    }
    const next = computePos();
    if (next) setPos(next);
    setOpen(true);
  };

  useLayoutEffect(() => {
    if (!open) return;
    const reposition = () => {
      const next = computePos();
      if (next) setPos(next);
    };
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target) &&
        triggerRef.current && !triggerRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const selected = options.find((o) => o.value === value) || null;
  const triggerLabel = selected?.label || placeholder;

  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        gap: 6,
        minWidth: 0,
      }}
    >
      {label && (
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10.5,
            letterSpacing: 1.6,
            textTransform: "uppercase",
            color: disabled ? "rgba(255,255,255,0.32)" : "rgba(255,215,0,0.62)",
            fontWeight: 600,
          }}
        >
          {label}
        </span>
      )}
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          width,
          maxWidth: "100%",
          padding: "9px 14px",
          borderRadius: 10,
          background: disabled ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0.32)",
          border: `1px solid ${open ? "rgba(255,215,0,0.48)" : disabled ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.14)"}`,
          color: disabled ? "rgba(255,255,255,0.32)" : selected ? "#fff" : "rgba(255,255,255,0.55)",
          fontFamily: "'Syne', sans-serif",
          fontSize: 14,
          fontWeight: 600,
          letterSpacing: 0.3,
          cursor: disabled ? "not-allowed" : "pointer",
          transition: "border-color 0.25s ease, color 0.25s ease, background 0.25s ease",
        }}
      >
        <span
          style={{
            flex: 1,
            textAlign: "left",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {triggerLabel}
        </span>
        <ChevronDown
          size={14}
          style={{
            color: disabled ? "rgba(255,215,0,0.22)" : "rgba(255,215,0,0.7)",
            transition: "transform 0.25s ease",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            flexShrink: 0,
          }}
        />
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={popoverRef}
          role="listbox"
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            width: pos.width,
            maxHeight: pos.maxHeight,
            overflowY: "auto",
            zIndex: 9999,
            padding: 6,
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
          {options.length === 0 && (
            <div
              style={{
                padding: 12,
                fontFamily: "'Syne', sans-serif",
                fontSize: 13,
                color: "rgba(255,255,255,0.55)",
              }}
            >
              No options available.
            </div>
          )}
          {options.map((opt, idx) => {
            const isActive = opt.value === value;
            const optDisabled = !!opt.disabled;
            return (
              <button
                key={`${idx}-${opt.value ?? "null"}`}
                type="button"
                role="option"
                aria-selected={isActive}
                disabled={optDisabled}
                onClick={() => {
                  if (optDisabled) return;
                  onChange(opt.value);
                  setOpen(false);
                }}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 8,
                  background: isActive
                    ? "linear-gradient(135deg, rgba(255,215,0,0.14), rgba(255,165,0,0.04))"
                    : "transparent",
                  border: `1px solid ${isActive ? "rgba(255,215,0,0.32)" : "transparent"}`,
                  color: optDisabled
                    ? "rgba(255,255,255,0.28)"
                    : isActive
                      ? "#FFD700"
                      : "rgba(255,255,255,0.82)",
                  fontFamily: "'Syne', sans-serif",
                  fontSize: 13.5,
                  fontWeight: isActive ? 700 : 500,
                  textAlign: "left",
                  cursor: optDisabled ? "not-allowed" : "pointer",
                  transition: "background 0.18s ease, border-color 0.18s ease, color 0.18s ease",
                  marginBottom: 1,
                  fontStyle: opt.italic ? "italic" : "normal",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
}
