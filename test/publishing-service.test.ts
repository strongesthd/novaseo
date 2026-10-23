import { describe, expect, it, vi } from 'vitest';
import { PublishingService } from '../src/services/publishing-service.js';

function fixture(publish: () => Promise<any>, schedule = vi.fn(async () => ({ jobId: 'index-job' }))) {
  const rows = new Map<string, any>();
  const contents = {
    async findById() { return { id: 'content-1', project_id: 'project-1', title: 'Title', content_html: '<p>Body</p>' }; },
    async setPublishedUrl() {},
  };
  const projects = { async findById() { return { platform_settings: {} }; } };
  const logs = {
    async markStaleUnknown() {},
    async claim(input: any) {
      const key = `${input.contentId}:${input.platform}:${input.idempotencyKey}`;
      const old = rows.get(key);
      if (old && old.status !== 'failed') return undefined;
      const row = { ...input, status: 'processing', externalUrl: undefined };
      rows.set(key, row);
      return row;
    },
    async findByIdempotency(_tenantId: string, contentId: string, platform: string, key: string) {
      return rows.get(`${contentId}:${platform}:${key}`);
    },
    async finish(input: any) {
      const key = `${input.contentId}:${input.platform}:${input.idempotencyKey}`;
      const row = { ...rows.get(key), ...input, external_url: input.externalUrl };
      rows.set(key, row);
      return row;
    },
  };
  const createPublisher = vi.fn(() => ({ publish }));
  const service = new PublishingService(
    contents as any,
    projects as any,
    logs as any,
    schedule as any,
    createPublisher as any,
    async () => undefined,
  );
  return { service, rows, createPublisher, schedule };
}

describe('PublishingService', () => {
  it('claims an idempotency key once under concurrent delivery', async () => {
    let publishCount = 0;
    const { service, createPublisher } = fixture(async () => {
      publishCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { externalId: 'external-1', responseData: {} };
    });
    const input = { contentId: 'content-1', targetPlatforms: ['webhook'], idempotencyKey: 'same-request' };
    const [first, second] = await Promise.all([
      service.publish('tenant-1', input),
      service.publish('tenant-1', input),
    ]);
    expect(publishCount).toBe(1);
    expect(createPublisher).toHaveBeenCalledTimes(1);
    expect([first.results[0].status, second.results[0].status].sort()).toEqual(['processing', 'published']);
    const replay = await service.publish('tenant-1', input);
    expect(replay.results[0]).toMatchObject({ status: 'published', deduplicated: true });
    expect(publishCount).toBe(1);
  });

  it('allows an explicitly failed operation to retry using the same key', async () => {
    let attempt = 0;
    const { service } = fixture(async () => {
      attempt += 1;
      if (attempt === 1) throw Object.assign(new Error('Unauthorized'), { code: 'HTTP_401', retryable: false });
      return { externalId: 'external-2', responseData: {} };
    });
    const input = { contentId: 'content-1', targetPlatforms: ['webhook'], idempotencyKey: 'retryable-request' };
    await expect(service.publish('tenant-1', input)).resolves.toMatchObject({ results: [{ status: 'failed', error: 'HTTP_401' }] });
    await expect(service.publish('tenant-1', input)).resolves.toMatchObject({ results: [{ status: 'published' }] });
    expect(attempt).toBe(2);
  });

  it('does not replay an operation whose external outcome is uncertain', async () => {
    let attempt = 0;
    const { service } = fixture(async () => {
      attempt += 1;
      throw Object.assign(new Error('Timed out'), { code: 'OUTBOUND_TIMEOUT', retryable: true, outcomeUnknown: true });
    });
    const input = { contentId: 'content-1', targetPlatforms: ['webhook'], idempotencyKey: 'uncertain-request' };
    await expect(service.publish('tenant-1', input)).resolves.toMatchObject({ results: [{ status: 'unknown' }] });
    await expect(service.publish('tenant-1', input)).resolves.toMatchObject({ results: [{ status: 'unknown', deduplicated: true }] });
    expect(attempt).toBe(1);
  });

  it('keeps a successful publish successful when indexing enqueue fails', async () => {
    const schedule = vi.fn(async () => { throw Object.assign(new Error('Redis unavailable'), { code: 'REDIS_DOWN' }); });
    const { service } = fixture(async () => ({
      externalId: 'external-3',
      externalUrl: 'https://site.example/post',
      responseData: {},
    }), schedule);
    await expect(service.publish('tenant-1', {
      contentId: 'content-1',
      targetPlatforms: ['webhook'],
      idempotencyKey: 'publish-and-index',
      publishOptions: { sendIndexing: true },
    })).resolves.toMatchObject({
      results: [{ status: 'published', indexingStatus: 'enqueue_failed', indexingError: 'REDIS_DOWN' }],
    });
  });
});
