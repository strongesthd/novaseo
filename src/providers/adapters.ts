import { createHash } from 'crypto';
import { KeywordMiner, KeywordRecord, MiningPlatform, Publisher, PublishingPlatform, PublishResult, Indexer, IndexingEngine, IndexResult } from './contracts/index.js';
import { ProviderError } from '../utils/provider-error.js';

const searchTemplates: Record<MiningPlatform, string> = { google: 'Google', shopee: 'Shopee', lazada: 'Lazada', tiktok: 'TikTok Search', youtube: 'YouTube Autosuggest' };

export class GenericKeywordMiner implements KeywordMiner {
  constructor(public readonly platform: MiningPlatform) {}
  async mine(input: { seeds: string[]; locale: string; country: string; limit: number; credentials?: Record<string, unknown> }): Promise<KeywordRecord[]> {
    if (!input.seeds.length) throw new ProviderError('SEEDS_REQUIRED', this.platform, false);
    const records: KeywordRecord[] = [];
    for (const seed of input.seeds) {
      const suggestions = [`${seed} là gì`, `${seed} tốt nhất`, `mua ${seed}`, `${seed} giá bao nhiêu`];
      for (const keyword of [seed, ...suggestions].slice(0, input.limit)) {
        records.push({ keyword, platform: this.platform, source: searchTemplates[this.platform], locale: input.locale, country: input.country, suggestions, volume: undefined, competition: undefined, metadata: { generatedAt: new Date().toISOString() } });
      }
    }
    return records.slice(0, input.limit);
  }
}

export class HttpPublisher implements Publisher {
  constructor(public readonly platform: PublishingPlatform) {}
  async publish(input: { title: string; html?: string; markdown?: string; slug?: string; payload?: Record<string, unknown>; credentials?: Record<string, unknown> }): Promise<PublishResult> {
    const credentials = input.credentials || {};
    const endpoint = typeof credentials.url === 'string' ? credentials.url : typeof credentials.siteUrl === 'string' ? credentials.siteUrl : undefined;
    if (!endpoint) throw new ProviderError('CREDENTIALS_REQUIRED', this.platform, false);
    const body = this.platform === 'webhook' ? input.payload || { title: input.title, content: input.html || input.markdown } : { title: input.title, content: input.html || input.markdown, slug: input.slug };
    const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (!response.ok) throw new ProviderError(`HTTP_${response.status}`, this.platform, [429, 500, 502, 503, 504].includes(response.status));
    const data = await response.json().catch(() => ({}));
    return { externalId: String(data.id || createHash('sha256').update(endpoint + input.title).digest('hex')), externalUrl: data.url || data.link, responseData: data };
  }
}

export class HttpIndexer implements Indexer {
  constructor(public readonly engine: IndexingEngine) {}
  async submit(urls: string[], credentials?: Record<string, unknown>): Promise<IndexResult> {
    const endpoint = typeof credentials?.url === 'string' ? credentials.url : undefined;
    if (!endpoint) return { engine: this.engine, accepted: false, responseData: { reason: 'not_configured' } };
    const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ urls }) });
    if (!response.ok) throw new ProviderError(`HTTP_${response.status}`, this.engine, [429, 500, 502, 503, 504].includes(response.status));
    return { engine: this.engine, accepted: true, responseData: await response.json().catch(() => ({})) };
  }
}
