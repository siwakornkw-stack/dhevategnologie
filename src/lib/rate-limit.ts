import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

interface RateLimitEntry { count: number; resetAt: number; }

const store = new Map<string, RateLimitEntry>();
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt < now) store.delete(key);
    }
  }, 5 * 60 * 1000);
}

export interface RateLimitConfig { limit: number; windowMs: number; }

let redis: Redis | null | undefined = undefined;
const upstashLimiters = new Map<string, Ratelimit>();

function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = null;
    return null;
  }
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  return redis;
}

function msToUnit(ms: number): string {
  if (ms % 3_600_000 === 0) return `${ms / 3_600_000} h`;
  if (ms % 60_000 === 0) return `${ms / 60_000} m`;
  return `${Math.ceil(ms / 1000)} s`;
}

function getLimiter(r: Redis, limit: number, windowMs: number): Ratelimit {
  const cacheKey = `${limit}:${windowMs}`;
  if (!upstashLimiters.has(cacheKey)) {
    upstashLimiters.set(cacheKey, new Ratelimit({
      redis: r,
      limiter: Ratelimit.slidingWindow(limit, msToUnit(windowMs) as Parameters<typeof Ratelimit.slidingWindow>[1]),
    }));
  }
  return upstashLimiters.get(cacheKey)!;
}

function inMemory(key: string, config: RateLimitConfig): { success: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || entry.resetAt < now) {
    const resetAt = now + config.windowMs;
    store.set(key, { count: 1, resetAt });
    return { success: true, remaining: config.limit - 1, resetAt };
  }
  if (entry.count >= config.limit) {
    return { success: false, remaining: 0, resetAt: entry.resetAt };
  }
  entry.count++;
  return { success: true, remaining: config.limit - entry.count, resetAt: entry.resetAt };
}

export async function rateLimit(
  key: string,
  config: RateLimitConfig,
): Promise<{ success: boolean; remaining: number; resetAt: number }> {
  const r = getRedis();
  if (r) {
    try {
      const limiter = getLimiter(r, config.limit, config.windowMs);
      const { success, remaining, reset } = await limiter.limit(key);
      return { success, remaining, resetAt: Number(reset) };
    } catch {
      // fall through to in-memory on Redis error
    }
  }
  return inMemory(key, config);
}

export const BOOKING_RATE_LIMIT: RateLimitConfig = { limit: 10, windowMs: 60 * 1000 };
export const AUTH_RATE_LIMIT: RateLimitConfig = { limit: 5, windowMs: 15 * 60 * 1000 };
export const UPLOAD_RATE_LIMIT: RateLimitConfig = { limit: 20, windowMs: 60 * 1000 };
export const REVIEW_RATE_LIMIT: RateLimitConfig = { limit: 5, windowMs: 60 * 1000 };
export const WAITING_LIST_RATE_LIMIT: RateLimitConfig = { limit: 10, windowMs: 60 * 1000 };
