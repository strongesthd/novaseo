import { startWorkers } from './queues/worker-factory.js';
import { logger } from './utils/logger.js';

const workers = startWorkers();
logger.info({ count: workers.length }, 'Workers started');

async function shutdown() {
  await Promise.all(workers.map(worker => worker.close()));
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
