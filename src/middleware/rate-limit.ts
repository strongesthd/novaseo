import { Request, Response, NextFunction } from 'express';
import { createHash } from 'node:crypto';
import IORedis from 'ioredis';

type Bucket = { count: number; resetAt: number };
type RedisClient = { eval(script: string, keyCount: number, ...args: Array<string | number>): Promise<unknown> };
type RedisConstructor = {
  new (url: string, options: Record<string, unknown>): RedisClient;
  new (port: number, host: string, options: Record<string, unknown>): RedisClient;
};
const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 50_000;
const WINDOW_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
if count > tonumber(ARGV[2]) then return math.ceil(ttl / 1000) end
return 0
`;
let redis: RedisClient | undefined;
const RedisClientConstructor = IORedis as unknown as RedisConstructor;

function consume(key: string, points: number, limit: number, windowMs = 60_000): number | undefined {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= MAX_BUCKETS) {
      for (const [candidate, value] of buckets) {
        if (value.resetAt <= now) buckets.delete(candidate);
      }
      while (buckets.size >= MAX_BUCKETS) buckets.delete(buckets.keys().next().value!);
    }
    buckets.set(key, { count: points, resetAt: now + windowMs });
    return undefined;
  }
  if (bucket.count + points > limit) return Math.ceil((bucket.resetAt - now) / 1000);
  bucket.count += points;
  return undefined;
}

async function checkLimit(key: string, limit: number, windowMs: number): Promise<number | undefined> {
  if (process.env.NODE_ENV === 'production') {
    try {
      const options = {
        maxRetriesPerRequest: 1,
        connectTimeout: 1_000,
        enableOfflineQueue: false,
        password: process.env.REDIS_PASSWORD || undefined,
      };
      redis ??= process.env.REDIS_HOST
        ? new RedisClientConstructor(Number(process.env.REDIS_PORT || 6379), process.env.REDIS_HOST, options)
        : new RedisClientConstructor(process.env.REDIS_URL || 'redis://localhost:6379', options);
      const keyHash = createHash('sha256').update(key).digest('hex');
      const retryAfter = Number(await redis.eval(WINDOW_SCRIPT, 1, `rate-limit:${keyHash}`, windowMs, limit));
      return retryAfter > 0 ? retryAfter : undefined;
    } catch {
      // Preserve a local limit during a Redis outage; production Redis normally shares limits across API workers.
    }
  }
  return consume(key, 1, limit, windowMs);
}

export async function rateLimitGlobal(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const tenantId = req.tenantId || 'anonymous';
  const retryAfter = await checkLimit(`global:${tenantId}`, 100, 60_000);
  if (retryAfter) return next(Object.assign(new Error('RATE_LIMIT_EXCEEDED'), { statusCode: 429, retryAfter }));
  next();
}

export async function rateLimitProvider(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const tenantId = req.tenantId || 'anonymous';
  const key = `${tenantId}:provider`;
  const retryAfter = await checkLimit(key, 20, 60_000);
  if (retryAfter) return next(Object.assign(new Error('PROVIDER_RATE_LIMIT_EXCEEDED'), { statusCode: 429, retryAfter }));
  next();
}

export async function rateLimitLogin(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const rawEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const email = rawEmail.length > 0 && rawEmail.length <= 254
    ? createHash('sha256').update(rawEmail).digest('hex')
    : '';
  const limits = await Promise.all([
    checkLimit(`login:ip:${ip}`, 30, 15 * 60_000),
    email ? checkLimit(`login:email:${email}`, 10, 15 * 60_000) : Promise.resolve(undefined),
  ]);
  const retryAfter = Math.max(...limits.map((value) => value ?? 0));
  if (retryAfter) return next(Object.assign(new Error('LOGIN_RATE_LIMIT_EXCEEDED'), { statusCode: 429, retryAfter }));
  next();
}
