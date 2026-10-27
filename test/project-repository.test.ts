import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../src/database/connection.js', () => ({ query }));

import { ProjectRepository } from '../src/repositories/project-repository.js';

beforeEach(() => query.mockReset());

describe('ProjectRepository', () => {
  it('deletes only a project belonging to the requested tenant', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'project-1' }] });

    await expect(new ProjectRepository().delete('tenant-1', 'project-1')).resolves.toBe(true);

    expect(query).toHaveBeenCalledWith(
      'DELETE FROM seo_projects WHERE id = $1 AND tenant_id = $2 RETURNING id',
      ['project-1', 'tenant-1'],
    );
  });

  it('reports when no project in the tenant was deleted', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await expect(new ProjectRepository().delete('tenant-1', 'foreign-project')).resolves.toBe(false);
  });
});
