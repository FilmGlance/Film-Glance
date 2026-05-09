// app/discover/page.tsx
//
// Page shell for /discover. Renders the DiscoverPage client component which
// owns URL-state, data fetching, filter UI, and the roulette feature. The
// sticky header + base layout come from app/layout.tsx (shared).
//
// Server-side: full metadata (title/description/OG/Twitter/canonical) +
// CollectionPage + BreadcrumbList JSON-LD. The ItemList schema enumerating
// the actual Top 100 films is added in Phase 3 once SSR fetching lands.

import { Suspense } from "react";
import type { Metadata } from "next";
import DiscoverPage from "@/components/discover/DiscoverPage";
import {
  collectionPageSchema,
  breadcrumbSchema,
  serializeJsonLd,
} from "@/lib/structured-data";

const URL = "https://www.filmglance.com/discover";
const TITLE = "Discover — Top 100 Films Worth Your Evening | Film Glance";
const DESCRIPTION =
  "100 hand-picked films per filter, ranked by Film Glance Score — an aggregated rating drawn from Rotten Tomatoes, IMDb, Metacritic, Letterboxd, and five more verified sources. Filter by genre, decade, theater or at-home. Spin the Movie Reel Roulette for a random pick.";

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

const PAGE_JSON_LD = serializeJsonLd([
  collectionPageSchema({
    url: URL,
    name: "Discover — Top 100 Films Worth Your Evening",
    description: DESCRIPTION,
  }),
  breadcrumbSchema([
    { name: "Home", url: "https://www.filmglance.com/" },
    { name: "Discover", url: URL },
  ]),
]);

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: PAGE_JSON_LD }}
      />
      <Suspense fallback={null}>
        <DiscoverPage />
      </Suspense>
    </>
  );
}
