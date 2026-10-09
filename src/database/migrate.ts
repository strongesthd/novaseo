import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './connection.js';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigrations() {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = (await fs.readdir(migrationsDir)).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
    logger.info({ file }, 'Running migration');
    await pool.query(sql);
  }
  logger.info('Migrations completed');
}

runMigrations()
  .then(() => process.exit(0))
  .catch(err => {
    logger.error({ err }, 'Migration failed');
    process.exit(1);
  });
