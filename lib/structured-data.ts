// lib/structured-data.ts
//
// Pure functions that return schema.org JSON-LD objects for embedding in
// `<script type="application/ld+json">` tags. Each helper returns a plain
// JSON-serializable object — no React, no DOM, easy to test.
//
// Used by:
//   - app/layout.tsx — Organization + WebSite (every page)
//   - app/page.tsx — Movie + AggregateRating + Review[] (when ?q= present;
//     v6.7.0 Move A — single-route GEO without per-movie URLs)
//   - app/discover/page.tsx — CollectionPage + ItemList (Movie items) + Breadcrumb
//   - app/boxoffice/page.tsx — CollectionPage + ItemList + Breadcrumb
//   - app/faq/page.tsx (Phase 5) — FAQPage
//   - app/about/page.tsx (Phase 5) — AboutPage
//
// Schema.org reference: https://schema.org/

const SITE_URL = "https://www.filmglance.com";
const SITE_NAME = "Film Glance";

export interface Crumb {
  name: string;
  url: string;
}

export interface ItemListEntry {
  name: string;
  url: string;
  position: number; // 1-indexed
  image?: string;
}

export interface FaqQA {
  question: string;
  answer: string; // plain text (will be embedded in JSON; HTML-escaping done at serialize time)
}

export interface MovieSchemaSource {
  type: string;       // e.g. "Rotten Tomatoes (Critics)", "IMDb"
  score: number;      // raw score
  max: number;        // raw scale max
  url?: string | null;
}

export interface MovieSchemaInput {
  url: string;                       // canonical URL (e.g. https://www.filmglance.com/?q=the-matrix)
  title: string;
  year?: number | null;
  releaseDate?: string | null;       // YYYY-MM-DD
  director?: string | null;          // "Lana Wachowski, Lilly Wachowski"
  cast?: Array<{ name?: string }> | null;
  genre?: string | null;             // "Action · Science Fiction" or "Action, Science Fiction"
  description?: string | null;
  posterPath?: string | null;
  runtime?: string | number | null;  // "120 min", "2h 16m", or number-of-minutes
  fgScore?: number | null;           // 0..10 aggregated Film Glance Score
  sources?: MovieSchemaSource[] | null;
}

const TMDB_POSTER_BASE = "https://image.tmdb.org/t/p/w500";

// Runtime to ISO 8601 duration. Inputs we see in production data:
//   "136 min"   → "PT136M"
//   "2h 16m"    → "PT136M"
//   "2h"        → "PT120M"
//   136         → "PT136M"
function runtimeToIso8601(runtime: string | number | null | undefined): string | undefined {
  if (runtime == null) return undefined;
  if (typeof runtime === "number" && Number.isFinite(runtime) && runtime > 0) {
    return `PT${Math.round(runtime)}M`;
  }
  if (typeof runtime !== "string") return undefined;
  const trimmed = runtime.trim();
  if (!trimmed) return undefined;
  // "120 min" / "120 minutes" / "120m"
  const minMatch = trimmed.match(/^(\d+)\s*(?:min(?:ute)?s?|m)\b/i);
  if (minMatch) return `PT${parseInt(minMatch[1], 10)}M`;
  // "2h 16m" / "2h" / "2h 16"
  const hmMatch = trimmed.match(/^(\d+)\s*h(?:\s*(\d+)\s*m?)?/i);
  if (hmMatch) {
    const h = parseInt(hmMatch[1], 10);
    const m = hmMatch[2] ? parseInt(hmMatch[2], 10) : 0;
    return `PT${h * 60 + m}M`;
  }
  // Bare integer string
  if (/^\d+$/.test(trimmed)) return `PT${parseInt(trimmed, 10)}M`;
  return undefined;
}

