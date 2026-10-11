import { Queue } from 'bullmq';
import { config } from '../config/index.js';
import IORedis from 'ioredis';

const RedisClient = IORedis as unknown as {
  new (url: string, options: { maxRetriesPerRequest: null }): any;
  new (port: number, host: string, options: { maxRetriesPerRequest: null; password?: string }): any;
};
const redisOptions = { maxRetriesPerRequest: null };
export const redisConnection = config.redis.host
  ? new RedisClient(config.redis.port, config.redis.host, {
      ...redisOptions,
      password: config.redis.password
    })
  : new RedisClient(config.redis.url, redisOptions);

export const queues = {
  keyword_mining: new Queue('keyword-mining', { connection: redisConnection }),
  content_generation: new Queue('content-generation', { connection: redisConnection }),
  publishing: new Queue('publishing', { connection: redisConnection }),
  indexing: new Queue('indexing', { connection: redisConnection })
};
