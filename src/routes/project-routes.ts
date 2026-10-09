import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/async-handler.js';
import { validate } from '../middleware/validate.js';
import { ProjectRepository } from '../repositories/project-repository.js';

const router = Router();
const repository = new ProjectRepository();

const createSchema = z.object({
  name: z.string().min(1).max(200),
  industry: z.string().min(1).max(150),
  brandContext: z.record(z.any()).optional(),
  targetAudience: z.record(z.any()).optional(),
  toneOfVoice: z.string().max(100).optional(),
  targetPlatforms: z.array(z.enum(['wordpress', 'shopify', 'webhook', 'tiktok', 'youtube'])).default([]),
  platformSettings: z.record(z.any()).default({})
});

router.post('/', validate({ body: createSchema }), asyncHandler(async (req, res) => {
  const project = await repository.create(req.tenantId!, req.body);
  res.status(201).json({ data: project });
}));

export default router;
