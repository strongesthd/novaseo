import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/async-handler.js';
import { validate } from '../middleware/validate.js';
import { ProjectRepository } from '../repositories/project-repository.js';

const router = Router();
const repository = new ProjectRepository();

router.get('/', asyncHandler(async (req, res) => {
  res.status(200).json({ data: await repository.list(req.tenantId!) });
}));

const createSchema = z.object({
  name: z.string().min(1).max(200),
  industry: z.string().min(1).max(150),
  brandContext: z.record(z.any()).optional(),
  targetAudience: z.record(z.any()).optional(),
  toneOfVoice: z.string().max(100).optional(),
  targetPlatforms: z.array(z.enum(['wordpress', 'shopify', 'webhook', 'tiktok', 'youtube'])).default([]),
  platformSettings: z.record(z.any()).default({})
});
const updateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  industry: z.string().trim().min(1).max(150).optional(),
  brandContext: z.record(z.any()).optional(),
  targetAudience: z.record(z.any()).optional(),
  toneOfVoice: z.string().max(100).optional(),
  targetPlatforms: z.array(z.enum(['wordpress', 'shopify', 'webhook', 'tiktok', 'youtube'])).optional(),
  platformSettings: z.record(z.any()).optional(),
});

router.post('/', validate({ body: createSchema }), asyncHandler(async (req, res) => {
  const project = await repository.create(req.tenantId!, req.body);
  res.status(201).json({ data: project });
}));

router.get('/:projectId', asyncHandler(async (req, res) => {
  const projectId = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
  const project = await repository.findPublic(req.tenantId!, projectId);
  if (!project) {
    res.status(404).json({ error: { code: 'PROJECT_NOT_FOUND', message: 'Project was not found.' } });
    return;
  }
  res.status(200).json({ data: project });
}));

router.patch('/:projectId', validate({ params: z.object({ projectId: z.string().uuid() }), body: updateSchema }), asyncHandler(async (req, res) => {
  if (!Object.keys(req.body).length) {
    res.status(400).json({ error: { code: 'EMPTY_UPDATE', message: 'Provide at least one project field.' } });
    return;
  }
  const projectId = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
  const project = await repository.update(req.tenantId!, projectId, req.body);
  if (!project) {
    res.status(404).json({ error: { code: 'PROJECT_NOT_FOUND', message: 'Project was not found.' } });
    return;
  }
  res.status(200).json({ data: project });
}));

export default router;
