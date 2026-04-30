// lib/use-count-up.ts
//
// rAF-driven number animation hook. Animates from 0 (or the previous value)
// to `target` over `duration` ms with an ease-out cubic curve. Used by the
// box-office page for the gross / theaters / per-theater-average count-up
// on filter change.
//
// `target` is the destination number. When it changes, the hook restarts
// the animation from the previous rendered value (avoids the "0 → target"
// reset that looks ugly when changing filters between non-empty results).
//
// Returns the current animated value (integer-rounded).

"use client";

import { useEffect, useRef, useState } from "react";

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export function useCountUp(target: number, duration: number = 800): number {
  const [value, setValue] = useState<number>(0);
  const fromRef = useRef<number>(0);
  const startRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      setValue(target);
      return;
    }
    fromRef.current = value;
    startRef.current = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startRef.current;
      const t = Math.min(1, elapsed / duration);
      const eased = easeOutCubic(t);
      const v = fromRef.current + (target - fromRef.current) * eased;
      setValue(t >= 1 ? target : v);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else rafRef.current = null;
    };

    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    // We deliberately do NOT depend on `value` — that would create a feedback
    // loop. We only re-animate when `target` or `duration` change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return value;
}
