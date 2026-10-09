import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';
import { createHmac, timingSafeEqual } from 'crypto';

declare global {
  namespace Express {
    interface Request {
      auth?: { userId: string; tenantIds: string[] };
      tenantId?: string;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    next(Object.assign(new Error('UNAUTHORIZED'), { statusCode: 401 }));
    return;
  }
  const token = header.slice(7);
  try {
    const [encodedPayload, encodedSignature] = token.split('.');
    if (!encodedPayload || !encodedSignature) throw new Error();
    const expected = createHmac('sha256', config.jwt.secret).update(encodedPayload).digest('base64url');
    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(encodedSignature);
    if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) throw new Error();
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    if (!payload?.userId || !Array.isArray(payload.tenantIds)) throw new Error();
    req.auth = { userId: payload.userId, tenantIds: payload.tenantIds };
    next();
  } catch {
    logger.warn('Invalid bearer token');
    next(Object.assign(new Error('UNAUTHORIZED'), { statusCode: 401 }));
  }
}
