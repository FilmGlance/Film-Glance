import type { Metadata } from "next";
import PreviewLanding from "@/components/preview-landing";

export const metadata: Metadata = {
  title: "Film Glance — Every Film. One Rating at a Glance.",
  description:
    "Every major rating, normalized into one honest score. A platform-neutral view of every film — no algorithms, no editorializing, no affiliate tricks.",
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
  openGraph: {
    title: "Film Glance — Every Film. One Rating at a Glance.",
    description:
      "Every major rating, normalized into one honest score. A platform-neutral view of every film.",
    type: "website",
    siteName: "Film Glance",
  },
  twitter: {
    card: "summary_large_image",
    title: "Film Glance — Every Film. One Rating at a Glance.",
    description: "Every major rating. One honest score. In under a second.",
  },
};

export default function PreviewLandingPage() {
  return <PreviewLanding />;
}
