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
    if (s.max === 100) return s.score;
    if (s.max === 10) return s.score * 10;
    if (s.max === 5) return s.score * 20;
    return (s.score / s.max) * 100;
  });

  const mean = normalized.reduce((a, b) => a + b, 0) / normalized.length;

  return {
    ten: Math.round((mean / 10) * 10) / 10,
    stars: Math.round((mean / 20) * 2) / 2,
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
    obj.score >= 0 &&
    obj.score <= obj.max
  );
}
