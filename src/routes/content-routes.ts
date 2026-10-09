import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/async-handler.js';
import { validate } from '../middleware/validate.js';
import { JobService } from '../services/job-service.js';
import { ContentRepository } from '../repositories/content-repository.js';
import { queues } from '../queues/queues.js';
import { rateLimitProvider } from '../middleware/rate-limit.js';

const router = Router();
const jobs = new JobService(undefined, queues);
const contents = new ContentRepository();

const generateSchema = z.object({ projectId: z.string().uuid(), clusterId: z.string().uuid(), format: z.enum(['html', 'markdown']).default('html'), minWords: z.number().int().min(1500).default(1500), generateShortVideoScripts: z.boolean().default(true), targetPlatforms: z.array(z.enum(['wordpress', 'shopify', 'webhook', 'tiktok', 'youtube'])).optional(), language: z.string().default('vi') });
const publishSchema = z.object({ contentId: z.string().uuid(), targetPlatforms: z.array(z.enum(['wordpress', 'shopify', 'webhook', 'tiktok', 'youtube'])).min(1), scheduleAt: z.string().nullable().optional(), publishOptions: z.object({ visibility: z.string().default('public'), sendIndexing: z.boolean().default(false) }).optional() });

router.post('/generate', validate({ body: generateSchema }), asyncHandler(async (req, res) => {
  const result = await jobs.enqueue(req.tenantId!, 'content_generation', { tenantId: req.tenantId, input: req.body });
  res.status(201).json({ data: result });
}));

router.post('/publish', rateLimitProvider, validate({ body: publishSchema }), asyncHandler(async (req, res) => {
  const result = await jobs.enqueue(req.tenantId!, 'publishing', { tenantId: req.tenantId, input: req.body });
  res.status(201).json({ data: { ...result, targetPlatforms: req.body.targetPlatforms } });
}));

router.get('/:projectId', validate({ params: z.object({ projectId: z.string().uuid() }), query: z.object({ status: z.string().optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) }) }), asyncHandler(async (req, res) => {
  const status = req.query.status as string | undefined;
  const projectId = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
  const data = await contents.list(req.tenantId!, projectId, status);
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  res.status(200).json({ data: data.slice((page - 1) * limit, page * limit), meta: { page, limit, total: data.length } });
}));

export default router;
