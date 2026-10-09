import { ContentRepository } from '../repositories/content-repository.js';
import { ProjectRepository } from '../repositories/project-repository.js';
import { PublishLogRepository } from '../repositories/publish-log-repository.js';
import { PublisherFactory, IndexerFactory } from '../providers/factories.js';
import { generateIdempotencyKey } from '../utils/idempotency.js';
import { decryptSettings } from '../utils/settings-crypto.js';

export class PublishingService {
  constructor(private contents = new ContentRepository(), private projects = new ProjectRepository(), private logs = new PublishLogRepository()) {}

  async publish(tenantId: string, input: { contentId: string; targetPlatforms: string[]; idempotencyKey?: string; publishOptions?: any }) {
    const content = await this.contents.findById(tenantId, input.contentId);
    if (!content) throw Object.assign(new Error('CONTENT_NOT_FOUND'), { statusCode: 404 });
    const project = await this.projects.findById(tenantId, content.project_id);
    if (!project) throw Object.assign(new Error('PROJECT_NOT_FOUND'), { statusCode: 404 });
    const settings = decryptSettings(project.platform_settings || {});
    const results = [];
    for (const platform of input.targetPlatforms) {
      const key = input.idempotencyKey || generateIdempotencyKey(input.contentId, platform);
      const previous = await this.logs.findByIdempotency(input.contentId, platform, key);
      if (previous) { results.push({ platform, status: previous.status, externalUrl: previous.external_url, deduplicated: true }); continue; }
      try {
        const publisher = PublisherFactory.create(platform);
        const published = await publisher.publish({ title: content.title, html: content.content_html, markdown: content.content_markdown, slug: content.slug, payload: content.multi_platform_payload?.[platform], credentials: settings[platform] });
        await this.logs.create({ tenantId, projectId: content.project_id, contentId: input.contentId, platform, status: 'published', externalId: published.externalId, externalUrl: published.externalUrl, idempotencyKey: key, responseData: published.responseData });
        if (published.externalUrl) await this.contents.setPublishedUrl(tenantId, input.contentId, published.externalUrl);
        results.push({ platform, status: 'published', externalUrl: published.externalUrl });
        if (input.publishOptions?.sendIndexing && published.externalUrl) await this.index(published.externalUrl, settings);
      } catch (err: any) {
        await this.logs.create({ tenantId, projectId: content.project_id, contentId: input.contentId, platform, status: 'failed', idempotencyKey: key, responseData: { error: err.message } });
        results.push({ platform, status: 'failed', error: err.message });
      }
    }
    return { contentId: input.contentId, results };
  }

  private async index(url: string, settings: any) {
    await Promise.all(['google', 'indexnow'].map(async engine => {
      const indexer = IndexerFactory.create(engine);
      return indexer.submit([url], settings[engine]);
    }));
  }
}
