import express from 'express';
import helmet from 'helmet';
import { authenticate } from './middleware/auth.js';
import { tenantContext } from './middleware/tenant.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import routes from './routes/index.js';
import { rateLimitGlobal } from './middleware/rate-limit.js';

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(express.json({ limit: '2mb' }));
  app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));
  app.use('/api/v1/seo', authenticate, tenantContext, rateLimitGlobal, routes);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
