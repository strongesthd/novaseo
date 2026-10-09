import { Request, Response, NextFunction } from 'express';
import { runWithTenantContext } from '../database/connection.js';

export async function tenantContext(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const requested = (req.headers['x-tenant-id'] as string) || req.auth?.tenantIds?.[0];
    if (!requested || !req.auth?.tenantIds?.includes(requested)) {
      next(Object.assign(new Error('FORBIDDEN_TENANT'), { statusCode: 403 }));
      return;
    }
    req.tenantId = requested;
    await runWithTenantContext(requested, async () => new Promise<void>((resolve) => {
      const complete = () => {
        res.removeListener('finish', complete);
        res.removeListener('close', complete);
        resolve();
      };
      res.once('finish', complete);
      res.once('close', complete);
      next();
    }));
  } catch (err) {
    next(err);
  }
}
