// lib/rate-limit.ts
// In-memory token bucket rate limiter for serverless functions.
//
// How it works:
// - Each unique key (e.g., "search:userId" or "ip:1.2.3.4") gets a bucket
// - Buckets refill tokens at a steady rate up to a max capacity
// - Each request consumes one token; if empty, the request is rejected
// - Stale buckets are cleaned up periodically to prevent memory leaks
//
// Limitation: Vercel serverless functions may run across multiple instances,
// so rate limits are per-instance, not global. This still provides meaningful
// protection against single-connection abuse. For global rate limiting,
// upgrade to Vercel KV or Redis-backed storage.

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

interface RateLimitConfig {
  maxTokens: number;     // Bucket capacity (burst allowance)
  refillRate: number;    // Tokens added per second
  windowMs: number;      // Window for reset calculation
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;       // Timestamp when bucket will be full again
}

// In-memory store — persists across warm invocations of the same instance
const buckets = new Map<string, TokenBucket>();

// Cleanup stale entries every 5 minutes to prevent memory growth
const CLEANUP_INTERVAL = 5 * 60 * 1000;
const STALE_THRESHOLD = 10 * 60 * 1000; // Remove buckets idle for 10 min
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    if (now - bucket.lastRefill > STALE_THRESHOLD) {
      buckets.delete(key);
    }
  }
}

function rateLimitCheck(key: string, config: RateLimitConfig): RateLimitResult {
  cleanup();

  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket) {
    bucket = { tokens: config.maxTokens, lastRefill: now };
    buckets.set(key, bucket);
  }

  // Refill tokens based on elapsed time
  const elapsed = (now - bucket.lastRefill) / 1000; // seconds
  bucket.tokens = Math.min(config.maxTokens, bucket.tokens + elapsed * config.refillRate);
  bucket.lastRefill = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return {
      allowed: true,
      remaining: Math.floor(bucket.tokens),
      resetAt: now + ((config.maxTokens - bucket.tokens) / config.refillRate) * 1000,
    };
  }

  // Rejected — calculate when next token will be available
  const waitSeconds = (1 - bucket.tokens) / config.refillRate;
  return {
    allowed: false,
    remaining: 0,
    resetAt: now + waitSeconds * 1000,
  };
}

// ─── Pre-configured limiters ────────────────────────────────────────────────

// Search: 10 requests/minute per key (most expensive — triggers Claude API)
export const SEARCH_LIMIT: RateLimitConfig = {
  maxTokens: 10,
  refillRate: 10 / 60,  // 10 tokens per 60 seconds
  windowMs: 60_000,
};

// Enrichment + Suggest: 30 requests/minute per key (cheaper — TMDB only)
export const ENRICH_LIMIT: RateLimitConfig = {
  maxTokens: 30,
  refillRate: 30 / 60,
  windowMs: 60_000,
};

// Auth attempts: 5 per minute per IP (brute-force protection)
export const AUTH_LIMIT: RateLimitConfig = {
  maxTokens: 5,
  refillRate: 5 / 60,
  windowMs: 60_000,
};

// General API: 60 requests/minute per IP (catch-all)
export const GENERAL_LIMIT: RateLimitConfig = {
  maxTokens: 60,
  refillRate: 60 / 60,
  windowMs: 60_000,
};

// ─── Public API ─────────────────────────────────────────────────────────────

// Named export matching the search-route.ts import: rateLimit(key, config)
export function rateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  return rateLimitCheck(key, config);
}

// Helper to extract client IP from request
export function getClientIP(req: { headers: { get(name: string): string | null } }): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
