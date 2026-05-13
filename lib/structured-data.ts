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
  name: string;       // canonical source label as stored in cache: "RT Critics",
                      //   "RT Audience", "Metacritic Metascore", "Metacritic User",
                      //   "IMDb", "Letterboxd", "TMDB", "Trakt", "Simkl", "OMDb"
  score: number;      // raw score
  max: number;        // raw scale max
  url?: string | null;
}

/**
 * v6.7.3 Tier-2 #6 — source-as-Organization (CMU GEO paper: 16%→50%+ factual
 * accuracy bump in LLM citations).
 *
 * Maps each cache source `name` to the publisher Organization that authored
 * the rating. Each Review's `author` is fully resolved (not a plain string)
 * so AI engines can disambiguate which outlet said what — e.g. a 0-100 RT
 * score and a 0-10 IMDb score are no longer "two anonymous numbers" but
 * "Rotten Tomatoes' critic consensus" and "IMDb's audience average".
 *
 * Stable `@id` (the publisher's homepage + `#publisher`) lets the same
 * Organization be referenced across every movie page, building entity
 * graph density. `sameAs` carries the publisher's canonical URL so
 * crawlers can resolve to the real-world entity.
 *
 * Wikidata IDs deliberately omitted — better to be silent than to guess
 * and feed crawlers a wrong identifier. Add per-source as confirmed.
 *
 * To support a new source: append an entry whose key matches the `name`
 * the ratings pipeline writes to `data.sources[i].name`.
 */
const SOURCE_PUBLISHER: Record<string, { name: string; id: string; sameAs: string[] }> = {
  "RT Critics": {
    name: "Rotten Tomatoes",
    id: "https://www.rottentomatoes.com/#publisher",
    sameAs: ["https://www.rottentomatoes.com/"],
  },
  "RT Audience": {
    name: "Rotten Tomatoes",
    id: "https://www.rottentomatoes.com/#publisher",
    sameAs: ["https://www.rottentomatoes.com/"],
  },
  "Metacritic Metascore": {
    name: "Metacritic",
    id: "https://www.metacritic.com/#publisher",
    sameAs: ["https://www.metacritic.com/"],
  },
  "Metacritic User": {
    name: "Metacritic",
    id: "https://www.metacritic.com/#publisher",
    sameAs: ["https://www.metacritic.com/"],
  },
  IMDb: {
    name: "IMDb",
    id: "https://www.imdb.com/#publisher",
    sameAs: ["https://www.imdb.com/"],
  },
  Letterboxd: {
    name: "Letterboxd",
    id: "https://letterboxd.com/#publisher",
    sameAs: ["https://letterboxd.com/"],
  },
  TMDB: {
    name: "The Movie Database",
    id: "https://www.themoviedb.org/#publisher",
    sameAs: ["https://www.themoviedb.org/"],
  },
  Trakt: {
    name: "Trakt",
    id: "https://trakt.tv/#publisher",
    sameAs: ["https://trakt.tv/"],
  },
  Simkl: {
    name: "Simkl",
    id: "https://simkl.com/#publisher",
    sameAs: ["https://simkl.com/"],
  },
  OMDb: {
    name: "OMDb",
    id: "https://www.omdbapi.com/#publisher",
    sameAs: ["https://www.omdbapi.com/"],
  },
};

function publisherForSource(sourceName: string): Record<string, unknown> {
  const trimmed = sourceName.trim();
  const known = SOURCE_PUBLISHER[trimmed];
  if (known) {
    return {
      "@type": "Organization",
      "@id": known.id,
      name: known.name,
      sameAs: known.sameAs,
    };
  }
  // Unknown source — degrade gracefully to a bare Organization (still valid
  // schema.org, just no entity resolution). Logging here would be noisy
  // because schema.org rendering happens server-side every request.
  return {
    "@type": "Organization",
    name: trimmed || "Unknown",
  };
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
  trailerKey?: string | null;        // v6.7.3 — YouTube video ID for the official trailer
}

export interface VideoReviewInput {
  videoId: string;       // YouTube video ID
  title?: string | null; // YouTube video title
  channel?: string | null; // YouTube channel name (becomes VideoObject.publisher.name)
  thumbnail?: string | null; // YouTube thumbnail URL (falls back to ytimg.com pattern)
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

