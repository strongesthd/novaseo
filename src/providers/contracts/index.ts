export type MiningPlatform = 'google' | 'shopee' | 'lazada' | 'tiktok' | 'youtube';
export type PublishingPlatform = 'wordpress' | 'shopify' | 'webhook' | 'tiktok' | 'youtube';
export type IndexingEngine = 'google' | 'indexnow';

export interface KeywordRecord {
  keyword: string;
  platform: MiningPlatform;
  source: string;
  locale?: string;
  country?: string;
  volume?: number;
  competition?: number;
  suggestions: string[];
  metadata: Record<string, unknown>;
}

export interface KeywordMiner {
  readonly platform: MiningPlatform;
  mine(input: { seeds: string[]; locale: string; country: string; limit: number; credentials?: Record<string, unknown> }): Promise<KeywordRecord[]>;
}

export interface PublishResult { externalId: string; externalUrl?: string; responseData?: Record<string, unknown>; }
export interface Publisher {
  readonly platform: PublishingPlatform;
  publish(input: { title: string; html?: string; markdown?: string; slug?: string; payload?: Record<string, unknown>; credentials?: Record<string, unknown> }): Promise<PublishResult>;
}

export interface IndexResult { engine: IndexingEngine; accepted: boolean; responseData?: Record<string, unknown>; }
export interface Indexer { readonly engine: IndexingEngine; submit(urls: string[], credentials?: Record<string, unknown>): Promise<IndexResult>; }
