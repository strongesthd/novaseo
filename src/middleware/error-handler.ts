import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(Object.assign(new Error('NOT_FOUND'), { statusCode: 404 }));
}

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction): void {
  const statusCode = err.statusCode || 500;
  const requestId = (req.headers['x-request-id'] as string) || '';
  if (statusCode >= 500) logger.error({ err, requestId, path: req.path }, 'Unhandled error');
  else logger.warn({ code: err.message, requestId, path: req.path }, 'Request error');
  res.status(statusCode).json({ error: { code: err.code || err.message || 'INTERNAL_ERROR', message: statusCode >= 500 ? 'Internal server error' : err.message, requestId } });
}
