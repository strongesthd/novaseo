import { ProviderError } from '../utils/provider-error.js';

export type PublishingPlatform = 'wordpress' | 'shopify' | 'webhook' | 'tiktok' | 'youtube';

export interface PublishInput {
  title: string;
  markdown?: string;
  html?: string;
  payload?: Record<string, unknown>;
  options?: Record<string, unknown>;
}

export interface PublishResult {
  externalId: string;
  externalUrl?: string;
  responseData: Record<string, unknown>;
}

export interface PublishingProvider {
  readonly platform: PublishingPlatform;
  publish(input: PublishInput): Promise<PublishResult>;
}

export class DryRunPublishingProvider implements PublishingProvider {
  constructor(public readonly platform: PublishingPlatform) {}

  async publish(_input: PublishInput): Promise<PublishResult> {
    throw new ProviderError('PUBLISHING_PROVIDER_NOT_CONFIGURED', this.platform, false);
  }
}

export const createPublishingProvider = (platform: string): PublishingProvider => {
  const allowed: PublishingPlatform[] = ['wordpress', 'shopify', 'webhook', 'tiktok', 'youtube'];
  if (!allowed.includes(platform as PublishingPlatform)) throw new Error(`Unsupported publishing platform: ${platform}`);
  return new DryRunPublishingProvider(platform as PublishingPlatform);
};
