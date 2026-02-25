// lib/score.ts
// Score calculation logic — extracted from the frontend so it can run
// server-side where it cannot be tampered with.

export interface SourceScore {
  name: string;
  score: number;
  max: number;
  type: string;
  url: string;
}

export interface AggregatedScore {
  ten: number;     // Score out of 10 (e.g., 8.4)
  stars: number;   // Star rating out of 5 (e.g., 4.0)
  count: number;   // Number of sources
}

export function calcScore(sources: SourceScore[]): AggregatedScore {
  if (!sources || sources.length === 0) {
    return { ten: 0, stars: 0, count: 0 };
  }

  const normalized = sources.map((s) => {
    let score = s.score;
    let max = s.max;

    // Auto-correct mismatched scale: if score > max, infer the correct max
    // e.g., Haiku returns score: 92, max: 10 for Rotten Tomatoes → should be max: 100
    if (score > max) {
      if (score <= 100 && (max === 5 || max === 10)) max = 100;
      else score = max; // cap at max as fallback
    }

    const pct =
      max === 100 ? score :
      max === 10 ? score * 10 :
      max === 5 ? score * 20 :
      (score / max) * 100;

    // Clamp to 0-100
    return Math.min(100, Math.max(0, pct));
  });

  const mean = normalized.reduce((a, b) => a + b, 0) / normalized.length;

  return {
    ten: Math.min(10, Math.round((mean / 10) * 10) / 10),
    stars: Math.min(5, Math.round((mean / 20) * 2) / 2),
    count: sources.length,
  };
}

// Validate that a source score object is well-formed
export function validateSource(s: unknown): s is SourceScore {
  if (!s || typeof s !== "object") return false;
  const obj = s as Record<string, unknown>;
  return (
    typeof obj.name === "string" &&
    typeof obj.score === "number" &&
    typeof obj.max === "number" &&
    obj.max > 0 &&
    obj.score >= 0
    // Note: removed obj.score <= obj.max check — Haiku sometimes returns
    // scores on wrong scale (e.g., 92/10), which calcScore now auto-corrects
  );
}
