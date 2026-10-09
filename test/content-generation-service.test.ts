import { describe, expect, it } from 'vitest';
import { ContentGenerationService } from '../src/services/content-generation-service.js';

function stubContentRepository() {
  return {
    async create(input: any) {
      return { ...input, id: 'content-1' };
    }
  };
}

const project = { id: 'p1', name: 'Organic Beauty', brand_context: { products: ['Kem SPF'] }, target_audience: { region: 'VN' } };
const cluster = { id: 'c1', primary_keyword: 'kem chống nắng' };

describe('ContentGenerationService', () => {
  it('generates content meeting the minimum word count and three video scripts', async () => {
    const service = new ContentGenerationService(stubContentRepository() as any, { async findById() { return cluster; } } as any, { async findById() { return project; } } as any);
    const result = await service.generate('tenant-1', { projectId: 'p1', clusterId: 'c1', format: 'html', minWords: 1500, generateShortVideoScripts: true, language: 'vi' });
    expect(result.wordCount).toBeGreaterThanOrEqual(1500);
    expect(result.scripts).toBe(3);
    expect(result.contentId).toBe('content-1');
  });

  it('fails with 404 when the cluster does not exist', async () => {
    const service = new ContentGenerationService(stubContentRepository() as any, { async findById() { return null; } } as any, { async findById() { return project; } } as any);
    await expect(service.generate('tenant-1', { projectId: 'p1', clusterId: 'missing', format: 'html', minWords: 1500, generateShortVideoScripts: true, language: 'vi' })).rejects.toMatchObject({ statusCode: 404 });
  });
});
