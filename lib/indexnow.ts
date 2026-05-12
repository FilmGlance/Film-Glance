// lib/indexnow.ts
//
// IndexNow protocol client (https://www.indexnow.org/documentation). One
// POST propagates the URL change to every participating engine — Bing,
// Yandex, Seznam, Naver — which is the fastest legitimate path to
// ChatGPT Search citation (since Bing is its upstream index).
//
// Fire-and-forget contract: never throws, never blocks the caller. Failures
// are logged at error level for visibility in Vercel logs but do not surface
// to users. Production-only: preview and dev environments skip the POST so
// we don't pollute the index with non-production traffic.

const INDEXNOW_KEY = "dc00b483c0824908992644d46df2f737";
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
const SITE_HOST = "www.filmglance.com";
const KEY_LOCATION = `https://${SITE_HOST}/${INDEXNOW_KEY}.txt`;

// Per spec, max 10,000 URLs per submission. We never approach that in
// practice (cache writes ping 1-3 URLs, the box-office cron pings 1),
// but the guard makes accidental misuse loud rather than silent.
const MAX_URLS_PER_CALL = 10000;

function isProduction(): boolean {
  // Vercel sets VERCEL_ENV=production on prod deploys. Preview deploys get
  // "preview"; local dev is undefined. Hard-skip anything that isn't prod.
  return process.env.VERCEL_ENV === "production";
}

export function movieUrl(title: string): string {
  return `https://${SITE_HOST}/?q=${encodeURIComponent(title)}`;
}

export async function notifyIndexNow(urls: string | string[]): Promise<void> {
  const list = Array.isArray(urls) ? urls : [urls];
  if (list.length === 0) return;

  if (!isProduction()) {
    console.log(`[indexnow] skipped ${list.length} URL(s) — VERCEL_ENV=${process.env.VERCEL_ENV ?? "unset"}`);
    return;
  }

  const urlList = list.length > MAX_URLS_PER_CALL ? list.slice(0, MAX_URLS_PER_CALL) : list;

  try {
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host: SITE_HOST,
        key: INDEXNOW_KEY,
        keyLocation: KEY_LOCATION,
        urlList,
      }),
      // 5s timeout — IndexNow normally responds in <500ms; anything slower
      // is a transient and not worth blocking the caller's tail latency.
      signal: AbortSignal.timeout(5000),
    });
    // Per spec: 200 OK = accepted; 202 Accepted = queued, may take time.
    // 400 = bad request, 403 = key/host mismatch, 422 = invalid URLs,
    // 429 = rate-limited. Anything 4xx/5xx is worth logging.
    if (res.status === 200 || res.status === 202) {
      console.log(`[indexnow] notified ${urlList.length} URL(s) (${res.status})`);
    } else {
      const text = await res.text().catch(() => "");
      console.error(`[indexnow] HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
  } catch (err) {
    console.error("[indexnow] fetch failed:", err instanceof Error ? err.message : err);
  }
}
