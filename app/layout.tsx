// app/layout.tsx
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import PendingFavoriteHandler from "@/components/PendingFavoriteHandler";
import {
  organizationSchema,
  websiteSchema,
  serializeJsonLd,
} from "@/lib/structured-data";

export const metadata = {
  title: "Film Glance — Every Film. One Rating at a Glance.",
  description: "Search any movie and see the averaged score from every major review site including Rotten Tomatoes, IMDb, Metacritic, and Letterboxd.",
  icons: { icon: "/favicon.ico" },
  metadataBase: new URL("https://www.filmglance.com"),
  openGraph: {
    title: "Film Glance — Every Film. One Rating at a Glance.",
    description: "Search any movie and see the averaged score from every major review site.",
    url: "https://www.filmglance.com",
    siteName: "Film Glance",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Film Glance — Every Film. One Rating at a Glance.",
    description: "Search any movie and see the averaged score from every major review site.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#050505",
};

// Site-wide JSON-LD: Organization + WebSite (with SearchAction) inlined as
// one <script> via the @graph pattern. Crawlers + LLMs both consume this.
// Per-page schemas (CollectionPage, ItemList, FAQPage, etc.) are emitted
// in the route-specific files.
const SITE_JSON_LD = serializeJsonLd([organizationSchema(), websiteSchema()]);

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{ overflowX: "clip" }}>
      <body style={{ margin: 0, padding: 0, background: "#050505", overflowX: "clip", maxWidth: "100vw" }}>
        <script
          type="application/ld+json"
          // Static, server-rendered string. JSON.stringify safely escapes
          // </script and </script> that could otherwise break out of the tag.
          dangerouslySetInnerHTML={{ __html: SITE_JSON_LD }}
        />
        {children}
        <PendingFavoriteHandler />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
