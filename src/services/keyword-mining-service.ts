import { KeywordMinerFactory } from '../providers/factories.js';
import { KeywordRecord } from '../providers/contracts/index.js';
import { ClusterRepository } from '../repositories/cluster-repository.js';

export class KeywordMiningService {
  constructor(private clusters = new ClusterRepository()) {}

  async mine(tenantId: string, projectId: string, platform: string, seeds: string[], locale: string, country: string, limit: number, credentials?: Record<string, unknown>) {
    const miner = KeywordMinerFactory.create(platform);
    const records = await miner.mine({ seeds, locale, country, limit, credentials });
    const grouped = this.cluster(records);
    await this.clusters.createMany(grouped.map(group => ({ tenantId, projectId, platform, clusterName: group.primaryKeyword, primaryKeyword: group.primaryKeyword, intent: group.intent, clusterData: { keywords: group.keywords, volume: group.volume, competition: group.competition, source: group.source } })));
    return { platform, total: records.length, clusters: grouped.length };
  }

  private cluster(records: KeywordRecord[]) {
    const map = new Map<string, { primaryKeyword: string; intent: string; keywords: string[]; volume?: number; competition?: number; source: string }>();
    for (const record of records) {
      const root = record.keyword.split(/\s+/).slice(0, 2).join(' ').toLowerCase();
      const intent = this.detectIntent(record.keyword);
      const existing = map.get(root);
      if (existing) { existing.keywords.push(record.keyword); }
      else { map.set(root, { primaryKeyword: record.keyword, intent, keywords: [record.keyword], volume: record.volume, competition: record.competition, source: record.source }); }
    }
    return Array.from(map.values());
  }

  private detectIntent(keyword: string): string {
    const value = keyword.toLowerCase();
    if (/(mua|giá|order|deal|khuyến mãi)/.test(value)) return 'transactional';
    if (/(tốt nhất|review|so sánh|top)/.test(value)) return 'commercial';
    if (/(là gì|hướng dẫn|cách|tại sao)/.test(value)) return 'informational';
    return 'navigational';
  }
}
