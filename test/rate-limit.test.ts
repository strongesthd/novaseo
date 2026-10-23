import { afterEach, describe, expect, it, vi } from 'vitest';
import { rateLimitLogin } from '../src/middleware/rate-limit.js';

afterEach(() => vi.useRealTimers());

describe('login rate limiting', () => {
  it('limits repeated attempts by IP and normalized email', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-13T00:00:00Z'));
    const ip = `192.0.2.${Math.floor(Math.random() * 200) + 1}`;
    const email = `login-${Math.random()}@example.test`;
    const req: any = { ip, socket: {}, body: { email: email.toUpperCase() } };
    const next = vi.fn();
    for (let attempt = 0; attempt < 10; attempt += 1) await rateLimitLogin(req, {} as any, next);
    expect(next).toHaveBeenCalledTimes(10);
    await rateLimitLogin(req, {} as any, next);
    expect(next).toHaveBeenCalledTimes(11);
    expect(next.mock.calls[10][0]).toMatchObject({ statusCode: 429, retryAfter: 900 });
  });

  it('opens the bucket again after its fixed window expires', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-13T00:00:00Z'));
    const req: any = { ip: `198.51.100.${Math.floor(Math.random() * 200) + 1}`, socket: {}, body: { email: `reset-${Math.random()}@example.test` } };
    const next = vi.fn();
    for (let attempt = 0; attempt < 11; attempt += 1) await rateLimitLogin(req, {} as any, next);
    vi.advanceTimersByTime(15 * 60_000 + 1);
    await rateLimitLogin(req, {} as any, next);
    expect(next.mock.calls.at(-1)?.[0]).toBeUndefined();
  });
});
