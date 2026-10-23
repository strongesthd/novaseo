import { JobRepository } from '../repositories/job-repository.js';
import { generateJobId } from '../utils/idempotency.js';
import { Queue } from 'bullmq';

export type JobType = 'keyword_mining' | 'content_generation' | 'publishing' | 'indexing';
export class JobService {
  constructor(private repository = new JobRepository(), private queues: Partial<Record<JobType, Queue>> = {}) {}
  async enqueue(tenantId: string, type: JobType, data: any, options?: { delay?: number }) {
    const id = generateJobId();
    await this.repository.create(id, tenantId, type);
    const queue = this.queues[type];
    if (!queue) {
      await this.repository.delete(id, tenantId);
      throw Object.assign(new Error('QUEUE_NOT_CONFIGURED'), { statusCode: 503 });
    }
    try {
      const delay = options?.delay ?? 0;
      if (!Number.isSafeInteger(delay) || delay < 0 || delay > 365 * 24 * 60 * 60 * 1000) {
        throw Object.assign(new Error('INVALID_JOB_DELAY'), { statusCode: 400 });
      }
      await queue.add(type, { ...data, jobId: id, tenantId }, { jobId: id, delay, attempts: 4, backoff: { type: 'exponential', delay: 1000 }, removeOnComplete: 1000, removeOnFail: 5000 });
    } catch (error) {
      await this.repository.delete(id, tenantId);
      throw error;
    }
    return { jobId: id, status: 'queued' };
  }
  async list(tenantId: string) { return this.repository.list(tenantId); }
  async get(tenantId: string, id: string) { const job = await this.repository.find(tenantId, id); if (!job) throw Object.assign(new Error('JOB_NOT_FOUND'), { statusCode: 404 }); return job; }
}