  // v6.7.3 Tier-2 #7 — embed trailer as VideoObject. Schema Pilot 2026
  // measured ~50% lift in rich-result eligibility for pages carrying
  // VideoObject schema. Uses release_date as uploadDate (best
  // approximation we have; trailers are uploaded near theatrical release)
  // when it's a clean YYYY-MM-DD — that's what Google needs to consider
  // the entry for the video carousel.
  if (input.trailerKey && typeof input.trailerKey === "string" && input.trailerKey.trim()) {
    const ytId = input.trailerKey.trim();
    const trailer: Record<string, unknown> = {
      "@type": "VideoObject",
      name: input.year
        ? `${input.title} (${input.year}) — Official Trailer`
        : `${input.title} — Official Trailer`,
      description: `Official trailer for ${input.title}.`,
      thumbnailUrl: [
        `https://i.ytimg.com/vi/${ytId}/maxresdefault.jpg`,
        `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
      ],
      embedUrl: `https://www.youtube.com/embed/${ytId}`,
      contentUrl: `https://www.youtube.com/watch?v=${ytId}`,
    };
    if (input.releaseDate && /^\d{4}-\d{2}-\d{2}$/.test(input.releaseDate)) {
      trailer.uploadDate = input.releaseDate;
    }
    out.trailer = trailer;
  }

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
          typeof s.name === "string" &&
          s.name.trim() &&
          typeof s.score === "number" &&
          typeof s.max === "number" &&
          s.max > 0,
      )
      .map((s) => {
        const review: Record<string, unknown> = {
          "@type": "Review",
          // The source's variant label ("RT Critics" vs "RT Audience" share
          // the same publisher Organization; `name` carries the distinction).
          name: s.name.trim(),
          author: publisherForSource(s.name),
          reviewRating: {
            "@type": "Rating",
            ratingValue: s.score,
            bestRating: s.max,
            worstRating: 0,
          },
        };
        // Deep link to the source's own page for this film — lets crawlers
        // verify the rating at the publisher's site, signaling provenance.
        if (s.url && typeof s.url === "string") {
          review.url = s.url;
        }
        return review;
      });
  }

  return out;
}

/**
 * v6.7.3 Tier-2 #8 — generate templated FAQ Q&A pairs from cached film data.
 *
 * The same Q&A list is consumed by both `faqPageSchema()` (for JSON-LD) and
 * a visible "Quick Answers" block rendered above the FilmGlance UI on
 * `/?q=` pages. Google requires FAQPage schema content to mirror visible
 * page content; emitting in both places satisfies the rule and keeps the
 * Q&A authoritative single-source.
 *
 * Returns only the questions whose answers can be confidently derived from
 * the data we have — skips questions that would have to be invented.
 */
export interface FaqFilmInput {
  title: string;
  year: number | null;
  director: string | null;
  releaseDate: string | null;
  description: string | null;
  fgScore: number | null;
  sources: MovieSchemaSource[] | null;
}

