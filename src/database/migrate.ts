import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './connection.js';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function ensureMigrationsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function isApplied(file: string): Promise<boolean> {
  const res = await pool.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [file]);
  return res.rowCount !== 0;
}

async function markApplied(file: string): Promise<void> {
  await pool.query('INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING', [file]);
}

async function runMigrations() {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = (await fs.readdir(migrationsDir)).filter(f => f.endsWith('.sql')).sort();
  await ensureMigrationsTable();
  for (const file of files) {
    if (await isApplied(file)) {
      logger.info({ file }, 'Migration already applied, skipping');
      continue;
    }
    const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
    logger.info({ file }, 'Running migration');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      logger.info({ file }, 'Migration applied');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      logger.error({ err, file }, 'Migration failed');
      throw err;
    } finally {
      client.release();
    }
  }
  logger.info('Migrations completed');
}

runMigrations()
  .then(() => process.exit(0))
  .catch(err => {
    logger.error({ err }, 'Migration failed');
    process.exit(1);
  });
