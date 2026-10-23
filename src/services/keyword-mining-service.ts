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
