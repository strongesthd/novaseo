import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../config/index.js';

export interface SessionClaims {
  userId: string;
  tenantIds: string[];
  exp: number;
}

export function createSessionToken(userId: string, tenantIds: string[]): string {
  const payload = Buffer.from(JSON.stringify({
    userId,
    tenantIds,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8,
  })).toString('base64url');
  const signature = createHmac('sha256', config.jwt.secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifySessionToken(token: string): SessionClaims | undefined {
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return undefined;

  const expected = createHmac('sha256', config.jwt.secret).update(payload).digest('base64url');
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) return undefined;

  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SessionClaims;
    if (
      typeof claims.userId !== 'string' ||
      !Array.isArray(claims.tenantIds) ||
      !claims.tenantIds.every((tenantId) => typeof tenantId === 'string') ||
      !Number.isInteger(claims.exp) ||
      claims.exp <= Math.floor(Date.now() / 1000)
    ) return undefined;
    return claims;
  } catch {
    return undefined;
  }
}
