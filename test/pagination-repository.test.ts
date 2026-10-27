import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../src/database/connection.js', () => ({ query }));

import { ContentRepository } from '../src/repositories/content-repository.js';
import { ClusterRepository } from '../src/repositories/cluster-repository.js';
import { PublishLogRepository } from '../src/repositories/publish-log-repository.js';

beforeEach(() => query.mockReset());

describe('database pagination and publish claims', () => {
  it('applies LIMIT/OFFSET in SQL and returns a separate total count', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ id: 'content-21' }] })
      .mockResolvedValueOnce({ rows: [{ total: 47 }] });
    const repository = new ContentRepository();
    const page = await repository.listPage('tenant-1', 'project-1', 'published', 20, 20);
    expect(page).toEqual({ rows: [{ id: 'content-21' }], total: 47 });
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0][0]).toMatch(/LIMIT \$4 OFFSET \$5/);
    expect(query.mock.calls[0][1]).toEqual(['tenant-1', 'project-1', 'published', 20, 20]);
  });

  it('filters keyword cluster counts and pages in the database', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ id: 'cluster-1' }] })
      .mockResolvedValueOnce({ rows: [{ total: 1 }] });
    const page = await new ClusterRepository().listPage('tenant-1', 'project-1', 'google', 'commercial', 10, 0);
    expect(page.total).toBe(1);
    expect(query.mock.calls[0][0]).toMatch(/LIMIT \$5 OFFSET \$6/);
    expect(query.mock.calls[1][0]).toContain('count(*)');
  });

  it('inserts a mining batch with one atomic statement', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await new ClusterRepository().createMany([
      { tenantId: 'tenant-1', projectId: 'project-1', platform: 'google', clusterName: 'a', primaryKeyword: 'a', intent: 'informational', clusterData: {} },
      { tenantId: 'tenant-1', projectId: 'project-1', platform: 'google', clusterName: 'b', primaryKeyword: 'b', intent: 'commercial', clusterData: {} },
    ]);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0].match(/\(\$1,/g)).toHaveLength(1);
    expect(query.mock.calls[0][0]).toContain('($8,$9,$10,$11,$12,$13,$14::jsonb)');
    expect(query.mock.calls[0][0]).toContain('ON CONFLICT (tenant_id,project_id,platform,(lower(btrim(primary_keyword))))');
    expect(query.mock.calls[0][0]).toContain('jsonb_array_elements_text');
    expect(query.mock.calls[0][1]).toHaveLength(14);
  });

  it('claims publication atomically and only reclaims definite failures', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await new PublishLogRepository().claim({
      tenantId: 'tenant-1',
      projectId: 'project-1',
      contentId: 'content-1',
      platform: 'wordpress',
      idempotencyKey: 'key-1',
    });
    const sql = query.mock.calls[0][0];
    expect(sql).toContain('ON CONFLICT (content_id,platform,idempotency_key) DO UPDATE');
    expect(sql).toContain("WHERE seo_publish_logs.status = 'failed'");
    expect(sql).not.toContain("status = 'processing' AND");
  });
});
