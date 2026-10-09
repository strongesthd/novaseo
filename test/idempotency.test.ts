import { describe, expect, it } from 'vitest';
import { generateIdempotencyKey } from '../src/utils/idempotency.js';

describe('idempotency keys', () => {
  it('is stable for repeated publishing requests', () => {
    expect(generateIdempotencyKey('content-1', 'wordpress')).toBe(generateIdempotencyKey('content-1', 'wordpress'));
  });

  it('supports explicit schedule versions', () => {
    expect(generateIdempotencyKey('content-1', 'wordpress', 123)).not.toBe(generateIdempotencyKey('content-1', 'wordpress', 124));
  });
});
