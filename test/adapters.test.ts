import { afterEach, describe, expect, it, vi } from 'vitest';
import { GenericKeywordMiner, HttpIndexer, HttpPublisher } from '../src/providers/adapters.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GenericKeywordMiner', () => {
  it('normalizes results for the requested platform', async () => {
    const miner = new GenericKeywordMiner('tiktok');
    const records = await miner.mine({ seeds: ['kem chống nắng'], locale: 'vi-VN', country: 'VN', limit: 10 });
    expect(records.length).toBeGreaterThan(0);
    expect(records.every(record => record.platform === 'tiktok')).toBe(true);
    expect(records[0].suggestions.length).toBeGreaterThan(0);
  });

  it('fails without retry when seeds are empty', async () => {
    const miner = new GenericKeywordMiner('google');
    await expect(miner.mine({ seeds: [], locale: 'vi-VN', country: 'VN', limit: 5 })).rejects.toMatchObject({ code: 'SEEDS_REQUIRED', retryable: false });
  });
});

describe('HttpPublisher', () => {
  it('fails without retry when endpoint credentials are missing', async () => {
    const publisher = new HttpPublisher('wordpress');
    await expect(publisher.publish({ title: 'Test' })).rejects.toMatchObject({ code: 'CREDENTIALS_REQUIRED', retryable: false });
  });

  it('maps successful responses into publish results', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: '42', url: 'https://example.com/a' }) }));
    const publisher = new HttpPublisher('webhook');
    const result = await publisher.publish({ title: 'Test', html: '<p>Body</p>', credentials: { url: 'https://hooks.example.com' } });
    expect(result.externalId).toBe('42');
    expect(result.externalUrl).toBe('https://example.com/a');
  });

  it('marks throttling responses as retryable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 }));
    const publisher = new HttpPublisher('shopify');
    await expect(publisher.publish({ title: 'Test', credentials: { url: 'https://store.myshopify.com' } })).rejects.toMatchObject({ retryable: true });
  });
});

describe('HttpIndexer', () => {
  it('reports not configured instead of failing the publishing job', async () => {
    const indexer = new HttpIndexer('indexnow');
    const result = await indexer.submit(['https://example.com/a']);
    expect(result).toEqual({ engine: 'indexnow', accepted: false, responseData: { reason: 'not_configured' } });
  });

  it('accepts submissions when an endpoint is configured', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'ok' }) }));
    const indexer = new HttpIndexer('google');
    const result = await indexer.submit(['https://example.com/a'], { url: 'https://indexing.example.com' });
    expect(result.accepted).toBe(true);
  });
});
