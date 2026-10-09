import { Worker, Job } from 'bullmq';
import { queues, redisConnection } from './queues.js';
import { JobRepository } from '../repositories/job-repository.js';
import { KeywordMiningService } from '../services/keyword-mining-service.js';
import { ContentGenerationService } from '../services/content-generation-service.js';
import { PublishingService } from '../services/publishing-service.js';
import { IndexingOrchestrationService } from '../services/indexing-orchestration-service.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const jobs = new JobRepository();
const mining = new KeywordMiningService();
const generation = new ContentGenerationService();
const publishing = new PublishingService();
const indexing = new IndexingOrchestrationService();

async function processJob(type: string, job: Job<any>) {
  const data = job.data;
  await jobs.update(data.jobId, 'processing', 10);
  try {
    let result: any;
    if (type === 'keyword_mining') result = await mining.mine(data.tenantId, data.projectId, data.platform, data.seeds, data.locale, data.country, data.limit, data.credentials);
    else if (type === 'content_generation') result = await generation.generate(data.tenantId, data.input);
    else if (type === 'publishing') result = await publishing.publish(data.tenantId, data.input);
    else if (type === 'indexing') result = await indexing.submit(data.tenantId, data.input);
    else result = { accepted: true };
    await jobs.update(data.jobId, 'completed', 100, result);
    return result;
  } catch (err: any) {
    await jobs.update(data.jobId, 'failed', 100, undefined, { code: err.code || 'JOB_FAILED', message: err.message });
    logger.error({ err, jobId: data.jobId, type }, 'Job failed');
    throw err;
  }
}

export function startWorkers() {
  return Object.entries(queues).map(([type, queue]) => new Worker(queue.name, job => processJob(type, job), { connection: redisConnection, concurrency: config.queue.concurrency }));
}
