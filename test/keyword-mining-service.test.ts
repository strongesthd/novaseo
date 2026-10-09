import { describe, expect, it } from 'vitest';
import { KeywordMiningService } from '../src/services/keyword-mining-service.js';

class FakeClusterRepository {
  rows: any[] = [];
  async createMany(rows: any[]) {
    this.rows.push(...rows);
  }
}

describe('KeywordMiningService', () => {
  it('groups keywords into clusters with detected intent', async () => {
    const clusters = new FakeClusterRepository();
    const service = new KeywordMiningService(clusters as any);
    const result = await service.mine('tenant-1', 'project-1', 'google', ['mua kem chống nắng', 'kem chống nắng là gì'], 'vi-VN', 'VN', 50);
    expect(result.platform).toBe('google');
    expect(result.total).toBeGreaterThan(0);
    expect(clusters.rows.length).toBeGreaterThan(0);
    expect(clusters.rows.some(row => row.intent === 'transactional')).toBe(true);
    expect(clusters.rows.every(row => row.tenantId === 'tenant-1')).toBe(true);
  });
});