// Split director / genre strings into arrays. The cache uses both " · " and
// ", " as separators across different generations of code.
function splitMulti(s: string | null | undefined): string[] {
  if (!s) return [];
  return s
    .split(/\s*[·,]\s*/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/**
 * Movie + AggregateRating + Review[] for a single cached film.
 *
 * v6.7.0 Move A: emitted by `app/page.tsx` when the URL has `?q=<title>`,
 * making every searched film indexable as structured data without giving
 * it its own route segment. Also embedded as each ItemList entry in
 * `app/discover/page.tsx`'s `mainEntity` (without the Review[] tail —
 * sources aren't pulled by the discover_movies RPC).
 *
 * Reviews are emitted ONE PER source — Rotten Tomatoes (Critics) +
 * Rotten Tomatoes (Audience) + IMDb + Metacritic + Letterboxd + Trakt +
 * Simkl + OMDb + TMDB. Each gets author=Organization + reviewRating with
 * the source's native scale preserved (so a 0-100 RT score reads as
 * ratingValue:87 bestRating:100, while a 0-10 IMDb score reads
 * ratingValue:8.6 bestRating:10).
 */
export function movieSchema(input: MovieSchemaInput): Record<string, unknown> {
  const directors = splitMulti(input.director);
  const genres = splitMulti(input.genre);
  const actors = (input.cast || [])
    .map((c) => (c?.name || "").trim())
    .filter(Boolean)
    .slice(0, 20); // cap — Schema.org doesn't define a limit but 20 is plenty for citation

  const out: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Movie",
    "@id": input.url,
    url: input.url,
    name: input.year ? `${input.title} (${input.year})` : input.title,
  };

  if (input.releaseDate) out.datePublished = input.releaseDate;
  if (directors.length > 0) {
    out.director = directors.map((name) => ({ "@type": "Person", name }));
  }
  if (actors.length > 0) {
    out.actor = actors.map((name) => ({ "@type": "Person", name }));
  }
  if (genres.length > 0) out.genre = genres;
  if (input.description) out.description = input.description;
  if (input.posterPath) out.image = `${TMDB_POSTER_BASE}${input.posterPath}`;

  const duration = runtimeToIso8601(input.runtime);
  if (duration) out.duration = duration;

  if (typeof input.fgScore === "number" && input.fgScore >= 0) {
    const sourceCount = Array.isArray(input.sources) ? input.sources.length : 0;
    out.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Number(input.fgScore.toFixed(1)),
      bestRating: 10,
      worstRating: 0,
      ...(sourceCount > 0 ? { ratingCount: sourceCount, reviewCount: sourceCount } : {}),
    };
  }

  if (Array.isArray(input.sources) && input.sources.length > 0) {
    out.review = input.sources
      .filter(
        (s) =>
          s &&
          typeof s.type === "string" &&
          s.type.trim() &&
          typeof s.score === "number" &&
          typeof s.max === "number" &&
          s.max > 0,
      )
      .map((s) => ({
        "@type": "Review",
        author: { "@type": "Organization", name: s.type.trim() },
        reviewRating: {
          "@type": "Rating",
          ratingValue: s.score,
          bestRating: s.max,
          worstRating: 0,
        },
      }));
  }

  return out;
}

/**
 * Organization — describes Film Glance the brand. Goes in `app/layout.tsx`.
 * `sameAs` will be populated as social profiles get created; placeholder
 * empty array is fine until then.
 */
export function organizationSchema(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/favicon.ico`,
    description:
      "Minimalist movie rating aggregator — one verified score per film, drawn from nine critic and audience sources.",
    sameAs: [] as string[], // Add LinkedIn / X / YouTube / Mastodon URLs as they exist
  };
}

/**
 * WebSite — declares the site identity + a SearchAction so search engines
 * (and LLM citation engines) know how to deep-link to a search.
 */
export function websiteSchema(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * BreadcrumbList — Home → … → current page. Each crumb has name + url.
 * The last crumb should be the current page.
 */
export function breadcrumbSchema(crumbs: Crumb[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: c.url,
    })),
  };
}

/**
 * CollectionPage — describes a page that aggregates a list of items.
 * Used on /discover and /boxoffice. The actual list lives in a
 * separate ItemList schema (see itemListSchema below) so it can be
 * embedded as a separate JSON-LD block.
 */
export function collectionPageSchema(args: {
  url: string;
  name: string;
  description: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    url: args.url,
    name: args.name,
    description: args.description,
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: SITE_URL,
    },
  };
}

/**
 * ItemList — ordered list of films (or other items). For /discover and
 * /boxoffice. Each entry needs name, url, position; image is optional but
 * recommended for richer crawl signal.
 */
export function itemListSchema(args: {
  name: string;
  description?: string;
  numberOfItems: number;
  items: ItemListEntry[];
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: args.name,
    description: args.description,
    numberOfItems: args.numberOfItems,
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    itemListElement: args.items.map((it) => ({
      "@type": "ListItem",
      position: it.position,
      url: it.url,
      name: it.name,
      image: it.image,
    })),
  };
}

/**
 * FAQPage — for /faq (Phase 5). Each Q&A becomes a `Question` with a
 * single `acceptedAnswer`. Google + Bing both render these as rich
 * accordions in search results.
 */
export function faqPageSchema(qas: FaqQA[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: qas.map((qa) => ({
      "@type": "Question",
      name: qa.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: qa.answer,
      },
    })),
  };
}

/**
 * AboutPage — for /about (Phase 5). Lightweight wrapper that ties the
 * /about URL to the Organization entity so crawlers know they're related.
 */
export function aboutPageSchema(args: {
  url: string;
  name: string;
  description: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    url: args.url,
    name: args.name,
    description: args.description,
    about: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
  };
}

/**
 * Serialize one or more schema objects into a string suitable for
 * embedding in `<script type="application/ld+json">{output}</script>`.
 *
 * If passed a single schema, returns its JSON. If passed an array,
 * wraps in a top-level `@graph` so multiple schemas live in one tag.
 */
export function serializeJsonLd(
  schema: Record<string, unknown> | Record<string, unknown>[],
): string {
  if (Array.isArray(schema)) {
    // Multiple schemas in one block: use the @graph pattern. Cleaner than
    // emitting multiple <script> tags for related schemas.
    return JSON.stringify({
      "@context": "https://schema.org",
      "@graph": schema.map((s) => {
        const { "@context": _ctx, ...rest } = s;
        return rest;
      }),
    });
  }
  return JSON.stringify(schema);
}
