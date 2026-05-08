// lib/schemas.ts
// Zod schemas for runtime input validation at API boundaries.
// Added in v6.2.x (audit Phase B — Medium 14).
//
// Pattern: each schema represents the validated, normalized shape of one
// route's request payload. Routes use `safeParse(body)` and return 400 with
// a short error string on failure instead of trying to parse manually.

import { z } from "zod";

// /api/enrich — TMDB-only enrichment lookup.
// `cast` may be either bare names or {name, character} objects.
export const EnrichRequestSchema = z.object({
  title: z.string().trim().min(1).max(300),
  year: z.number().int().gte(1888).lte(2100).optional(),
  cast: z
    .array(
      z.union([
        z.string().max(100),
        z.object({
          name: z.string().max(100),
          character: z.string().max(200).optional(),
        }),
      ])
    )
    .max(20)
    .optional(),
});

export type EnrichRequest = z.infer<typeof EnrichRequestSchema>;

// /api/suggest — Did-You-Mean fuzzy + TMDB merge.
// Single query string param, length-bounded.
export const SuggestQuerySchema = z.object({
  q: z.string().trim().min(2).max(120),
});

export type SuggestQuery = z.infer<typeof SuggestQuerySchema>;

// /api/discover — list 100 ranked films per filter combo (v6.4.0).
export const DiscoverQuerySchema = z.object({
  release_window: z.enum(["in_theaters", "at_home"]),
  genre: z.string().trim().min(1).max(40).optional(),
  year: z.coerce.number().int().gte(1888).lte(2100).optional(),
  hidden_gems: z
    .preprocess((v) => v === "true" || v === true || v === "1", z.boolean())
    .optional(),
  limit: z.coerce.number().int().gte(1).lte(100).optional(),
});

export type DiscoverQuery = z.infer<typeof DiscoverQuerySchema>;

// /api/discover/random — Movie Reel Roulette spin (v6.4.0; genre added v6.4.1).
const DECADE_LABELS = ["any", "2020s", "2010s", "2000s", "1990s", "1980s", "1970s", "pre-1970"] as const;
export const DiscoverRandomQuerySchema = z.object({
  decade: z.enum(DECADE_LABELS).default("any"),
  min_score: z.coerce.number().gte(0).lte(10).optional(),
  genre: z.string().trim().min(1).max(40).optional(),
});

export type DiscoverRandomQuery = z.infer<typeof DiscoverRandomQuerySchema>;
export type DecadeLabel = (typeof DECADE_LABELS)[number];

export function decadeRange(label: DecadeLabel): { start: number | null; end: number | null } {
  switch (label) {
    case "any": return { start: null, end: null };
    case "2020s": return { start: 2020, end: 2029 };
    case "2010s": return { start: 2010, end: 2019 };
    case "2000s": return { start: 2000, end: 2009 };
    case "1990s": return { start: 1990, end: 1999 };
    case "1980s": return { start: 1980, end: 1989 };
    case "1970s": return { start: 1970, end: 1979 };
    case "pre-1970": return { start: 1888, end: 1969 };
  }
}
