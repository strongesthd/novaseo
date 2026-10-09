import { Worker, Job } from 'bullmq';
import { createSeoWorkerProcessor } from './seo-worker.js';

export const createBullMqSeoWorker = (connection: any, queueName = 'seo-jobs') => {
  const processor = createSeoWorkerProcessor();
  return new Worker(queueName, async (job: Job) => processor.process({ name: job.name as any, data: job.data }), {
    connection,
    concurrency: Number(process.env.SEO_WORKER_CONCURRENCY ?? 5),
  });
};
