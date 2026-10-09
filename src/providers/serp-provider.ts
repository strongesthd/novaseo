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

  async mine(seedKeywords: string[], options: { locale?: string; country?: string; limit?: number } = {}): Promise<KeywordRecord[]> {
    const limit = Math.max(1, Math.min(options.limit ?? 100, 1000));
    const seeds = [...new Set(seedKeywords.map((value) => value.trim()).filter(Boolean))];
    return seeds.slice(0, limit).map((keyword, index) => ({
      keyword,
      source: this.platform,
      language: options.locale,
      country: options.country,
      volume: Math.max(10, (seeds.length - index) * 100),
      competition: Number((0.2 + (index % 7) / 10).toFixed(2)),
      suggestions: [`${keyword} hướng dẫn`, `${keyword} tốt nhất`, `cách chọn ${keyword}`],
      metadata: { provider: 'static-adapter', generatedAt: new Date().toISOString() },
    }));
  }
}

export const createSerpProvider = (platform: string): SerpProvider => {
  const allowed: KeywordPlatform[] = ['google', 'shopee', 'lazada', 'tiktok', 'youtube'];
  if (!allowed.includes(platform as KeywordPlatform)) throw new Error(`Unsupported keyword platform: ${platform}`);
  return new StaticSerpProvider(platform as KeywordPlatform);
};
