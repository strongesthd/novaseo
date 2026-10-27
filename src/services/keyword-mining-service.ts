import { KeywordMinerFactory } from '../providers/factories.js';
import { KeywordMiner, KeywordRecord } from '../providers/contracts/index.js';
import { ClusterRepository } from '../repositories/cluster-repository.js';
import { ProjectRepository } from '../repositories/project-repository.js';
import { decryptSettings } from '../utils/settings-crypto.js';

export class KeywordMiningService {
  constructor(
    private clusters = new ClusterRepository(),
    private projects = new ProjectRepository(),
    private createMiner = (platform: string) => KeywordMinerFactory.create(platform),
  ) {}

  async mine(tenantId: string, projectId: string, platform: string, seeds: string[], locale: string, country: string, limit: number, credentials?: Record<string, unknown>) {
    if (!Array.isArray(seeds) || seeds.length < 1 || seeds.length > 20 || seeds.some((seed) => typeof seed !== 'string' || !seed.trim() || seed.length > 120)) {
      throw Object.assign(new Error('INVALID_SEEDS'), { statusCode: 400 });
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
      throw Object.assign(new Error('INVALID_RESULT_LIMIT'), { statusCode: 400 });
    }
    const project = await this.projects.findById(tenantId, projectId);
    if (!project) throw Object.assign(new Error('PROJECT_NOT_FOUND'), { statusCode: 404 });
    const miner = this.createMiner(platform);
    const settings = decryptSettings(project.platform_settings || {});
    const records = await miner.mine({ seeds, locale, country, limit, credentials: credentials ?? settings[platform] });
    const grouped = this.cluster(records);
    await this.clusters.createMany(grouped.map(group => ({ tenantId, projectId, platform, clusterName: group.primaryKeyword, primaryKeyword: group.primaryKeyword, intent: group.intent, clusterData: { keywords: group.keywords, volume: group.volume, competition: group.competition, source: group.source } })));
    return { platform, total: records.length, clusters: grouped.length };
  }

  private cluster(records: KeywordRecord[]) {
    const map = new Map<string, { primaryKeyword: string; intent: string; keywords: string[]; volume?: number; competition?: number; source: string }>();
    for (const record of records) {
      const seedKeyword = record.metadata.seedKeyword;
      const primaryKeyword = typeof seedKeyword === 'string' && seedKeyword.trim()
        ? seedKeyword.trim()
        : record.keyword.trim();
      const key = primaryKeyword.toLocaleLowerCase();
      const intent = this.detectIntent(primaryKeyword);
      const existing = map.get(key);
      const relatedKeywords = [record.keyword, ...record.suggestions]
        .map((keyword) => keyword.trim())
        .filter((keyword) => keyword && keyword.toLocaleLowerCase() !== key);
      if (existing) {
        existing.keywords = Array.from(new Map(
          [...existing.keywords, ...relatedKeywords].map((keyword) => [keyword.toLocaleLowerCase(), keyword]),
        ).values());
        existing.volume ??= record.volume;
        existing.competition ??= record.competition;
      } else {
        map.set(key, {
          primaryKeyword,
          intent,
          keywords: Array.from(new Map(relatedKeywords.map((keyword) => [keyword.toLocaleLowerCase(), keyword])).values()),
          volume: record.volume,
          competition: record.competition,
          source: record.source,
        });
      }
    }
    return Array.from(map.values());
  }

  private detectIntent(keyword: string): string {
    const value = keyword.toLocaleLowerCase();
    if (/(mua|giá|order|deal|khuyến mãi|đặt hàng|đặt mua|giảm giá)/.test(value)) return 'transactional';
    if (/(tốt nhất|review|đánh giá|so sánh|top|nên chọn)/.test(value)) return 'commercial';
    if (/(là gì|hướng dẫn|cách|tại sao|bao gồm những gì)/.test(value)) return 'informational';
    if (/(chính hãng|website|trang chủ)/.test(value)) return 'navigational';
    return 'unknown';
  }
}
