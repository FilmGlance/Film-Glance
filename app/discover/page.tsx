// app/discover/page.tsx
//
// Server component shell for /discover.
//
// v6.7.0 GEO Phase 3: server-side fetches the Top-100 list via the same
// three RPCs `/api/discover` calls (discover_movies, discover_genres,
// discover_years), passes the result to <DiscoverPage> as `initialData`,
// and emits ItemList JSON-LD enumerating every film. Crawlers + LLMs see
// the entire list in the initial HTML — no JS execution required, fixes
// the "OAI-SearchBot sees empty divs" gap from the GEO research.
//
// Filter changes still re-fetch client-side via /api/discover (DiscoverPage
// behavior unchanged). The server fetch only seeds the FIRST paint.

import { Suspense } from "react";
import type { Metadata } from "next";
import DiscoverPage from "@/components/discover/DiscoverPage";
import { supabaseAnon } from "@/lib/supabase-anon";
import {
  collectionPageSchema,
  breadcrumbSchema,
  movieSchema,
  serializeJsonLd,
} from "@/lib/structured-data";

const SITE_URL = "https://www.filmglance.com";
const URL_DISCOVER = `${SITE_URL}/discover`;
const TITLE = "Discover — Top 100 Films Worth Your Evening | Film Glance";
const DESCRIPTION =
  "100 hand-picked films per filter, ranked by Film Glance Score — an aggregated rating drawn from Rotten Tomatoes, IMDb, Metacritic, Letterboxd, and five more verified sources. Filter by genre, decade, theater or at-home. Spin the Movie Reel Roulette for a random pick.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL_DISCOVER },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: URL_DISCOVER,
    siteName: "Film Glance",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

// Render every request — filters change frequently and the data is dynamic.
// Vercel's edge cache + the API route's existing s-maxage=600 SWR keeps
// loopback latency tolerable.
export const revalidate = 600;

// Widened in v6.7.0 Move A — the discover_movies RPC already returns all
// these fields (see migration 020); previously we only consumed a 4-field
// subset for the JSON-LD shell. Now we feed the full row into movieSchema()
// so each ItemList entry embeds a Movie + AggregateRating block.
interface DiscoverEntry {
  title: string;
  year: number | null;
  poster_path: string | null;
  fg_score: number | null;
  director?: string | null;
  genre?: string | null;
  release_date?: string | null;
  runtime?: string | null;
  overview?: string | null;
  source_count?: number | null;
}

async function fetchInitialDiscover(): Promise<{
  release_window: string;
  genre: string | null;
  year: number | null;
  hidden_gems: boolean;
  count: number;
  available_genres: string[];
  available_years: number[];
  entries: DiscoverEntry[];
} | null> {
  // Default view (no filters) matches the URL the user lands on with no
  // query string. Filter combinations still re-fetch client-side.
  try {
    const supa = supabaseAnon();
    const [entriesRes, genresRes, yearsRes] = await Promise.all([
      supa.rpc("discover_movies", {
        p_release_window: "at_home",
        p_genre: null,
        p_year: null,
        p_hidden_gems: false,
        p_limit: 100,
      }),
      supa.rpc("discover_genres"),
      supa.rpc("discover_years", {
        p_release_window: "at_home",
        p_genre: null,
      }),
    ]);
    if (entriesRes.error) {
      console.error("[discover-ssr] entries error:", entriesRes.error);
      return null;
    }
    return {
      release_window: "at_home",
      genre: null,
      year: null,
      hidden_gems: false,
      count: (entriesRes.data || []).length,
      available_genres: (genresRes.data as string[]) || [],
      available_years: (yearsRes.data as number[]) || [],
      entries: (entriesRes.data as DiscoverEntry[]) || [],
    };
  } catch (err) {
    console.error("[discover-ssr] fetch failed:", err);
    return null;
  }
}

