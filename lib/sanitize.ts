// lib/sanitize.ts
// Title normalization shared between /api/search and the box-office ingestion
// pipeline, plus XSS-defense helpers used at render boundaries.
//
// `sanitizeQuery` was extracted from app/api/search/route.ts (was lines
// 89-97 in v5.11.0). YouTube/URL validators added in v6.2.0 (audit High 5).

export function sanitizeQuery(q: string): string {
  return q
    .trim()
    .toLowerCase()
    .replace(/[\x00-\x1f\x7f]/g, "")
    .replace(/[^\w\s:'\-&.!,()]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 200);
}

// YouTube IDs are exactly 11 chars from [A-Za-z0-9_-]. Anything else is
// either a corrupted cache row or an attempted injection through `src=`.
// Guard at render time so a bad id can't construct an unexpected iframe URL.
const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;

export function isValidYouTubeId(s: unknown): s is string {
  return typeof s === "string" && YOUTUBE_ID_RE.test(s);
}

// Validate an external URL before sticking it in an `<a href>` or `<iframe src>`.
// Rejects javascript:, data:, vbscript:, anything non-http(s), and unparseable
// strings. Use this at every render boundary that consumes a URL from cached
// data, Claude output, or third-party API responses.
export function safeExternalUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}
