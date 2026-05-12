// lib/structured-data.ts
//
// Pure functions that return schema.org JSON-LD objects for embedding in
// `<script type="application/ld+json">` tags. Each helper returns a plain
// JSON-serializable object — no React, no DOM, easy to test.
//
// Used by:
//   - app/layout.tsx — Organization + WebSite (every page)
//   - app/discover/page.tsx — CollectionPage + ItemList + Breadcrumb
//   - app/boxoffice/page.tsx — CollectionPage + ItemList + Breadcrumb
//   - app/faq/page.tsx (Phase 5) — FAQPage
//   - app/about/page.tsx (Phase 5) — AboutPage
//   - app/movie/[id]/[slug]/page.tsx (deferred per-movie sibling plan) —
//     Movie + AggregateRating + Review[]
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
