// app/sitemap.ts
//
// Next.js Metadata Files API — Vercel auto-routes the export to /sitemap.xml.
//
// v6.7.2 dynamic enumeration — emits every quality-gated cached film as
// `https://www.filmglance.com/?q=<encoded-title>` so search/AI crawlers
// have a complete map of what's indexable. The `?q=` URL is the canonical
// per-film surface served by app/page.tsx (Move A, v6.7.1). Quality gate
// matches discover_movies / idx_movie_cache_discover_v2:
//   - fg_score IS NOT NULL  (calculable Film Glance Score)
//   - source_count >= 5     (5+ verified rating sources)
//   - release_year BETWEEN 1888 AND 2100
//
// Per-row lastmod uses the row's actual cached_at — NOT `new Date()`. Auto-
// stamping every URL with today's timestamp causes Google to discount the
// sitemap's date hints entirely (Google Crawling docs, May 2026).
//
// Pagination: Supabase PostgREST caps responses at db-max-rows (default 1000).
// We loop with .range(start, start + PAGE_SIZE - 1) until the page returns
// fewer rows than PAGE_SIZE. With ~25k cached rows + revalidate=3600 the
// 25 round-trips run once per hour, fully edge-cached between regenerations.
//
// The forum (`discuss.filmglance.com`) maintains its own sitemap via NodeBB.
// `app/robots.ts` references both sitemaps so crawlers find both surfaces.

import type { MetadataRoute } from "next";
import { supabaseAdmin } from "@/lib/supabase-server";

const SITE = "https://www.filmglance.com";

// Sitemap protocol limits us to 50,000 URLs per file. We cap at 45,000 to
// leave headroom for the static + future-page URLs without ever splitting
// into a sitemap index. At current growth (+90 films/day) we have ~7 months
// before we need to revisit.
const MOVIE_URL_CAP = 45000;
const PAGE_SIZE = 1000;

// Rebuild every hour. Crawler hits between regenerations hit the edge cache.
export const revalidate = 3600;

interface SitemapMovieRow {
  title: string | null;
  cached_at: string | null;
}

async function fetchQualityFilms(): Promise<SitemapMovieRow[]> {
  // Service-role client — `movie_cache` has RLS that blocks anon SELECT
  // (the discover_* RPCs bypass it via SECURITY DEFINER, but that doesn't
  // help us here since we need a plain projection, not the RPC's row shape).
  // Sitemap runs server-only so the service-role key never crosses to the
  // client.
  const rows: SitemapMovieRow[] = [];
  let start = 0;
  while (rows.length < MOVIE_URL_CAP) {
    const end = Math.min(start + PAGE_SIZE - 1, MOVIE_URL_CAP - 1);
    // Use the JSON-path projection so we don't drag the full `data` JSONB
    // (~5KB per row) over the wire — title is all the sitemap needs.
    const { data, error } = await supabaseAdmin
      .from("movie_cache")
      .select("title:data->>title, cached_at")
      .not("fg_score", "is", null)
      .gte("source_count", 5)
      .gte("release_year", 1888)
      .lte("release_year", 2100)
      .order("cached_at", { ascending: false })
      .range(start, end);
    if (error) {
      console.error(`[sitemap] page start=${start} error:`, error.message);
      break;
    }
    const batch = (data ?? []) as SitemapMovieRow[];
    if (batch.length === 0) break;
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    start += PAGE_SIZE;
  }
  return rows;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticUrls: MetadataRoute.Sitemap = [
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
  ];

  let movieUrls: MetadataRoute.Sitemap = [];
  try {
    const films = await fetchQualityFilms();
    // Dedup by URL — `movie_cache` upserts one row per `search_key` variant
    // (e.g. "the shawshank redemption" + "shawshank redemption"), so the
    // same title appears in multiple rows. Keep the first occurrence
    // (highest cached_at since we ORDER BY cached_at DESC).
    const seen = new Set<string>();
    for (const row of films) {
      const title = row.title?.trim();
      if (!title) continue;
      const url = `${SITE}/?q=${encodeURIComponent(title)}`;
      if (seen.has(url)) continue;
      seen.add(url);
      movieUrls.push({
        url,
        lastModified: row.cached_at ? new Date(row.cached_at) : now,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      });
    }
    console.log(`[sitemap] static=${staticUrls.length} movies=${movieUrls.length} (from ${films.length} rows)`);
  } catch (err) {
    // On any failure, ship the static URLs alone — better a small sitemap
    // than a broken one. The error gets logged for visibility.
    console.error("[sitemap] film enumeration failed:", err);
  }

  return [...staticUrls, ...movieUrls];
}
