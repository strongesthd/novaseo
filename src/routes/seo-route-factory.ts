import { Router } from 'express';
import { createSeoControllers } from './seo-controllers.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { validate } from '../middleware/validate.js';
import { z } from 'zod';
import { IndexingOrchestrationService } from '../services/indexing-orchestration-service.js';
import { InternalLinkerService } from '../services/internal-linker-service.js';

export const createSeoRouter = () => {
  const router = Router();
  const controllers = createSeoControllers();
  const indexing = new IndexingOrchestrationService();
  const linker = new InternalLinkerService();
  router.post('/keywords/mine', controllers.mine);
  router.post('/content/generate', controllers.generate);
  router.post('/content/publish', controllers.publish);
  router.post('/content/index', validate({ body: z.object({ contentId: z.string().uuid(), urls: z.array(z.string().url()).min(1), engines: z.array(z.enum(['google', 'indexnow'])).min(1) }) }), asyncHandler(async (req, res) => {
    const result = await indexing.submit(req.tenantId!, req.body);
    res.status(201).json({ data: result });
  }));
  router.post('/content/:contentId/inject-links', validate({ params: z.object({ contentId: z.string().uuid() }), query: z.object({ projectId: z.string().uuid() }) }), asyncHandler(async (req, res) => {
    const projectId = Array.isArray(req.query.projectId) ? req.query.projectId[0] : req.query.projectId;
    const contentId = Array.isArray(req.params.contentId) ? req.params.contentId[0] : req.params.contentId;
    const result = await linker.injectLinks(req.tenantId!, String(projectId), contentId);
    res.status(200).json({ data: result });
  }));
  return router;
};
