import { Queue } from 'bullmq';
import { config } from '../config/index.js';
import IORedis from 'ioredis';
const RedisClient = IORedis as unknown as new (url: string, options: { maxRetriesPerRequest: null }) => any;
export const redisConnection = new RedisClient(config.redis.url, { maxRetriesPerRequest: null });
export const queues = {
  keyword_mining: new Queue('keyword-mining', { connection: redisConnection }),
  content_generation: new Queue('content-generation', { connection: redisConnection }),
  publishing: new Queue('publishing', { connection: redisConnection }),
  indexing: new Queue('indexing', { connection: redisConnection })
};
