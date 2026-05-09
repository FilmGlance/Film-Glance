// app/sitemap.ts
//
// Next.js Metadata Files API — Vercel auto-routes the export to /sitemap.xml.
//
// Phase 1 round: static URLs only. Phase 5 will add the authority pages
// (/about, /methodology, /faq) once they land. The deferred per-movie work
// (sibling plan) will eventually enumerate ~30K /movie/[id]/[slug] URLs;
// this file gets extended at that time but stays small until then.
//
// The forum (`discuss.filmglance.com`) maintains its own sitemap via NodeBB.
// `app/robots.ts` references both sitemaps so crawlers find both surfaces.

import type { MetadataRoute } from "next";

const SITE = "https://www.filmglance.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      url: SITE,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${SITE}/discover`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE}/boxoffice`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE}/discuss`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 0.8,
    },
    // Authority pages — uncomment as each lands in Phase 5.
    // {
    //   url: `${SITE}/about`,
    //   lastModified: now,
    //   changeFrequency: "monthly",
    //   priority: 0.7,
    // },
    // {
    //   url: `${SITE}/methodology`,
    //   lastModified: now,
    //   changeFrequency: "monthly",
    //   priority: 0.7,
    // },
    // {
    //   url: `${SITE}/faq`,
    //   lastModified: now,
    //   changeFrequency: "monthly",
    //   priority: 0.7,
    // },
  ];
}
