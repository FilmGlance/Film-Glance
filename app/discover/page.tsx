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
  itemListSchema,
  serializeJsonLd,
  type ItemListEntry,
} from "@/lib/structured-data";

const URL_DISCOVER = "https://www.filmglance.com/discover";
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

interface DiscoverEntry {
  title: string;
  year: number | null;
  poster_path: string | null;
  fg_score: number | null;
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
  const itemListEntries: ItemListEntry[] = (initialData?.entries || []).map(
    (e, i) => ({
      position: i + 1,
      name: e.year ? `${e.title} (${e.year})` : e.title,
      url: `${URL_DISCOVER}?q=${encodeURIComponent(e.title)}`,
      image: e.poster_path
        ? `https://image.tmdb.org/t/p/w500${e.poster_path}`
        : undefined,
    }),
  );

  const schemas: Record<string, unknown>[] = [
    collectionPageSchema({
      url: URL_DISCOVER,
      name: "Discover — Top 100 Films Worth Your Evening",
      description: DESCRIPTION,
    }),
    breadcrumbSchema([
      { name: "Home", url: "https://www.filmglance.com/" },
      { name: "Discover", url: URL_DISCOVER },
    ]),
  ];
  if (itemListEntries.length > 0) {
    schemas.push(
      itemListSchema({
        name: "Top 100 Films Worth Your Evening",
        description: DESCRIPTION,
        numberOfItems: itemListEntries.length,
        items: itemListEntries,
      }),
    );
  }
  const PAGE_JSON_LD = serializeJsonLd(schemas);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: PAGE_JSON_LD }}
      />
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
