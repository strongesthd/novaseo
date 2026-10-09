import http from 'http';
import { createApp } from './app.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { closeDatabaseConnection } from './database/connection.js';

const app = createApp();
const server = http.createServer(app);

server.listen(config.server.port, () => {
  logger.info({ port: config.server.port }, 'Server started');
});

async function shutdown() {
  logger.info('Shutting down');
  server.close(async () => {
    await closeDatabaseConnection();
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
