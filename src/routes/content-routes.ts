import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/async-handler.js';
import { validate } from '../middleware/validate.js';
import { JobService } from '../services/job-service.js';
import { ContentRepository } from '../repositories/content-repository.js';
import { queues } from '../queues/queues.js';
import { rateLimitProvider } from '../middleware/rate-limit.js';
import { createHash, randomUUID } from 'node:crypto';

const router = Router();
const jobs = new JobService(undefined, queues);
const contents = new ContentRepository();

const platformSchema = z.enum(['wordpress', 'shopify', 'webhook', 'tiktok', 'youtube']);
const generateSchema = z.object({
  projectId: z.string().uuid(),
  clusterId: z.string().uuid(),
  format: z.enum(['html', 'markdown']).default('html'),
  minWords: z.number().int().min(1500).max(5000).default(1500),
  generateShortVideoScripts: z.boolean().default(true),
  targetPlatforms: z.array(platformSchema).max(5).optional(),
  language: z.string().trim().min(2).max(20).default('vi'),
});
const publishSchema = z.object({
  contentId: z.string().uuid(),
  targetPlatforms: z.array(platformSchema).min(1).max(5).refine((items) => new Set(items).size === items.length, 'Platforms must be unique.'),
  scheduleAt: z.string().datetime({ offset: true }).nullable().optional().refine(
    (value) => value == null || Date.parse(value) > Date.now(),
    'scheduleAt must be in the future.',
  ),
  publishOptions: z.object({
    visibility: z.enum(['public', 'private', 'draft']).default('public'),
    sendIndexing: z.boolean().default(false),
  }).optional(),
});
const updateSchema = z.object({ title: z.string().trim().min(1).max(500).optional(), contentMarkdown: z.string().max(200000).optional() });

router.post('/generate', rateLimitProvider, validate({ body: generateSchema }), asyncHandler(async (req, res) => {
  const result = await jobs.enqueue(req.tenantId!, 'content_generation', { tenantId: req.tenantId, input: req.body });
  res.status(201).json({ data: result });
}));

router.post('/publish', rateLimitProvider, validate({ body: publishSchema }), asyncHandler(async (req, res) => {
  const headerKey = req.header('Idempotency-Key');
  if (headerKey && (headerKey.length > 100 || !/^[\w.-]+$/.test(headerKey))) {
    res.status(400).json({ error: { code: 'INVALID_IDEMPOTENCY_KEY', message: 'Idempotency-Key must be at most 100 safe characters.' } });
    return;
  }
  const input = {
    ...req.body,
    idempotencyKey: headerKey ?? createHash('sha256').update(`${req.tenantId}:${JSON.stringify(req.body)}:${randomUUID()}`).digest('hex'),
  };
  const scheduledAt = input.scheduleAt ? Date.parse(input.scheduleAt) : undefined;
  const result = await jobs.enqueue(
    req.tenantId!,
    'publishing',
    { tenantId: req.tenantId, input },
    scheduledAt ? { delay: Math.max(0, scheduledAt - Date.now()) } : undefined,
  );
  res.status(201).json({ data: { ...result, targetPlatforms: req.body.targetPlatforms, scheduleAt: input.scheduleAt ?? null } });
}));

router.get('/:projectId', validate({
  params: z.object({ projectId: z.string().uuid() }),
  query: z.object({
    status: z.enum(['draft', 'generating', 'ready', 'publishing', 'published', 'failed']).optional(),
    page: z.coerce.number().int().min(1).max(1_000_000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
}), asyncHandler(async (req, res) => {
  const status = req.query.status as string | undefined;
  const projectId = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  const { rows, total } = await contents.listPage(req.tenantId!, projectId, status, limit, (page - 1) * limit);
  res.status(200).json({ data: rows, meta: { page, limit, total } });
}));

router.patch('/:contentId', validate({ params: z.object({ contentId: z.string().uuid() }), body: updateSchema }), asyncHandler(async (req, res) => {
  if (!req.body.title && req.body.contentMarkdown === undefined) {
    res.status(400).json({ error: { code: 'EMPTY_UPDATE', message: 'Provide a title or contentMarkdown.' } });
    return;
  }
  const contentId = Array.isArray(req.params.contentId) ? req.params.contentId[0] : req.params.contentId;
  const content = await contents.updateDraft(req.tenantId!, contentId, req.body);
  if (!content) {
    res.status(404).json({ error: { code: 'CONTENT_NOT_FOUND', message: 'Content was not found.' } });
    return;
  }
  res.status(200).json({ data: content });
}));

export default router;
