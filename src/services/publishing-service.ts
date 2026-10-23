import { ContentRepository } from '../repositories/content-repository.js';
import { ProjectRepository } from '../repositories/project-repository.js';
import { PublishLogRepository } from '../repositories/publish-log-repository.js';
import { PublisherFactory } from '../providers/factories.js';
import { Publisher } from '../providers/contracts/index.js';
import { generateIdempotencyKey } from '../utils/idempotency.js';
import { decryptSettings } from '../utils/settings-crypto.js';
import { validatePublicHttpsUrl } from '../utils/safe-http.js';

type IndexingScheduler = (tenantId: string, input: {
  contentId: string;
  urls: string[];
  engines: string[];
}) => Promise<{ jobId: string }>;
type PublicUrlValidator = (url: string) => Promise<unknown>;

export class PublishingService {
  constructor(
    private contents = new ContentRepository(),
    private projects = new ProjectRepository(),
    private logs = new PublishLogRepository(),
    private scheduleIndexing: IndexingScheduler = async () => {
      throw Object.assign(new Error('INDEXING_QUEUE_NOT_CONFIGURED'), { code: 'INDEXING_QUEUE_NOT_CONFIGURED' });
    },
    private createPublisher: (platform: string) => Publisher = (platform) => PublisherFactory.create(platform),
    private validateUrl: PublicUrlValidator = validatePublicHttpsUrl,
  ) {}

  async publish(tenantId: string, input: {
    contentId: string;
    targetPlatforms: string[];
    idempotencyKey?: string;
    publishOptions?: { visibility?: string; sendIndexing?: boolean };
  }) {
    if (
      !Array.isArray(input.targetPlatforms) ||
      input.targetPlatforms.length < 1 ||
      input.targetPlatforms.length > 5 ||
      new Set(input.targetPlatforms).size !== input.targetPlatforms.length
    ) {
      throw Object.assign(new Error('INVALID_TARGET_PLATFORMS'), { statusCode: 400 });
    }
    if (input.idempotencyKey && (input.idempotencyKey.length > 100 || !/^[\w.-]+$/.test(input.idempotencyKey))) {
      throw Object.assign(new Error('INVALID_IDEMPOTENCY_KEY'), { statusCode: 400 });
    }
    const content = await this.contents.findById(tenantId, input.contentId);
    if (!content) throw Object.assign(new Error('CONTENT_NOT_FOUND'), { statusCode: 404 });
    const project = await this.projects.findById(tenantId, content.project_id);
    if (!project) throw Object.assign(new Error('PROJECT_NOT_FOUND'), { statusCode: 404 });
    const settings = decryptSettings(project.platform_settings || {});
    const results: Array<Record<string, unknown>> = [];

    for (const platform of [...new Set(input.targetPlatforms)]) {
      const key = input.idempotencyKey || generateIdempotencyKey(input.contentId, platform);
      await this.logs.markStaleUnknown(tenantId, input.contentId, platform, key);
      const claim = await this.logs.claim({
        tenantId,
        projectId: content.project_id,
        contentId: input.contentId,
        platform,
        idempotencyKey: key,
      });
      if (!claim) {
        const previous = await this.logs.findByIdempotency(tenantId, input.contentId, platform, key);
        if (!previous) throw Object.assign(new Error('PUBLISH_CLAIM_FAILED'), { statusCode: 503 });
        results.push({
          platform,
          status: previous.status,
          externalUrl: previous.external_url,
          deduplicated: true,
        });
        continue;
      }

      let published: Awaited<ReturnType<ReturnType<typeof PublisherFactory.create>['publish']>>;
      try {
        const publisher = this.createPublisher(platform);
        published = await publisher.publish({
          title: content.title,
          html: content.content_html,
          markdown: content.content_markdown,
          slug: content.slug,
          payload: {
            ...content.multi_platform_payload,
            contentId: input.contentId,
          },
          credentials: { ...settings[platform], visibility: input.publishOptions?.visibility ?? 'public' },
          idempotencyKey: key,
        });
      } catch (error: any) {
        const uncertain = error?.retryable === true || error?.outcomeUnknown === true;
        const errorCode = typeof error?.code === 'string' ? error.code : 'PUBLISH_FAILED';
        await this.logs.finish({
          tenantId,
          contentId: input.contentId,
          platform,
          idempotencyKey: key,
          status: uncertain ? 'unknown' : 'failed',
          errorCode,
          errorMessage: errorCode,
          responseData: {},
        });
        results.push({ platform, status: uncertain ? 'unknown' : 'failed', error: errorCode });
        continue;
      }

      let externalUrl: string | undefined;
      if (published.externalUrl) {
        try {
          await this.validateUrl(published.externalUrl);
          externalUrl = published.externalUrl;
        } catch {
          externalUrl = undefined;
        }
      }
      await this.logs.finish({
        tenantId,
        contentId: input.contentId,
        platform,
        idempotencyKey: key,
        status: 'published',
        externalId: published.externalId,
        externalUrl,
        responseData: published.responseData,
      });
      if (externalUrl) await this.contents.setPublishedUrl(tenantId, input.contentId, externalUrl);
      const result: Record<string, unknown> = { platform, status: 'published', externalUrl };

      if (input.publishOptions?.sendIndexing && input.publishOptions.visibility !== 'private' &&
        input.publishOptions.visibility !== 'draft' && externalUrl) {
        try {
          const indexingJob = await this.scheduleIndexing(tenantId, {
            contentId: input.contentId,
            urls: [externalUrl],
            engines: ['google', 'indexnow'],
          });
          result.indexingJobId = indexingJob.jobId;
        } catch (error: any) {
          result.indexingStatus = 'enqueue_failed';
          result.indexingError = typeof error?.code === 'string' ? error.code : 'INDEXING_ENQUEUE_FAILED';
        }
      }
      results.push(result);
    }
    return { contentId: input.contentId, results };
  }
}
