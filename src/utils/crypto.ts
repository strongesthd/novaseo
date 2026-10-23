import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const LEGACY_ALGORITHM = 'aes-256-cbc';

export function assertEncryptionKey(): void {
  encryptionKey();
}

function encryptionKey(): Buffer {
  const encoded = process.env.ENCRYPTION_KEY;
  if (!encoded || !/^[a-f0-9]{64}$/i.test(encoded)) {
    throw new Error('ENCRYPTION_KEY_MUST_BE_32_BYTES_OF_HEX');
  }
  return Buffer.from(encoded, 'hex');
}

export function encrypt(text: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return ['v2', iv.toString('hex'), cipher.getAuthTag().toString('hex'), encrypted.toString('hex')].join(':');
}

export function decrypt(text: string): string {
  const parts = text.split(':');
  const key = encryptionKey();
  if (parts.length === 4 && parts[0] === 'v2') {
    const [, ivHex, tagHex, encryptedHex] = parts;
    if (!/^[a-f0-9]{24}$/i.test(ivHex) || !/^[a-f0-9]{32}$/i.test(tagHex) || !/^(?:[a-f0-9]{2})*$/i.test(encryptedHex)) {
      throw new Error('INVALID_ENCRYPTED_FORMAT');
    }
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(encryptedHex, 'hex')), decipher.final()]).toString('utf8');
  }

  // Read legacy v1 ciphertexts so deployments can rotate without losing credentials.
  if (parts.length === 2 && /^[a-f0-9]{32}$/i.test(parts[0]) && /^(?:[a-f0-9]{2})+$/i.test(parts[1])) {
    const decipher = createDecipheriv(LEGACY_ALGORITHM, key, Buffer.from(parts[0], 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(parts[1], 'hex')), decipher.final()]).toString('utf8');
  }
  throw new Error('INVALID_ENCRYPTED_FORMAT');
}
