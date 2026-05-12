// app/robots.ts
//
// Next.js Metadata Files API — Vercel auto-routes the export to /robots.txt.
//
// Allow ALL crawlers by default. Block /api/, /_next/, and /preview-landing
// (a low-priority alternate landing variant that's also marked noindex via
// metadata). Explicitly enumerate the AI/LLM crawlers so each one has a
// dedicated rule a maintainer can audit at a glance — easier to flip a
// single bot to disallow if needed than to read a wildcard config.
//
// References: OAI-SearchBot is the user-agent ChatGPT Search uses to fetch
// citation-eligible pages; allowing it is the single most important rule
// for "show up in ChatGPT" per the GEO research.

import type { MetadataRoute } from "next";

const SITE = "https://www.filmglance.com";
// NodeBB's configured canonical URL is `https://filmglance.com/discuss`
// (verified via Phase 9.1 — sitemap entries use this base), but the apex
// 307-redirects to www, and Google's sitemap fetcher does not follow that
// redirect — it reports "Couldn't fetch" on submission. Reference the no-
// redirect www URL so crawlers fetch the sitemap in one hop. The
// `discuss.filmglance.com` subdomain is a vanity alias; we keep using the
// canonical www host both for consistency with the main sitemap and to
// avoid duplicating the index of forum URLs across two hostnames.
const FORUM_SITEMAP = "https://www.filmglance.com/discuss/sitemap.xml";

const DISALLOW = ["/api/", "/_next/", "/preview-landing"];

const AI_BOTS = [
  "GPTBot",          // OpenAI training crawler
  "OAI-SearchBot",   // ChatGPT Search citation crawler
  "ChatGPT-User",    // ChatGPT in-session fetch
  "ClaudeBot",       // Anthropic crawler
  "Claude-Web",      // Anthropic legacy
  "anthropic-ai",    // Anthropic legacy alt
  "PerplexityBot",   // Perplexity crawler
  "Perplexity-User", // Perplexity in-session
  "Google-Extended", // Google Gemini training opt-in token
  "Bingbot",         // Microsoft Bing (upstream of ChatGPT Search)
  "msnbot",          // Microsoft legacy
  "YouBot",          // You.com
  "Applebot",        // Apple Spotlight + Siri
  "Applebot-Extended", // Apple AI training opt-in
  "meta-externalagent", // Meta AI
  "cohere-ai",       // Cohere
  "Bytespider",      // ByteDance / Doubao
  "DuckAssistBot",   // DuckDuckGo AI
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Wildcard rule first — applies to anything not listed below.
      {
        userAgent: "*",
        allow: "/",
        disallow: DISALLOW,
      },
      // Explicit AI bot allowlist. Same rules as the wildcard, but listed
      // by name so a future change to a single bot is one-line obvious.
      ...AI_BOTS.map((bot) => ({
        userAgent: bot,
        allow: "/",
        disallow: DISALLOW,
      })),
    ],
    sitemap: [`${SITE}/sitemap.xml`, FORUM_SITEMAP],
    host: SITE,
  };
}
