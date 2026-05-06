/** @type {import('next').NextConfig} */

// Content-Security-Policy (Report-Only mode — audit Phase B High 6).
// Run report-only for ~7 days, review violations in /api/csp-report logs,
// tighten allowlist, then flip the header name to `Content-Security-Policy`.
//
// `'unsafe-inline'` for script-src is required by Next.js inline runtime
// scripts (hydration data, _next/static loaders). Tightening to nonces
// requires per-request middleware on every page; deferred. Inline styles are
// pervasive across film-glance.jsx (style={{}} props) — `'unsafe-inline'` for
// style-src stays.
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://vitals.vercel-insights.com https://vercel.live",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https://image.tmdb.org https://i.ytimg.com https://*.supabase.co https://www.google.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://*.supabase.co https://api.themoviedb.org https://api.anthropic.com https://vitals.vercel-insights.com https://va.vercel-scripts.com",
  "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
  "report-uri /api/csp-report",
].join("; ");

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/t/p/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // Audit Phase B High 7 — global HSTS (was previously only on /api/*
          // via middleware). 2-year max-age + preload-eligible.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          // Audit Phase B High 6 — CSP in report-only mode for v1 rollout.
          { key: "Content-Security-Policy-Report-Only", value: CSP_REPORT_ONLY },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
