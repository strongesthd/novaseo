import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { verifySessionToken } from '../utils/auth-token.js';

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
  const cookie = req.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('novaseo_session='))
    ?.slice('novaseo_session='.length);
  const token = header?.startsWith('Bearer ') ? header.slice(7) : cookie;
  if (!token) {
    next(Object.assign(new Error('UNAUTHORIZED'), { statusCode: 401 }));
    return;
  }
  const claims = verifySessionToken(token);
  if (!claims) {
    logger.warn('Invalid bearer token');
    next(Object.assign(new Error('UNAUTHORIZED'), { statusCode: 401 }));
    return;
  }
  req.auth = { userId: claims.userId, tenantIds: claims.tenantIds };
  next();
}
