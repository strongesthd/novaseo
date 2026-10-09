import { Request, Response, NextFunction } from 'express';

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function consume(key: string, points: number, limit: number): number | undefined {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: points, resetAt: now + 60_000 });
    return undefined;
  }
  if (bucket.count + points > limit) return Math.ceil((bucket.resetAt - now) / 1000);
  bucket.count += points;
  return undefined;
}

export function rateLimitGlobal(req: Request, _res: Response, next: NextFunction): void {
  const tenantId = req.tenantId || 'anonymous';
  const retryAfter = consume(`global:${tenantId}`, 1, 100);
  if (retryAfter) return next(Object.assign(new Error('RATE_LIMIT_EXCEEDED'), { statusCode: 429, retryAfter }));
  next();
}

export function rateLimitProvider(req: Request, _res: Response, next: NextFunction): void {
  const tenantId = req.tenantId || 'anonymous';
  const key = `${tenantId}:provider`;
  const retryAfter = consume(key, 1, 20);
  if (retryAfter) return next(Object.assign(new Error('PROVIDER_RATE_LIMIT_EXCEEDED'), { statusCode: 429, retryAfter }));
  next();
}
