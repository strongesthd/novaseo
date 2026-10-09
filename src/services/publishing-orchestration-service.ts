import { createPublishingProvider, PublishingPlatform } from '../providers/publishing-provider.js';

export interface PublishTarget {
  platform: PublishingPlatform;
  options?: Record<string, unknown>;
}

export class PublishingOrchestrationService {
  private readonly logs: any[] = [];

  async publish(input: { tenantId: string; projectId: string; contentId: string; title: string; markdown?: string; html?: string; payload?: Record<string, unknown>; targets: PublishTarget[]; idempotencyKey: string }) {
    const results = await Promise.all(input.targets.map(async (target) => {
      const duplicate = this.logs.find((log) => log.contentId === input.contentId && log.platform === target.platform && log.idempotencyKey === input.idempotencyKey);
      if (duplicate) return duplicate;
      try {
        const result = await createPublishingProvider(target.platform).publish({ title: input.title, markdown: input.markdown, html: input.html, payload: input.payload, options: target.options });
        const log = { id: crypto.randomUUID(), tenantId: input.tenantId, projectId: input.projectId, contentId: input.contentId, platform: target.platform, idempotencyKey: input.idempotencyKey, status: 'published', ...result, createdAt: new Date().toISOString() };
        this.logs.push(log);
        return log;
      } catch (error) {
        const log = { id: crypto.randomUUID(), tenantId: input.tenantId, projectId: input.projectId, contentId: input.contentId, platform: target.platform, idempotencyKey: input.idempotencyKey, status: 'failed', errorMessage: error instanceof Error ? error.message : 'Publish failed', createdAt: new Date().toISOString() };
        this.logs.push(log);
        return log;
      }
    }));
    return { results };
  }
}
