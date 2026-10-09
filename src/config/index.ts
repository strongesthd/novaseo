export const config = {
  node: {
    env: process.env.NODE_ENV || 'development'
  },
  server: {
    port: parseInt(process.env.PORT || '3000', 10)
  },
  database: {
    url: process.env.DATABASE_URL || 'postgres://localhost/novaseo'
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret'
  },
  queue: {
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '5', 10)
  }
};
