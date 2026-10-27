import { describe, expect, it, vi } from 'vitest';
import { KeywordMiningService } from '../src/services/keyword-mining-service.js';
import { KeywordRecord } from '../src/providers/contracts/index.js';

class FakeClusterRepository {
  rows: any[] = [];
  async createMany(rows: any[]) {
    this.rows.push(...rows);
  }
}

const records: KeywordRecord[] = [
  {
    keyword: 'buy skincare',
    platform: 'google',
    source: 'Google',
    suggestions: [],
    metadata: {},
  },
  {
    keyword: 'skincare guide',
    platform: 'google',
    source: 'Google',
    suggestions: [],
    metadata: {},
  },
];

describe('KeywordMiningService', () => {
  it('checks project ownership, normalizes provider records, and persists clusters', async () => {
    const clusters = new FakeClusterRepository();
    const createMiner = vi.fn((platform: string) => ({
      platform,
      async mine() { return records; },
    }));
    const projects = { async findById(tenantId: string, projectId: string) {
      return tenantId === 'tenant-1' && projectId === 'project-1'
        ? { platform_settings: { google: { miningEndpoint: 'https://provider.example' } } }
        : undefined;
    } };
    const service = new KeywordMiningService(clusters as any, projects as any, createMiner as any);
    const result = await service.mine('tenant-1', 'project-1', 'google', ['buy skincare'], 'en-US', 'US', 50);
    expect(result.platform).toBe('google');
    expect(result.total).toBe(2);
    expect(clusters.rows.length).toBe(2);
    expect(clusters.rows.every((row) => row.tenantId === 'tenant-1' && row.projectId === 'project-1')).toBe(true);
    expect(createMiner).toHaveBeenCalledWith('google');
  });

  it('groups autocomplete suggestions by seed and removes repeated suggestions', async () => {
    const clusters = new FakeClusterRepository();
    const createMiner = vi.fn(() => ({
      platform: 'google',
      async mine() {
        return [
          {
            keyword: 'cà phê hạt rang',
            platform: 'google',
            source: 'Google Autocomplete via SerpApi',
            suggestions: [],
            metadata: { seedKeyword: 'cà phê hạt' },
          },
          {
            keyword: 'cà phê hạt ngon',
            platform: 'google',
            source: 'Google Autocomplete via SerpApi',
            suggestions: [],
            metadata: { seedKeyword: 'cà phê hạt' },
          },
          {
            keyword: 'cà phê hạt rang',
            platform: 'google',
            source: 'Google Autocomplete via SerpApi',
            suggestions: [],
            metadata: { seedKeyword: 'cà phê hạt' },
          },
        ];
      },
    }));
    const projects = { async findById() { return { platform_settings: {} }; } };
    const service = new KeywordMiningService(clusters as any, projects as any, createMiner as any);

    const result = await service.mine('tenant-1', 'project-1', 'google', ['cà phê hạt'], 'vi-VN', 'VN', 10);

    expect(result).toMatchObject({ total: 3, clusters: 1 });
    expect(clusters.rows).toHaveLength(1);
    expect(clusters.rows[0]).toMatchObject({
      primaryKeyword: 'cà phê hạt',
      clusterName: 'cà phê hạt',
      intent: 'unknown',
      clusterData: {
        keywords: ['cà phê hạt rang', 'cà phê hạt ngon'],
        source: 'Google Autocomplete via SerpApi',
      },
    });
  });

  it('does not enqueue or mine for a project outside the tenant', async () => {
    const clusters = new FakeClusterRepository();
    const createMiner = vi.fn();
    const service = new KeywordMiningService(
      clusters as any,
      { async findById() { return undefined; } } as any,
      createMiner as any,
    );
    await expect(service.mine('tenant-1', 'foreign-project', 'google', ['seed'], 'en-US', 'US', 10))
      .rejects.toMatchObject({ statusCode: 404, message: 'PROJECT_NOT_FOUND' });
    expect(createMiner).not.toHaveBeenCalled();
    expect(clusters.rows).toHaveLength(0);
  });

  it('rejects excessive seed and output limits', async () => {
    const service = new KeywordMiningService(
      new FakeClusterRepository() as any,
      { async findById() { return {}; } } as any,
      vi.fn() as any,
    );
    await expect(service.mine('tenant-1', 'project-1', 'google', Array(21).fill('seed'), 'vi-VN', 'VN', 20))
      .rejects.toMatchObject({ statusCode: 400, message: 'INVALID_SEEDS' });
    await expect(service.mine('tenant-1', 'project-1', 'google', ['seed'], 'vi-VN', 'VN', 201))
      .rejects.toMatchObject({ statusCode: 400, message: 'INVALID_RESULT_LIMIT' });
  });
});
