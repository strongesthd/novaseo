import pg from 'pg';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { AsyncLocalStorage } from 'node:async_hooks';

const { Pool } = pg;

const connectionOptions = config.database.host
  ? {
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.user,
      password: config.database.password
    }
  : { connectionString: config.database.url };

export const pool = new Pool({
  ...connectionOptions,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

const requestClients = new AsyncLocalStorage<pg.PoolClient>();

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected database error');
});

export async function query(text: string, params?: any[]): Promise<pg.QueryResult<any>> {
  const client = requestClients.getStore();
  return client ? client.query(text, params) : pool.query(text, params);
}

export async function runWithTenantContext<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT set_config($1, $2, true)', ['app.tenant_id', tenantId]);
    const result = await requestClients.run(client, fn);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function closeDatabaseConnection(): Promise<void> {
  await pool.end();
}
