import { JobRepository } from '../repositories/job-repository.js';
import { generateJobId } from '../utils/idempotency.js';
import { Queue } from 'bullmq';

export type JobType = 'keyword_mining' | 'content_generation' | 'publishing' | 'indexing';
export class JobService {
  constructor(private repository = new JobRepository(), private queues: Partial<Record<JobType, Queue>> = {}) {}
  async enqueue(tenantId: string, type: JobType, data: any) {
    const id = generateJobId();
    await this.repository.create(id, tenantId, type);
    const queue = this.queues[type];
    if (!queue) {
      await this.repository.delete(id, tenantId);
      throw Object.assign(new Error('QUEUE_NOT_CONFIGURED'), { statusCode: 503 });
    }
    try {
      await queue.add(type, { ...data, jobId: id, tenantId }, { jobId: id, attempts: 4, backoff: { type: 'exponential', delay: 1000 }, removeOnComplete: 1000, removeOnFail: 5000 });
    } catch (error) {
      await this.repository.delete(id, tenantId);
      throw error;
    }
    return { jobId: id, status: 'queued' };
  }
  async get(tenantId: string, id: string) { const job = await this.repository.find(tenantId, id); if (!job) throw Object.assign(new Error('JOB_NOT_FOUND'), { statusCode: 404 }); return job; }
}
