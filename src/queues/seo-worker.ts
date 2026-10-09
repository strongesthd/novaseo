import { KeywordMiningService } from '../services/keyword-mining-service-v2.js';
import { ContentOrchestrationService } from '../services/content-orchestration-service.js';
import { PublishingOrchestrationService } from '../services/publishing-orchestration-service.js';
import { IndexingService } from '../services/indexing-service.js';

export type SeoJob = { name: 'keyword-mining' | 'content-generation' | 'publishing' | 'indexing'; data: any };

export class SeoWorkerProcessor {
  constructor(
    private readonly mining = new KeywordMiningService(),
    private readonly generation = new ContentOrchestrationService(),
    private readonly publishing = new PublishingOrchestrationService(),
    private readonly indexing = new IndexingService(),
  ) {}

  async process(job: SeoJob): Promise<unknown> {
    switch (job.name) {
      case 'keyword-mining': return this.mining.mine(job.data);
      case 'content-generation': return this.generation.generate(job.data);
      case 'publishing': return this.publishing.publish(job.data);
      case 'indexing': return this.indexing.submit(job.data);
      default: throw new Error(`Unsupported SEO job: ${String((job as any).name)}`);
    }
  }
}

export const createSeoWorkerProcessor = () => new SeoWorkerProcessor();
