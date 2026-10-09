import { IndexerFactory } from '../providers/factories.js';
import { IndexingLogRepository } from '../repositories/indexing-log-repository.js';
import { ProjectRepository } from '../repositories/project-repository.js';
import { ContentRepository } from '../repositories/content-repository.js';
import { retryWithBackoff } from '../utils/retry.js';
import { logger } from '../utils/logger.js';
import { decryptSettings } from '../utils/settings-crypto.js';

export class IndexingOrchestrationService {
  constructor(
    private logs = new IndexingLogRepository(),
    private projects = new ProjectRepository(),
    private contents = new ContentRepository(),
  ) {}

  async submit(tenantId: string, input: { contentId: string; urls: string[]; engines: string[] }) {
    const content = await this.contents.findById(tenantId, input.contentId);
    if (!content) throw Object.assign(new Error('CONTENT_NOT_FOUND'), { statusCode: 404 });
    const project = await this.projects.findById(tenantId, content.project_id);
    if (!project) throw Object.assign(new Error('PROJECT_NOT_FOUND'), { statusCode: 404 });

    const settings = decryptSettings(project.platform_settings || {});
    const results = [];

    for (const engine of input.engines) {
      for (const url of input.urls) {
        try {
          const indexer = IndexerFactory.create(engine);
          const result = await retryWithBackoff(() => indexer.submit([url], settings[engine]), { maxRetries: 3, label: `indexing:${engine}` });
          await this.logs.create({
            tenantId,
            projectId: content.project_id,
            contentId: input.contentId,
            engine,
            url,
            status: result.accepted ? 'submitted' : 'skipped',
            accepted: result.accepted,
            responseData: result.responseData,
          });
          results.push({ engine, url, status: result.accepted ? 'submitted' : 'skipped', accepted: result.accepted });
        } catch (err: any) {
          logger.error({ err, engine, url, contentId: input.contentId }, 'Indexing failed');
          await this.logs.create({
            tenantId,
            projectId: content.project_id,
            contentId: input.contentId,
            engine,
            url,
            status: 'failed',
            accepted: false,
            responseData: { error: err.message },
          });
          results.push({ engine, url, status: 'failed', accepted: false, error: err.message });
        }
      }
    }

    return { contentId: input.contentId, results };
  }
}
