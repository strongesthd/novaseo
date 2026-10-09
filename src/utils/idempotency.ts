import { randomUUID } from 'crypto';

export function generateIdempotencyKey(contentId: string, platform: string, timestamp?: number): string {
  return `${contentId}-${platform}-${timestamp || 'default'}`;
}

export function generateJobId(): string {
  return randomUUID();
}
