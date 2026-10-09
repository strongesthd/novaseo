import { describe, expect, it } from 'vitest';
import { IndexerFactory, KeywordMinerFactory, PublisherFactory } from '../src/providers/factories.js';

describe('provider factories', () => {
  it('creates adapters for every supported mining platform', () => {
    for (const platform of ['google', 'shopee', 'lazada', 'tiktok', 'youtube']) {
      expect(KeywordMinerFactory.create(platform).platform).toBe(platform);
    }
  });

  it('creates adapters for every supported publishing platform', () => {
    for (const platform of ['wordpress', 'shopify', 'webhook', 'tiktok', 'youtube']) {
      expect(PublisherFactory.create(platform).platform).toBe(platform);
    }
  });

  it('creates indexers for google and indexnow', () => {
    expect(IndexerFactory.create('google').engine).toBe('google');
    expect(IndexerFactory.create('indexnow').engine).toBe('indexnow');
  });

  it('rejects unsupported identifiers', () => {
    expect(() => KeywordMinerFactory.create('bing')).toThrow('UNSUPPORTED_MINING_PLATFORM');
    expect(() => PublisherFactory.create('facebook')).toThrow('UNSUPPORTED_PUBLISHING_PLATFORM');
    expect(() => IndexerFactory.create('yahoo')).toThrow('UNSUPPORTED_INDEXING_ENGINE');
  });
});
