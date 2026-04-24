import { describe, it, expect, beforeEach, vi } from 'vitest';
import { rateLimit } from './rate-limit';

describe('rateLimit', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('allows requests under the limit', async () => {
    const cfg = { limit: 3, windowMs: 60_000 };
    const a = await rateLimit('user-allow-1', cfg);
    const b = await rateLimit('user-allow-1', cfg);
    const c = await rateLimit('user-allow-1', cfg);
    expect(a.success).toBe(true);
    expect(b.success).toBe(true);
    expect(c.success).toBe(true);
    expect(a.remaining).toBe(2);
    expect(b.remaining).toBe(1);
    expect(c.remaining).toBe(0);
  });

  it('blocks requests over the limit', async () => {
    const cfg = { limit: 2, windowMs: 60_000 };
    await rateLimit('user-block-1', cfg);
    await rateLimit('user-block-1', cfg);
    const blocked = await rateLimit('user-block-1', cfg);
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it('isolates buckets per key', async () => {
    const cfg = { limit: 1, windowMs: 60_000 };
    const user1 = await rateLimit('user-iso-a', cfg);
    const user2 = await rateLimit('user-iso-b', cfg);
    expect(user1.success).toBe(true);
    expect(user2.success).toBe(true);
  });

  it('resets after window expires', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-24T00:00:00Z'));

    const cfg = { limit: 1, windowMs: 1000 };
    const first = await rateLimit('user-reset', cfg);
    expect(first.success).toBe(true);

    const blocked = await rateLimit('user-reset', cfg);
    expect(blocked.success).toBe(false);

    vi.setSystemTime(new Date('2026-04-24T00:00:02Z'));
    const afterWindow = await rateLimit('user-reset', cfg);
    expect(afterWindow.success).toBe(true);
  });
});
