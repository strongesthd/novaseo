import { Worker, Job } from 'bullmq';
import { queues, redisConnection } from './queues.js';
import { JobRepository } from '../repositories/job-repository.js';
import { KeywordMiningService } from '../services/keyword-mining-service.js';
import { ContentGenerationService } from '../services/content-generation-service.js';
import { PublishingService } from '../services/publishing-service.js';
import { IndexingOrchestrationService } from '../services/indexing-orchestration-service.js';
import { JobService } from '../services/job-service.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const jobs = new JobRepository();
const jobService = new JobService(jobs, queues);
const mining = new KeywordMiningService();
const generation = new ContentGenerationService();
const publishing = new PublishingService(undefined, undefined, undefined, (tenantId, input) =>
  jobService.enqueue(tenantId, 'indexing', { tenantId, input }),
);
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
    else throw Object.assign(new Error('UNSUPPORTED_JOB_TYPE'), { code: 'UNSUPPORTED_JOB_TYPE' });
    await jobs.update(data.jobId, 'completed', 100, result);
    return result;
  } catch (err: any) {
    const nonRetryable = err.retryable === false || (Number.isInteger(err.statusCode) && err.statusCode < 500);
    if (nonRetryable) job.discard();
    const exhausted = nonRetryable || (job.attemptsMade ?? 0) + 1 >= Number(job.opts.attempts ?? 1);
    const failure = { code: err.code || 'JOB_FAILED', message: err.message };
    await jobs.update(data.jobId, exhausted ? 'failed' : 'processing', exhausted ? 100 : 10, undefined, exhausted ? failure : undefined);
    if (exhausted) logger.error({ code: failure.code, jobId: data.jobId, type }, 'Job failed');
    else logger.warn({ code: failure.code, jobId: data.jobId, type, attempt: job.attemptsMade + 1 }, 'Job retry scheduled');
    throw err;
  }
}

export function startWorkers() {
  return Object.entries(queues).map(([type, queue]) => new Worker(queue.name, job => processJob(type, job), { connection: redisConnection, concurrency: config.queue.concurrency }));
}
