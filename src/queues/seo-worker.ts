import { KeywordMiningService } from '../services/keyword-mining-service.js';
import { ContentGenerationService } from '../services/content-generation-service.js';
import { PublishingService } from '../services/publishing-service.js';
import { IndexingOrchestrationService } from '../services/indexing-orchestration-service.js';

export type SeoJob = { name: 'keyword-mining' | 'content-generation' | 'publishing' | 'indexing'; data: any };

export class SeoWorkerProcessor {
  constructor(
    private readonly mining = new KeywordMiningService(),
    private readonly generation = new ContentGenerationService(),
    private readonly publishing = new PublishingService(),
    private readonly indexing = new IndexingOrchestrationService(),
  ) {}

  async process(job: SeoJob): Promise<unknown> {
    switch (job.name) {
      case 'keyword-mining': return this.mining.mine(
        job.data.tenantId,
        job.data.projectId,
        job.data.platform,
        job.data.seedKeywords ?? job.data.seeds,
        job.data.locale ?? 'vi-VN',
        job.data.country ?? 'VN',
        job.data.limit ?? 100,
      );
      case 'content-generation': return this.generation.generate(job.data.tenantId, job.data.input ?? job.data);
      case 'publishing': return this.publishing.publish(job.data.tenantId, job.data.input ?? job.data);
      case 'indexing': return this.indexing.submit(job.data.tenantId, job.data.input ?? job.data);
      default: throw new Error(`Unsupported SEO job: ${String((job as any).name)}`);
    }
  }
}

export const createSeoWorkerProcessor = () => new SeoWorkerProcessor();
