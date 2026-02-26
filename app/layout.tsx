// app/layout.tsx
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const metadata = {
  title: "Film Glance — Every Film. One Rating at a Glance.",
  description: "Search any movie and see the averaged score across 9 major review sites including Rotten Tomatoes, IMDb, Metacritic, and Letterboxd.",
  icons: { icon: "/favicon.ico" },
  metadataBase: new URL("https://www.filmglance.com"),
  openGraph: {
    title: "Film Glance — Every Film. One Rating at a Glance.",
    description: "Search any movie and see the averaged score across 9 major review sites.",
    url: "https://www.filmglance.com",
    siteName: "Film Glance",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Film Glance — Every Film. One Rating at a Glance.",
    description: "Search any movie and see the averaged score across 9 major review sites.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: "#050505" }}>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
