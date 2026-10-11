import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('database connection', () => {
  it('passes credentials as discrete fields without URL parsing', async () => {
    vi.stubEnv('DB_HOST', 'postgres');
    vi.stubEnv('DB_PORT', '5432');
    vi.stubEnv('DB_DATABASE', 'novaseo');
    vi.stubEnv('DB_USERNAME', 'novaseo');
    vi.stubEnv('DB_PASSWORD', 'secret$R@#%value');
    vi.resetModules();

    const { pool } = await import('../src/database/connection.js');

    expect(pool.options).toMatchObject({
      host: 'postgres',
      port: 5432,
      database: 'novaseo',
      user: 'novaseo',
      password: 'secret$R@#%value'
    });
    expect(pool.options.connectionString).toBeUndefined();
    await pool.end();
  });
});
