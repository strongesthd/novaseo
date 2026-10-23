import { describe, expect, it } from 'vitest';
import { isPublicAddress, validatePublicHttpsUrl } from '../src/utils/safe-http.js';

describe('outbound endpoint validation', () => {
  it('allows global addresses and rejects reserved IPv4/IPv6 ranges', () => {
    expect(isPublicAddress('93.184.216.34')).toBe(true);
    expect(isPublicAddress('2606:4700:4700::1111')).toBe(true);
    for (const address of [
      '0.0.0.0',
      '10.1.2.3',
      '100.64.0.1',
      '127.0.0.1',
      '169.254.169.254',
      '172.20.0.1',
      '192.168.1.1',
      '224.0.0.1',
      '::',
      '::1',
      'fc00::1',
      'fe80::1',
      '::ffff:127.0.0.1',
      '2001:db8::1',
    ]) {
      expect(isPublicAddress(address), address).toBe(false);
    }
  });

  it('requires HTTPS and rejects DNS answers that include private addresses', async () => {
    const publicResolver = async () => [{ address: '93.184.216.34', family: 4 }];
    await expect(validatePublicHttpsUrl('http://example.com', publicResolver))
      .rejects.toThrow('OUTBOUND_ENDPOINT_NOT_ALLOWED');
    await expect(validatePublicHttpsUrl('https://example.com', async () => [
      { address: '93.184.216.34', family: 4 },
      { address: '10.0.0.8', family: 4 },
    ])).rejects.toThrow('OUTBOUND_ENDPOINT_NOT_ALLOWED');
  });

  it('rejects literal loopback hosts before DNS resolution', async () => {
    const resolver = async () => {
      throw new Error('must not resolve');
    };
    await expect(validatePublicHttpsUrl('https://127.0.0.1/', resolver))
      .rejects.toThrow('OUTBOUND_ENDPOINT_NOT_ALLOWED');
  });
});
