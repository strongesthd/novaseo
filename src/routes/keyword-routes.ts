import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/async-handler.js';
import { validate } from '../middleware/validate.js';
import { JobService } from '../services/job-service.js';
import { ClusterRepository } from '../repositories/cluster-repository.js';
import { queues } from '../queues/queues.js';
import { rateLimitProvider } from '../middleware/rate-limit.js';

const router = Router();
const jobs = new JobService(undefined, queues);
const clusters = new ClusterRepository();

const mineSchema = z.object({ projectId: z.string().uuid(), seedKeywords: z.array(z.string()).min(1), platform: z.enum(['google', 'shopee', 'lazada', 'tiktok', 'youtube']), locale: z.string().default('vi-VN'), country: z.string().default('VN'), limit: z.number().int().min(1).max(500).default(100) });

router.post('/mine', rateLimitProvider, validate({ body: mineSchema }), asyncHandler(async (req, res) => {
  const body = req.body;
  const result = await jobs.enqueue(req.tenantId!, 'keyword_mining', { tenantId: req.tenantId, projectId: body.projectId, platform: body.platform, seeds: body.seedKeywords, locale: body.locale, country: body.country, limit: body.limit });
  res.status(201).json({ data: { ...result, platform: body.platform } });
}));

router.get('/clusters/:projectId', validate({ params: z.object({ projectId: z.string().uuid() }), query: z.object({ platform: z.enum(['google', 'shopee', 'lazada', 'tiktok', 'youtube']).optional(), intent: z.enum(['informational', 'commercial', 'transactional', 'navigational']).optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) }) }), asyncHandler(async (req, res) => {
  const platform = req.query.platform as string | undefined;
  const intent = req.query.intent as string | undefined;
  const projectId = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
  const data = await clusters.list(req.tenantId!, projectId, platform, intent);
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  const paged = data.slice((page - 1) * limit, page * limit);
  res.status(200).json({ data: paged, meta: { page, limit, total: data.length } });
}));

export default router;
