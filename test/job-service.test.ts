import { describe, expect, it, vi } from 'vitest';
import { JobService } from '../src/services/job-service.js';

describe('JobService scheduling', () => {
  it('stores a job and passes a validated delay to BullMQ', async () => {
    const repository = {
      create: vi.fn(async () => undefined),
      delete: vi.fn(async () => undefined),
    };
    const queue = { add: vi.fn(async () => undefined) };
    const service = new JobService(repository as any, { publishing: queue } as any);
    const result = await service.enqueue(
      'tenant-1',
      'publishing',
      { input: { contentId: 'content-1' } },
      { delay: 60_000 },
    );
    expect(result.status).toBe('queued');
    expect(queue.add).toHaveBeenCalledWith('publishing', expect.objectContaining({ tenantId: 'tenant-1' }), expect.objectContaining({
      delay: 60_000,
      attempts: 4,
    }));
  });

  it('removes the pre-created DB job when a schedule delay is invalid', async () => {
    const repository = {
      create: vi.fn(async () => undefined),
      delete: vi.fn(async () => undefined),
    };
    const queue = { add: vi.fn(async () => undefined) };
    const service = new JobService(repository as any, { publishing: queue } as any);
    await expect(service.enqueue('tenant-1', 'publishing', {}, { delay: -1 }))
      .rejects.toMatchObject({ statusCode: 400, message: 'INVALID_JOB_DELAY' });
    expect(repository.delete).toHaveBeenCalledTimes(1);
    expect(queue.add).not.toHaveBeenCalled();
  });
});
