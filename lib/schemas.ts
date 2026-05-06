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
