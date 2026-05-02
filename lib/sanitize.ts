// lib/sanitize.ts
// Title normalization shared between /api/search and the box-office ingestion
// pipeline. Used as the `search_key` in both `movie_cache` and
// `box_office_metrics` so a row in either table can be looked up by the same
// normalized string.
//
// Extracted from app/api/search/route.ts (was lines 89-97 in v5.11.0).

export function sanitizeQuery(q: string): string {
  return q
    .trim()
    .toLowerCase()
    .replace(/[\x00-\x1f\x7f]/g, "")
    .replace(/[^\w\s:'\-&.!,()]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 200);
}
