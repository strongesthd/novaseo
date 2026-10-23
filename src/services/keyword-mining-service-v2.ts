import { KeywordMiningService as PersistentKeywordMiningService } from './keyword-mining-service.js';

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
  constructor(private readonly service = new PersistentKeywordMiningService()) {}

  mine(input: MiningRequest) {
    return this.service.mine(
      input.tenantId,
      input.projectId,
      input.platform,
      input.seedKeywords,
      input.locale ?? 'vi-VN',
      input.country ?? 'VN',
      input.limit ?? 100,
    );
  }
}
