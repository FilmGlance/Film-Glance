// lib/rate-limit.ts
// Simple in-memory sliding window rate limiter.
// For production at scale, replace with Redis (Upstash) or Vercel KV.

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 60_000); // Every 60 seconds

interface RateLimitConfig {
  maxRequests: number;  // Max requests per window
  windowMs: number;     // Window duration in ms
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  // First request or window expired
  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + config.windowMs });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: now + config.windowMs,
    };
  }

  // Within window
  entry.count++;

  if (entry.count > config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

// Pre-configured limiters
export const SEARCH_LIMIT = {
  maxRequests: 30,    // 30 searches per minute (burst protection)
  windowMs: 60_000,
};

export const AUTH_LIMIT = {
  maxRequests: 5,     // 5 login attempts per minute
  windowMs: 60_000,
};

export const WEBHOOK_LIMIT = {
  maxRequests: 100,   // 100 webhook calls per minute
  windowMs: 60_000,
};
