import { PublishingService } from './publishing-service.js';
import { PublishingPlatform } from '../providers/contracts/index.js';

export interface PublishTarget {
  platform: PublishingPlatform;
  options?: Record<string, unknown>;
}

export class PublishingOrchestrationService {
  constructor(private readonly service = new PublishingService()) {}

  publish(input: {
    tenantId: string;
    contentId: string;
    targets: PublishTarget[];
    idempotencyKey: string;
    publishOptions?: { visibility?: string; sendIndexing?: boolean };
  }) {
    return this.service.publish(input.tenantId, {
      contentId: input.contentId,
      targetPlatforms: input.targets.map((target) => target.platform),
      idempotencyKey: input.idempotencyKey,
      publishOptions: input.publishOptions,
    });
  }
}
