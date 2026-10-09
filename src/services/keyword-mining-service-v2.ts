import { createSerpProvider, KeywordRecord } from '../providers/serp-provider.js';
import { KeywordMiningRepository } from '../repositories/keyword-repository.js';

export interface MiningRequest {
  tenantId: string;
  projectId: string;
  platform: string;
  seedKeywords: string[];
  locale?: string;
  country?: string;
  limit?: number;
}

export class KeywordMiningService {
  constructor(private readonly repository = new KeywordMiningRepository()) {}

  async mine(input: MiningRequest): Promise<{ jobId: string; records: KeywordRecord[] }> {
    const provider = createSerpProvider(input.platform);
    const records = await provider.mine(input.seedKeywords, { locale: input.locale, country: input.country, limit: input.limit });
    await this.repository.saveMany({ tenantId: input.tenantId, projectId: input.projectId, records });
    return { jobId: crypto.randomUUID(), records };
  }
}