export default async function Page() {
  const initialData = await fetchInitialDiscover();

  // Build the structured-data blocks. Falls back to just CollectionPage +
  // BreadcrumbList when SSR fetch fails (rare; client retries on mount).
  //
  // v6.7.0 Move A — two upgrades over the prior pattern:
  //   1. The per-item `url` points at `${SITE_URL}/?q=<title>` (the homepage
  //      search route that actually serves the film), not the broken
  //      `${URL_DISCOVER}?q=<title>` (a dead-end — /discover ignores ?q).
  //   2. Each ListItem now embeds a full Movie + AggregateRating via
  //      movieSchema() under `item`, replacing the bare {name, url, image}.
  //      Crawlers see each entry as a citable film, not a thin link.
  const movieItems = (initialData?.entries || []).map((e, i) => {
    const filmUrl = `${SITE_URL}/?q=${encodeURIComponent(e.title)}`;
    return {
      "@type": "ListItem",
      position: i + 1,
      url: filmUrl,
      item: movieSchema({
        url: filmUrl,
        title: e.title,
        year: e.year,
        releaseDate: e.release_date ?? null,
        director: e.director ?? null,
        genre: e.genre ?? null,
        description: e.overview ?? null,
        posterPath: e.poster_path,
        runtime: e.runtime ?? null,
        fgScore: e.fg_score,
        // sources aren't pulled by discover_movies RPC; the per-film
        // /?q=<title> route emits the full Review[] tail.
        sources: null,
      }),
    } as Record<string, unknown>;
  });

  const schemas: Record<string, unknown>[] = [
    collectionPageSchema({
      url: URL_DISCOVER,
      name: "Discover — Top 100 Films Worth Your Evening",
      description: DESCRIPTION,
    }),
    breadcrumbSchema([
      { name: "Home", url: `${SITE_URL}/` },
      { name: "Discover", url: URL_DISCOVER },
    ]),
  ];
  if (movieItems.length > 0) {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Top 100 Films Worth Your Evening",
      description: DESCRIPTION,
      numberOfItems: movieItems.length,
      itemListOrder: "https://schema.org/ItemListOrderDescending",
      itemListElement: movieItems,
    });
  }
  const PAGE_JSON_LD = serializeJsonLd(schemas);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: PAGE_JSON_LD }}
      />
      {/* v6.7.3 Tier-2 #10 — answer-first prose, server-rendered above
          the client UI. CMU GEO paper (arxiv 2311.09735) measured ~40%
          citation lift from definitional-opener prose with explicit-source
          citations. Crawlers see this content in the initial HTML; users
          see it briefly before the dynamic UI loads in. */}
      <section
        aria-label="About Discover"
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "20px 24px 0",
          color: "rgba(255,255,255,0.78)",
          fontFamily: "'Syne',sans-serif",
          fontSize: 14,
          lineHeight: 1.6,
        }}
      >
        <p style={{ margin: 0 }}>
          Discover ranks the top 100 films by Film Glance Score — an aggregated rating drawn from
          nine verified critic and audience sources including Rotten Tomatoes, IMDb, Metacritic,
          Letterboxd, and TMDB. Browse by genre, decade, or release window (In Theaters / At Home),
          or spin the Movie Reel Roulette for a random pick rated 8.0+. Every entry passes a
          quality gate: a calculable Film Glance Score and at least five verified rating sources.
          The list refreshes every 10 minutes from a cache of 25,000+ films.
        </p>
      </section>
      {/* DiscoverPage uses useSearchParams() which Next.js requires to
          live inside a Suspense boundary for static generation to work.
          Wrapping here is identical to the pre-Phase-3 page.tsx pattern.
          initialData prop is wired in the next commit when DiscoverPage
          .jsx accepts it; until then the ItemList JSON-LD above carries
          the structured signal for crawlers. */}
      <Suspense fallback={null}>
        <DiscoverPage {...({ initialData } as Record<string, unknown>)} />
      </Suspense>
    </>
  );
}
