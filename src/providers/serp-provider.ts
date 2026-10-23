import { ProviderError } from '../utils/provider-error.js';

export type KeywordPlatform = 'google' | 'shopee' | 'lazada' | 'tiktok' | 'youtube';

export interface KeywordRecord {
  keyword: string;
  source: KeywordPlatform;
  language?: string;
  country?: string;
  volume?: number;
  competition?: number;
  suggestions: string[];
  metadata: Record<string, unknown>;
}

export interface SerpProvider {
  readonly platform: KeywordPlatform;
  mine(seedKeywords: string[], options?: { locale?: string; country?: string; limit?: number }): Promise<KeywordRecord[]>;
}

export class StaticSerpProvider implements SerpProvider {
  constructor(public readonly platform: KeywordPlatform) {}

  async mine(_seedKeywords: string[], _options: { locale?: string; country?: string; limit?: number } = {}): Promise<KeywordRecord[]> {
    throw new ProviderError('MINING_PROVIDER_NOT_CONFIGURED', this.platform, false);
  }
}

export const createSerpProvider = (platform: string): SerpProvider => {
  const allowed: KeywordPlatform[] = ['google', 'shopee', 'lazada', 'tiktok', 'youtube'];
  if (!allowed.includes(platform as KeywordPlatform)) throw new Error(`Unsupported keyword platform: ${platform}`);
  return new StaticSerpProvider(platform as KeywordPlatform);
};
