import { ContentGenerationService } from './content-generation-service.js';

export interface ContentGenerationRequest {
  tenantId: string;
  projectId: string;
  clusterId: string;
  format?: 'html' | 'markdown';
  minWords?: number;
  generateShortVideoScripts?: boolean;
  language?: string;
}

export class ContentOrchestrationService {
  constructor(private readonly service = new ContentGenerationService()) {}

  generate(input: ContentGenerationRequest) {
    return this.service.generate(input.tenantId, {
      projectId: input.projectId,
      clusterId: input.clusterId,
      format: input.format ?? 'markdown',
      minWords: input.minWords ?? 1500,
      generateShortVideoScripts: input.generateShortVideoScripts ?? true,
      language: input.language ?? 'vi',
    });
  }
}
