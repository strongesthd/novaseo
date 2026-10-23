import { createCipheriv, randomBytes } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { decrypt, encrypt } from '../src/utils/crypto.js';
import { decryptSettings, encryptSettings, redactSettings } from '../src/utils/settings-crypto.js';

const key = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

afterEach(() => vi.unstubAllEnvs());

describe('settings encryption', () => {
  it('round-trips empty and non-empty plaintext with authenticated encryption', () => {
    vi.stubEnv('ENCRYPTION_KEY', key);
    const encrypted = encrypt('api-token');
    expect(encrypted.startsWith('v2:')).toBe(true);
    expect(decrypt(encrypted)).toBe('api-token');
    expect(decrypt(encrypt(''))).toBe('');
  });

  it('rejects tampered ciphertext and invalid key lengths', () => {
    vi.stubEnv('ENCRYPTION_KEY', key);
    const encrypted = encrypt('secret');
    const tampered = encrypted.replace(/.$/, encrypted.endsWith('0') ? '1' : '0');
    expect(() => decrypt(tampered)).toThrow();
    vi.stubEnv('ENCRYPTION_KEY', '0123456789abcdef0123456789abcdef');
    expect(() => encrypt('secret')).toThrow('ENCRYPTION_KEY_MUST_BE_32_BYTES_OF_HEX');
  });

  it('decrypts existing v1 AES-CBC values and writes new v2 values', () => {
    vi.stubEnv('ENCRYPTION_KEY', key);
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
    const value = Buffer.concat([cipher.update('legacy-password', 'utf8'), cipher.final()]);
    const settings = { wordpress: { appPassword: `enc:v1:${iv.toString('hex')}:${value.toString('hex')}` } };
    expect(decryptSettings(settings)).toEqual({ wordpress: { appPassword: 'legacy-password' } });

    const encrypted = encryptSettings({ wordpress: { appPassword: 'new-password' } });
    expect(encrypted.wordpress.appPassword.startsWith('enc:v2:v2:')).toBe(true);
    expect(decryptSettings(encrypted)).toEqual({ wordpress: { appPassword: 'new-password' } });
    expect(redactSettings(encrypted)).toEqual({ wordpress: {} });
  });
});
