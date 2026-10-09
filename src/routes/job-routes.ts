import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler.js';
import { JobService } from '../services/job-service.js';

const router = Router();
const jobs = new JobService();

router.get('/:jobId', asyncHandler(async (req, res) => {
  const id = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;
  const job = await jobs.get(req.tenantId!, id);
  res.status(200).json({ data: job });
}));

export default router;
