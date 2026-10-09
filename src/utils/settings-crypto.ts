import { encrypt, decrypt } from './crypto.js';

const SECRET_FIELDS = ['password', 'appPassword', 'token', 'oauthToken', 'oauthRef', 'secret', 'secretRef', 'accessToken', 'refreshToken', 'apiKey'];
const ENC_PREFIX = 'enc:v1:';

const isSecretKey = (key: string) => SECRET_FIELDS.some((field) => key.toLowerCase().includes(field.toLowerCase()));

// Encrypt secret-bearing fields inside platform settings before persistence.
export function encryptSettings(settings: Record<string, any> = {}): Record<string, any> {
  const output: Record<string, any> = {};
  for (const [platform, value] of Object.entries(settings)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      output[platform] = Object.fromEntries(
        Object.entries(value).map(([key, field]) => {
          if (typeof field === 'string' && isSecretKey(key) && !field.startsWith(ENC_PREFIX)) {
            return [key, ENC_PREFIX + encrypt(field)];
          }
          return [key, field];
        }),
      );
    } else {
      output[platform] = value;
    }
  }
  return output;
}

// Decrypt secret fields at runtime; tolerate plaintext for legacy rows.
export function decryptSettings(settings: Record<string, any> = {}): Record<string, any> {
  const output: Record<string, any> = {};
  for (const [platform, value] of Object.entries(settings)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      output[platform] = Object.fromEntries(
        Object.entries(value).map(([key, field]) => {
          if (typeof field === 'string' && field.startsWith(ENC_PREFIX)) return [key, decrypt(field.slice(ENC_PREFIX.length))];
          return [key, field];
        }),
      );
    } else {
      output[platform] = value;
    }
  }
  return output;
}

// Remove any secret-bearing field so it is never returned in an API response.
export function redactSettings(settings: Record<string, any> = {}): Record<string, any> {
  const output: Record<string, any> = {};
  for (const [platform, value] of Object.entries(settings)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      output[platform] = Object.fromEntries(
        Object.entries(value).filter(([key]) => !isSecretKey(key)).map(([key, field]) => [key, field]),
      );
    }
  }
  return output;
}