import { describe, expect, it } from 'vitest';
import { createSessionToken, verifySessionToken } from '../src/utils/auth-token.js';
import { hashPassword, verifyPassword } from '../src/utils/password.js';

describe('session tokens', () => {
  it('signs tenant-scoped claims with an expiration', () => {
    const token = createSessionToken('user-1', ['tenant-1']);
    expect(verifySessionToken(token)).toMatchObject({ userId: 'user-1', tenantIds: ['tenant-1'] });
  });

  it('rejects modified or malformed tokens', () => {
    const token = createSessionToken('user-1', ['tenant-1']);
    expect(verifySessionToken(`${token}x`)).toBeUndefined();
    expect(verifySessionToken('not-a-token')).toBeUndefined();
  });
});

describe('password hashing', () => {
  it('verifies the original password and rejects a different one', async () => {
    const hash = await hashPassword('correct horse battery');
    await expect(verifyPassword('correct horse battery', hash)).resolves.toBe(true);
    await expect(verifyPassword('different password', hash)).resolves.toBe(false);
  });
});
