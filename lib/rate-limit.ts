// lib/rate-limit.ts
// Distributed rate limiter (Upstash Redis token-bucket) with in-memory
// fallback for local dev / un-provisioned deployments.
//
// v6.3.0 (audit Phase C — High 8): when UPSTASH_REDIS_REST_URL +
// UPSTASH_REDIS_REST_TOKEN are present, requests share a single global
// Redis-backed bucket per key — limits are now consistent across Vercel
// instances. Without those env vars, falls back to per-instance in-memory
// (the v6.2.x behavior — no regression).
//
// Edge-runtime compatible: @upstash/redis is a fetch-based HTTP client.

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

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

// Search: 30 requests/minute per key (most expensive — triggers Claude API)
// Bumped from 10 → 30 to accommodate normal active usage / testing without
// false-tripping. Per-instance limit is still meaningful abuse protection.
export const SEARCH_LIMIT: RateLimitConfig = {
  maxTokens: 30,
  refillRate: 30 / 60,  // 30 tokens per 60 seconds
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

// ─── Upstash distributed limiter (when provisioned) ────────────────────────

const _upstashRedis = (() => {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    return new Redis({ url, token });
  } catch {
    return null;
  }
})();

// One Ratelimit instance per (capacity, refillRate) shape — cached across
// requests to avoid re-instantiation on every call.
const _upstashLimiters = new Map<string, Ratelimit>();

function upstashFor(config: RateLimitConfig): Ratelimit | null {
  if (!_upstashRedis) return null;
  const key = `${config.maxTokens}:${config.refillRate}`;
  let rl = _upstashLimiters.get(key);
  if (!rl) {
    // Token bucket: capacity = maxTokens, refill 1 per (1/refillRate) seconds.
    // We model this as `tokenBucket(capacity, "60 s", capacity)` because the
    // existing windowMs is always 60s in this codebase. If callers ever vary
    // the window, this needs a per-config Duration string.
    rl = new Ratelimit({
      redis: _upstashRedis,
      limiter: Ratelimit.tokenBucket(config.maxTokens, "60 s", config.maxTokens),
      analytics: false,
      prefix: "fg-rl",
    });
    _upstashLimiters.set(key, rl);
  }
  return rl;
}

// ─── Public API ─────────────────────────────────────────────────────────────

// Distributed when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set.
// Falls back to per-instance in-memory token bucket otherwise.
//
// Async because the Upstash path makes an HTTP call. Edge-safe.
export async function rateLimit(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
  const upstash = upstashFor(config);
  if (upstash) {
    try {
      const r = await upstash.limit(key);
      return { allowed: r.success, remaining: r.remaining, resetAt: r.reset };
    } catch (err) {
      // Upstash transient failure — fall through to in-memory so the request
      // isn't blanket-blocked by a backend outage.
      console.warn("[rate-limit] Upstash error, falling back:", err);
    }
  }
  return rateLimitCheck(key, config);
}

// Helper to extract client IP from request
export function getClientIP(req: { headers: { get(name: string): string | null } }): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

// Lightweight `retryAfter` derivation for 429 responses.
export function retryAfterSeconds(result: RateLimitResult): number {
  return Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
}
