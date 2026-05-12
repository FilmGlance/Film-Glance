// app/page.tsx
//
// Homepage — the single route that serves both the empty landing state AND
// every per-film search result via the `?q=<title>` query param.
//
// v6.7.0 Move A — GEO without per-movie URLs. Converted from a one-line
// client wrapper to a server component that, when the URL carries `?q=`,
// fetches the cached film server-side and emits:
//   • dynamic page metadata (title, description, OG, Twitter, canonical)
//   • inline Movie + AggregateRating + Review[] JSON-LD
// Crawlers + LLMs see the structured signal in raw HTML; humans get the
// same `<FilmGlance />` client experience as before.
//
// No new routes introduced — `/?q=the-matrix` IS the canonical per-movie
// surface. The trade vs `app/movie/[id]/[slug]/page.tsx`: one route file
// instead of N, but each `?q=` URL still cached at the Vercel + Cloudflare
// edge by full URL (query-string included) so repeated crawler hits don't
// re-execute the function.
//
// Cache-Control posture is set via `vercel.json` for `/` (10 min s-maxage +
// SWR). `revalidate` here is best-effort — dynamic rendering may bypass it
// once `searchParams` is read.

import type { Metadata } from "next";
import FilmGlance from "@/components/film-glance";
import { supabaseAnon } from "@/lib/supabase-anon";
import { sanitizeQuery } from "@/lib/sanitize";
import { movieSchema, serializeJsonLd } from "@/lib/structured-data";

// Reading `searchParams` makes this route dynamic by definition; declaring
// it explicitly stops Next 16 from attempting a static prerender pass that
// re-trips the same workStore invariant we worked around in v6.0.0 (see
// `app/not-found.tsx` / `app/global-error.tsx` headers). Caching is set
// by vercel.json's `headers` block — Vercel edge caches per full URL,
// query string included, for 10 min.
export const dynamic = "force-dynamic";

const SITE_URL = "https://www.filmglance.com";

interface CachedMovieData {
  title?: string;
  year?: number | string | null;
  director?: string | null;
  genre?: string | null;
  description?: string | null;
  release_date?: string | null;
  runtime?: string | number | null;
  poster_path?: string | null;
  cast?: Array<{ name?: string }> | null;
  sources?: Array<{ type?: string; score?: number; max?: number; url?: string }> | null;
  score?: { ten?: number | string | null } | null;
}

interface CachedMovie {
  data: CachedMovieData;
}

// Server-side cache lookup. Returns null when:
//   • no q provided
//   • q sanitizes to empty / overly long
//   • cache miss (the film hasn't been searched yet)
//   • supabase transient error (logged, fail-soft)
//
// Uses supabaseAnon (RLS-respecting anon client) — movie_cache is
// public-read for the discover RPCs already; same policy applies here.
async function fetchCachedFilm(q: string | undefined): Promise<CachedMovieData | null> {
  if (!q || typeof q !== "string") return null;
  const key = sanitizeQuery(q);
  if (!key) return null;
  try {
    const supa = supabaseAnon();
    const { data, error } = await supa
      .from("movie_cache")
      .select("data")
      .eq("search_key", key)
      .maybeSingle<CachedMovie>();
    if (error) {
      console.error("[home-ssr] cache lookup error:", error);
      return null;
    }
    return data?.data ?? null;
  } catch (err) {
    console.error("[home-ssr] cache lookup threw:", err);
    return null;
  }
}

function coerceYear(y: number | string | null | undefined): number | null {
  if (typeof y === "number" && Number.isFinite(y)) return y;
  if (typeof y === "string" && /^\d{4}$/.test(y.trim())) return parseInt(y.trim(), 10);
  return null;
}

function coerceFgScore(score: CachedMovieData["score"]): number | null {
  if (!score) return null;
  const ten = score.ten;
  if (typeof ten === "number" && Number.isFinite(ten)) return ten;
  if (typeof ten === "string") {
    const n = parseFloat(ten);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

// Build the canonical `?q=` URL for a given title. We use the raw title so
// the URL is readable in search results / share links; URL-encoding is
// scoped to the parameter value only.
function canonicalQUrl(title: string): string {
  return `${SITE_URL}/?q=${encodeURIComponent(title)}`;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}): Promise<Metadata> {
  const params = await searchParams;
  const rawQ = Array.isArray(params.q) ? params.q[0] : params.q;
  const film = await fetchCachedFilm(rawQ);
  if (!film?.title) {
    // No q / cache miss → inherit the default site-wide metadata from layout.tsx
    return {};
  }
  const year = coerceYear(film.year);
  const titleWithYear = year ? `${film.title} (${year})` : film.title;
  const canonical = canonicalQUrl(film.title);
  const description = film.description
    ? `${film.description.slice(0, 200)}${film.description.length > 200 ? "…" : ""}`
    : `Film Glance Score, sources, cast, and trailer for ${titleWithYear}. Verified ratings from Rotten Tomatoes, IMDb, Metacritic, Letterboxd, and five more sources.`;
  const ogImage = film.poster_path
    ? `https://image.tmdb.org/t/p/w500${film.poster_path}`
    : undefined;
  return {
    title: `${titleWithYear} — Film Glance`,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${titleWithYear} — Film Glance`,
      description,
      url: canonical,
      siteName: "Film Glance",
      type: "video.movie",
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: `${titleWithYear} — Film Glance`,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawQ = Array.isArray(params.q) ? params.q[0] : params.q;
  const film = await fetchCachedFilm(rawQ);

  // Per-film JSON-LD when we have a cached row to describe. The Movie
  // schema embeds an AggregateRating (the Film Glance Score) and a Review[]
  // — one Review per verified source, preserving each source's native
  // ratingValue + bestRating so a 0-100 RT score reads differently from a
  // 0-10 IMDb score. This is exactly the citation-rich shape ChatGPT
  // Search / Perplexity / Bing extract.
  let perFilmJsonLd: string | null = null;
  if (film?.title) {
    const schema = movieSchema({
      url: canonicalQUrl(film.title),
      title: film.title,
      year: coerceYear(film.year),
      releaseDate: film.release_date || null,
      director: film.director || null,
      cast: film.cast || null,
      genre: film.genre || null,
      description: film.description || null,
      posterPath: film.poster_path || null,
      runtime: film.runtime ?? null,
      fgScore: coerceFgScore(film.score),
      sources:
        Array.isArray(film.sources)
          ? film.sources
              .filter((s) => s && typeof s.type === "string")
              .map((s) => ({
                type: String(s.type),
                score: typeof s.score === "number" ? s.score : 0,
                max: typeof s.max === "number" ? s.max : 10,
                url: s.url ?? null,
              }))
          : null,
    });
    perFilmJsonLd = serializeJsonLd(schema);
  }

  return (
    <>
      {perFilmJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: perFilmJsonLd }}
        />
      )}
      <FilmGlance />
    </>
  );
}
