import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/async-handler.js';
import { validate } from '../middleware/validate.js';
import { JobService } from '../services/job-service.js';
import { ClusterRepository } from '../repositories/cluster-repository.js';
import { queues } from '../queues/queues.js';
import { rateLimitProvider } from '../middleware/rate-limit.js';
import { ProjectRepository } from '../repositories/project-repository.js';
import { decryptSettings } from '../utils/settings-crypto.js';
import { isSerpApiEndpoint } from '../providers/adapters.js';

const router = Router();
const jobs = new JobService(undefined, queues);
const clusters = new ClusterRepository();
const projects = new ProjectRepository();

const mineSchema = z.object({
  projectId: z.string().uuid(),
  seedKeywords: z.array(z.string().trim().min(1).max(120)).min(1).max(20)
    .refine((items) => new Set(items.map((item) => item.toLowerCase())).size === items.length, 'Seed keywords must be unique.'),
  platform: z.enum(['google', 'shopee', 'lazada', 'tiktok', 'youtube']),
  locale: z.string().trim().min(2).max(20).default('vi-VN'),
  country: z.string().trim().length(2).default('VN'),
  limit: z.number().int().min(1).max(200).default(100),
});

router.post('/mine', rateLimitProvider, validate({ body: mineSchema }), asyncHandler(async (req, res) => {
  const body = req.body;
  const project = await projects.findById(req.tenantId!, body.projectId);
  if (!project) {
    res.status(404).json({ error: { code: 'PROJECT_NOT_FOUND', message: 'Project was not found.' } });
    return;
  }
  const settings = decryptSettings(project.platform_settings || {});
  const endpoint = settings[body.platform]?.miningEndpoint;
  if (typeof endpoint !== 'string' || !endpoint.trim()) {
    res.status(400).json({
      error: {
        code: 'MINING_PROVIDER_NOT_CONFIGURED',
        message: `Chưa cấu hình nguồn dữ liệu cho ${body.platform}. Vào Tích hợp → Nguồn nghiên cứu từ khóa để cấu hình.`,
      },
    });
    return;
  }
  try {
    new URL(endpoint);
  } catch {
    res.status(400).json({
      error: { code: 'INVALID_MINING_ENDPOINT', message: 'Endpoint nghiên cứu từ khóa không hợp lệ.' },
    });
    return;
  }
  if (isSerpApiEndpoint(endpoint) && body.platform !== 'google') {
    res.status(400).json({
      error: {
        code: 'SERPAPI_GOOGLE_AUTOCOMPLETE_ONLY',
        message: 'SerpApi Google Autocomplete chỉ dùng được với nền tảng Google.',
      },
    });
    return;
  }
  if (isSerpApiEndpoint(endpoint) && !settings[body.platform]?.apiKey) {
    res.status(400).json({
      error: {
        code: 'SERPAPI_API_KEY_REQUIRED',
        message: 'Nhập API key SerpApi trong phần Tích hợp → Nguồn nghiên cứu từ khóa.',
      },
    });
    return;
  }
  const result = await jobs.enqueue(req.tenantId!, 'keyword_mining', { tenantId: req.tenantId, projectId: body.projectId, platform: body.platform, seeds: body.seedKeywords, locale: body.locale, country: body.country, limit: body.limit });
  res.status(201).json({ data: { ...result, platform: body.platform } });
}));

router.get('/clusters/:projectId', validate({
  params: z.object({ projectId: z.string().uuid() }),
  query: z.object({
    platform: z.enum(['google', 'shopee', 'lazada', 'tiktok', 'youtube']).optional(),
    intent: z.enum(['informational', 'commercial', 'transactional', 'navigational', 'unknown']).optional(),
    page: z.coerce.number().int().min(1).max(1_000_000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
}), asyncHandler(async (req, res) => {
  const platform = req.query.platform as string | undefined;
  const intent = req.query.intent as string | undefined;
  const projectId = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  const { rows, total } = await clusters.listPage(req.tenantId!, projectId, platform, intent, limit, (page - 1) * limit);
  res.status(200).json({ data: rows, meta: { page, limit, total } });
}));

export default router;