export function faqForFilm(film: FaqFilmInput): FaqQA[] {
  const titleWithYear = film.year ? `${film.title} (${film.year})` : film.title;
  const qas: FaqQA[] = [];

  // Q1 — the headline score, with source count + top-3 publishers named
  if (typeof film.fgScore === "number" && film.fgScore >= 0 && Array.isArray(film.sources) && film.sources.length > 0) {
    const publishers = Array.from(
      new Set(
        film.sources
          .map((s) => SOURCE_PUBLISHER[s.name?.trim() ?? ""]?.name ?? null)
          .filter((p): p is string => !!p),
      ),
    );
    const topPublishers = publishers.slice(0, 3).join(", ");
    qas.push({
      question: `What is the Film Glance Score for ${titleWithYear}?`,
      answer: `The Film Glance Score for ${titleWithYear} is ${film.fgScore.toFixed(1)}/10, aggregated from ${film.sources.length} verified critic and audience sources${topPublishers ? ` including ${topPublishers}` : ""}.`,
    });
  }

  // Q2 — the highest-rated source, normalized to a 0-10 comparison
  if (Array.isArray(film.sources) && film.sources.length > 0) {
    let best: { name: string; score: number; max: number; ratio: number } | null = null;
    for (const s of film.sources) {
      if (typeof s.score !== "number" || typeof s.max !== "number" || s.max <= 0) continue;
      const ratio = s.score / s.max;
      if (!best || ratio > best.ratio) {
        best = { name: s.name?.trim() ?? "", score: s.score, max: s.max, ratio };
      }
    }
    if (best && best.name) {
      qas.push({
        question: `Which source rated ${titleWithYear} highest?`,
        answer: `${best.name} rated ${titleWithYear} highest at ${best.score}/${best.max} — equivalent to ${(best.ratio * 10).toFixed(1)}/10 on the Film Glance scale.`,
      });
    }
  }

  // Q3 — the "is it worth watching" verdict, derived from the score
  if (typeof film.fgScore === "number" && film.fgScore >= 0) {
    let verdict: string;
    if (film.fgScore >= 8) {
      verdict = `Yes — ${titleWithYear} earns ${film.fgScore.toFixed(1)}/10 on Film Glance, placing it among the highest-rated films across the nine review platforms we aggregate.`;
    } else if (film.fgScore >= 7) {
      verdict = `${titleWithYear} earns ${film.fgScore.toFixed(1)}/10 on Film Glance, indicating broadly positive reception from both critics and audiences.`;
    } else if (film.fgScore >= 5) {
      verdict = `${titleWithYear} earns ${film.fgScore.toFixed(1)}/10 on Film Glance — a mixed reception across the platforms we aggregate. Worth watching if the subject matter appeals to you.`;
    } else {
      verdict = `${titleWithYear} earns ${film.fgScore.toFixed(1)}/10 on Film Glance, reflecting predominantly negative reception across critics and audiences.`;
    }
    qas.push({ question: `Is ${titleWithYear} worth watching?`, answer: verdict });
  }

  // Q4 — director, only when present
  if (film.director && film.director.trim()) {
    qas.push({
      question: `Who directed ${titleWithYear}?`,
      answer: `${titleWithYear} was directed by ${film.director.trim()}.`,
    });
  }

  // Q5 — release date, prefer full date when we have it
  if (film.releaseDate && /^\d{4}-\d{2}-\d{2}$/.test(film.releaseDate)) {
    const d = new Date(film.releaseDate + "T00:00:00Z");
    const formatted = d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
    qas.push({
      question: `When was ${film.title} released?`,
      answer: `${film.title} was released on ${formatted}.`,
    });
  } else if (film.year) {
    qas.push({
      question: `When was ${film.title} released?`,
      answer: `${film.title} was released in ${film.year}.`,
    });
  }

  return qas;
}

/**
 * v6.7.3 Tier-2 #7 — VideoObject schema for a single video review.
 *
 * Returned as a top-level JSON-LD entity so each review qualifies for
 * Bing/Google video carousel rich results independently. The `about`
 * property links the video back to the Movie's `@id` so crawlers
 * understand the video is a review of that specific film.
 *
 * uploadDate is intentionally omitted — YouTube reviews don't carry a
 * publish date in our cache, and guessing would feed crawlers a wrong
 * signal. The validator will warn but the schema is still indexed.
 */
export function videoReviewSchema(
  video: VideoReviewInput,
  about: { id: string; name: string },
): Record<string, unknown> {
  const ytId = video.videoId.trim();
  const out: Record<string, unknown> = {
    "@type": "VideoObject",
    "@id": `https://www.youtube.com/watch?v=${ytId}#review`,
    name: (video.title ?? "").trim() || `Video review of ${about.name}`,
    description: video.channel
      ? `Video review of ${about.name} by ${video.channel}.`
      : `Video review of ${about.name}.`,
    thumbnailUrl: video.thumbnail
      ? [video.thumbnail]
      : [
          `https://i.ytimg.com/vi/${ytId}/maxresdefault.jpg`,
          `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
        ],
    embedUrl: `https://www.youtube.com/embed/${ytId}`,
    contentUrl: `https://www.youtube.com/watch?v=${ytId}`,
    about: { "@id": about.id, "@type": "Movie", name: about.name },
  };
  if (video.channel) {
    out.publisher = { "@type": "Organization", name: video.channel };
    // YouTube channel as content creator — Schema.org allows multiple roles.
    out.creator = { "@type": "Organization", name: video.channel };
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
