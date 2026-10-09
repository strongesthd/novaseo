import { LlmProvider, ContentGenerationInput, TemplateLlmProvider } from '../providers/llm-provider.js';

export interface ContentGenerationRequest extends ContentGenerationInput {
  tenantId: string;
  projectId: string;
  clusterId: string;
}

export class ContentOrchestrationService {
  constructor(private readonly provider: LlmProvider = new TemplateLlmProvider()) {}

  async generate(input: ContentGenerationRequest) {
    const generated = await this.provider.generateContent(input);
    return { id: crypto.randomUUID(), tenantId: input.tenantId, projectId: input.projectId, clusterId: input.clusterId, ...generated, status: 'ready', createdAt: new Date().toISOString() };
  }
}
