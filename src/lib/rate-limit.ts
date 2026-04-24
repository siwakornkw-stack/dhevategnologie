interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up stale entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt < now) store.delete(key);
    }
  }, 5 * 60 * 1000);
}

export interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

export function rateLimit(key: string, config: RateLimitConfig): { success: boolean; remaining: number; resetAt: number } {
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

// Preset configs
export const BOOKING_RATE_LIMIT: RateLimitConfig = { limit: 10, windowMs: 60 * 1000 };    // 10/min
export const AUTH_RATE_LIMIT: RateLimitConfig = { limit: 5, windowMs: 15 * 60 * 1000 };   // 5/15min
export const UPLOAD_RATE_LIMIT: RateLimitConfig = { limit: 20, windowMs: 60 * 1000 };     // 20/min
export const REVIEW_RATE_LIMIT: RateLimitConfig = { limit: 5, windowMs: 60 * 1000 };      // 5/min
export const WAITING_LIST_RATE_LIMIT: RateLimitConfig = { limit: 10, windowMs: 60 * 1000 }; // 10/min
