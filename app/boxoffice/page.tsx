// app/boxoffice/page.tsx
//
// Page shell for /boxoffice. Renders the BoxOfficePage client component
// which owns URL-state, data fetching, and composition. The Sticky header
// + base layout come from app/layout.tsx (shared with the rest of the site).
//
// Server-side: full metadata (title/description/OG/Twitter/canonical) +
// CollectionPage + BreadcrumbList JSON-LD. The ItemList schema enumerating
// the actual Top 10 films is added in Phase 3 once SSR fetching lands.

import { Suspense } from "react";
import type { Metadata } from "next";
import BoxOfficePage from "@/components/box-office/BoxOfficePage";
import {
  collectionPageSchema,
  breadcrumbSchema,
  serializeJsonLd,
} from "@/lib/structured-data";

const URL = "https://www.filmglance.com/boxoffice";
const TITLE = "Box Office — Highest-Grossing Films | Film Glance";
const DESCRIPTION =
  "The highest-grossing films at the box office, refreshed weekly from Box Office Mojo. Filter by week, month, season, or year — historical charts back to 1977, up to 100 ranks deep.";

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
    name: "Box Office — Highest-Grossing Films",
    description: DESCRIPTION,
  }),
  breadcrumbSchema([
    { name: "Home", url: "https://www.filmglance.com/" },
    { name: "Box Office", url: URL },
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
        <BoxOfficePage />
      </Suspense>
    </>
  );
}
