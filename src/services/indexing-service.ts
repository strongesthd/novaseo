import { IndexingOrchestrationService } from './indexing-orchestration-service.js';

export class IndexingService {
  constructor(private readonly service = new IndexingOrchestrationService()) {}

  submit(input: {
    tenantId: string;
    contentId: string;
    url?: string;
    urls?: string[];
    engines?: string[];
  }) {
    return this.service.submit(input.tenantId, {
      contentId: input.contentId,
      urls: input.urls ?? (input.url ? [input.url] : []),
      engines: input.engines ?? ['google', 'indexnow'],
    });
  }
}
