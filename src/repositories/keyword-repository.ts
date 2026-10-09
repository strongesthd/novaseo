import { createSerpProvider, KeywordRecord } from '../providers/serp-provider.js';

export interface KeywordRepository {
  saveMany(input: { tenantId: string; projectId: string; records: KeywordRecord[] }): Promise<unknown[]>;
}

export class KeywordMiningRepository implements KeywordRepository {
  private readonly records: unknown[] = [];

  async saveMany(input: { tenantId: string; projectId: string; records: KeywordRecord[] }): Promise<unknown[]> {
    const saved = input.records.map((record) => ({ id: crypto.randomUUID(), tenantId: input.tenantId, projectId: input.projectId, ...record, createdAt: new Date().toISOString() }));
    this.records.push(...saved);
    return saved;
  }

  list(tenantId: string, projectId: string): unknown[] {
    return this.records.filter((record: any) => record.tenantId === tenantId && record.projectId === projectId);
  }
}

export class KeywordMiningRepositoryFactory {
  static provider(platform: string) { return createSerpProvider(platform); }
}
