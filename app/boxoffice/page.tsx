// app/boxoffice/page.tsx
//
// Page shell for /boxoffice. Renders the BoxOfficePage client component
// which owns URL-state, data fetching, and composition. The sticky header
// + base layout come from app/layout.tsx (shared with the rest of the site).
//
// Server-side: full metadata (title/description/OG/Twitter/canonical) +
// CollectionPage + BreadcrumbList + ItemList JSON-LD (one Movie schema
// per Top-10 entry). The ItemList round-trips to /api/boxoffice which is
// already edge-cached per v6.7.0 D7 (s-maxage=600 SWR=3600), so SSR
// invocations almost always hit cache.

import { Suspense } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import BoxOfficePage from "@/components/box-office/BoxOfficePage";
import {
  collectionPageSchema,
  breadcrumbSchema,
  movieSchema,
  serializeJsonLd,
} from "@/lib/structured-data";

const SITE_URL = "https://www.filmglance.com";
const URL = `${SITE_URL}/boxoffice`;
const TITLE = "Box Office — Highest-Grossing Films | Film Glance";
const DESCRIPTION =
  "The highest-grossing films at the box office, refreshed weekly from Box Office Mojo. Filter by week, month, season, or year — historical charts back to 1977, up to 100 ranks deep.";

// v6.7.0 D7 — match /discover page's edge-cache posture. The page is a thin
// shell over the client-rendered BoxOfficePage, but Vercel's prerender cache
// still serves the SSR HTML (metadata, JSON-LD, shell markup) from edge for
// `revalidate` seconds — saves a Vercel function execution on every crawler
// + cold-cache page hit.
export const revalidate = 600;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: URL,
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: URL,
    siteName: "Film Glance",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

interface BoxOfficeEntry {
  rank: number;
  search_key: string;
  title: string;
  year: number | null;
  director: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  gross: number;
  theaters: number | null;
  pta: number | null;
  fg_score: number | null;
}

interface BoxOfficeResponse {
  period_label?: string;
  entries?: BoxOfficeEntry[];
}

// Server-fetch the default view (latest weekly, domestic, Top 10). Used only
// to seed the ItemList JSON-LD; the client BoxOfficePage re-fetches on mount
// + on filter change. The /api/boxoffice route is edge-cached so this almost
// always hits cache rather than a function execution.
async function fetchTop10(): Promise<BoxOfficeResponse | null> {
  try {
    const h = await headers();
    const host = h.get("host") ?? "www.filmglance.com";
    const proto = h.get("x-forwarded-proto") ?? "https";
    const url = `${proto}://${host}/api/boxoffice?period=weekly&region=domestic&limit=10`;
    const res = await fetch(url, {
      // Tie the SSR cache to the page's own `revalidate`; the API route's
      // edge cache handles repeated hits anyway. AbortSignal keeps an
      // upstream stall from holding the SSR render forever.
      next: { revalidate: 600 },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error(`[boxoffice-ssr] /api/boxoffice ${res.status}`);
      return null;
    }
    return (await res.json()) as BoxOfficeResponse;
  } catch (err) {
    console.error("[boxoffice-ssr] fetch failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

export default async function Page() {
  const top10 = await fetchTop10();
  const entries = top10?.entries ?? [];
  const periodLabel = top10?.period_label ?? "this week";

  // Each ListItem embeds a full Movie schema, mirroring the /discover ItemList
  // pattern. Per-item `url` points at the homepage's `?q=<title>` route — the
  // canonical per-film surface Move A (v6.7.1) introduced.
  const movieItems = entries.map((e, i) => {
    const filmUrl = `${SITE_URL}/?q=${encodeURIComponent(e.title)}`;
    return {
      "@type": "ListItem",
      position: e.rank ?? i + 1,
      url: filmUrl,
      item: movieSchema({
        url: filmUrl,
        title: e.title,
        year: e.year,
        releaseDate: null,
        director: e.director,
        genre: null,
        description: null,
        posterPath: e.poster_path,
        runtime: null,
        fgScore: e.fg_score,
        // Sources aren't in the box-office payload; the /?q=<title> route
        // emits the full Review[] tail.
        sources: null,
      }),
    } as Record<string, unknown>;
  });

  const schemas: Record<string, unknown>[] = [
    collectionPageSchema({
      url: URL,
      name: "Box Office — Highest-Grossing Films",
      description: DESCRIPTION,
    }),
    breadcrumbSchema([
      { name: "Home", url: `${SITE_URL}/` },
      { name: "Box Office", url: URL },
    ]),
  ];
  if (movieItems.length > 0) {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: `Top ${movieItems.length} Highest-Grossing Films — ${periodLabel}`,
      description: DESCRIPTION,
      numberOfItems: movieItems.length,
      itemListOrder: "https://schema.org/ItemListOrderAscending",
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
          the client UI. Gives crawlers a definitional summary of the
          page's data + sources in the initial HTML. */}
      <section
        aria-label="About Box Office"
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
          Film Glance Box Office tracks the highest-grossing films at the US box office, refreshed
          weekly from Box Office Mojo. View charts by week, month, season, or year — with historical
          data back to 1977 and up to 100 ranks deep per period. Each entry combines BOM&apos;s
          reported gross, theater count, and per-theater average with the film&apos;s aggregated
          Film Glance Score (drawn from nine critic and audience sources) when available. The data
          refreshes every Tuesday after BOM publishes the prior week&apos;s final numbers.
        </p>
      </section>
      <Suspense fallback={null}>
        <BoxOfficePage />
      </Suspense>
    </>
  );
}
