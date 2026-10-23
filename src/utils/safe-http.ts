import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import https from 'node:https';

type ResolvedAddress = { address: string; family: number };
export type JsonResponse = { status: number; ok: boolean; data: any };
export type JsonRequestOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: string | Record<string, unknown>;
  timeoutMs?: number;
  maxResponseBytes?: number;
};
export type HostResolver = (hostname: string) => Promise<ResolvedAddress[]>;

function outboundError(code: string, extra: Record<string, unknown> = {}): Error {
  return Object.assign(new Error(code), { code, ...extra });
}

function parseIpv6(address: string): number[] | undefined {
  let value = address.toLowerCase().split('%')[0];
  if (value.includes('.')) {
    const lastColon = value.lastIndexOf(':');
    const ipv4 = value.slice(lastColon + 1).split('.').map(Number);
    if (ipv4.length !== 4 || ipv4.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return undefined;
    value = `${value.slice(0, lastColon)}:${((ipv4[0] << 8) | ipv4[1]).toString(16)}:${((ipv4[2] << 8) | ipv4[3]).toString(16)}`;
  }
  const halves = value.split('::');
  if (halves.length > 2) return undefined;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves[1] ? halves[1].split(':') : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) return undefined;
  const words = [...left, ...Array(missing).fill('0'), ...right].map((part) => Number.parseInt(part, 16));
  return words.length === 8 && words.every((part) => Number.isInteger(part) && part >= 0 && part <= 0xffff) ? words : undefined;
}

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const [a, b, c] = address.split('.').map(Number);
    return !(
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0 && (c === 0 || c === 2)) ||
      (a === 192 && b === 88 && c === 99) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19 || b === 51 && c === 100)) ||
      (a === 203 && b === 0 && c === 113)
    );
  }
  if (family !== 6) return false;
  const words = parseIpv6(address);
  if (!words) return false;
  if (words.slice(0, 5).every((part) => part === 0) && words[5] === 0xffff) {
    const ipv4 = `${words[6] >> 8}.${words[6] & 255}.${words[7] >> 8}.${words[7] & 255}`;
    return isPublicAddress(ipv4);
  }
  return words[0] >= 0x2000 && words[0] <= 0x3fff &&
    !(words[0] === 0x2001 && (words[1] === 0x0000 || words[1] === 0x0002 ||
      words[1] === 0x0db8 || words[1] === 0x0010 || words[1] === 0x0020)) &&
    !(words[0] === 0x3fff && words[1] < 0x1000) &&
    words[0] !== 0x2002;
}

async function resolvePublicHost(hostname: string, resolver: HostResolver): Promise<ResolvedAddress> {
  if (!hostname || hostname === 'localhost' || isIP(hostname.replace(/^\[|\]$/g, ''))) {
    throw outboundError('OUTBOUND_ENDPOINT_NOT_ALLOWED');
  }
  let addresses: ResolvedAddress[];
  try {
    addresses = await resolver(hostname);
  } catch {
    throw outboundError('OUTBOUND_DNS_LOOKUP_FAILED');
  }
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw outboundError('OUTBOUND_ENDPOINT_NOT_ALLOWED');
  }
  return addresses[0];
}

export async function validatePublicHttpsUrl(endpoint: string, resolver: HostResolver = async (hostname) => dnsLookup(hostname, { all: true, verbatim: true })) {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw outboundError('INVALID_ENDPOINT');
  }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) {
    throw outboundError('OUTBOUND_ENDPOINT_NOT_ALLOWED');
  }
  let dnsTimer: ReturnType<typeof setTimeout> | undefined;
  const address = await Promise.race([
    resolvePublicHost(url.hostname, resolver),
    new Promise<never>((_, reject) => {
      dnsTimer = setTimeout(() => reject(outboundError('OUTBOUND_DNS_LOOKUP_FAILED')), 3_000);
    }),
  ]).finally(() => {
    if (dnsTimer) clearTimeout(dnsTimer);
  });
  return { url, address };
}

export async function requestJson(
  endpoint: string,
  options: JsonRequestOptions = {},
  resolver?: HostResolver,
): Promise<JsonResponse> {
  const { url, address } = await validatePublicHttpsUrl(endpoint, resolver);
  const body = options.body === undefined
    ? undefined
    : typeof options.body === 'string'
      ? options.body
      : JSON.stringify(options.body);
  if (body && Buffer.byteLength(body) > 1_000_000) throw outboundError('OUTBOUND_REQUEST_TOO_LARGE');
  const timeoutMs = options.timeoutMs ?? 10_000;
  const maxResponseBytes = options.maxResponseBytes ?? 1_000_000;
  const agent = new https.Agent({
    keepAlive: false,
    lookup: ((hostname: string, lookupOptions: any, callback: (...args: any[]) => void) => {
      if (hostname !== url.hostname) return callback(new Error('OUTBOUND_HOST_CHANGED'));
      if (lookupOptions?.all) return callback(null, [address]);
      callback(null, address.address, address.family);
    }) as any,
  });

  try {
    return await new Promise<JsonResponse>((resolve, reject) => {
      const request = https.request(url, {
        method: options.method ?? 'POST',
        headers: {
          accept: 'application/json',
          ...(body ? { 'content-type': 'application/json' } : {}),
          ...(body ? { 'content-length': String(Buffer.byteLength(body)) } : {}),
          ...options.headers,
        },
        agent,
      }, (response) => {
        const chunks: Buffer[] = [];
        let size = 0;
        response.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxResponseBytes) {
            request.destroy(outboundError('OUTBOUND_RESPONSE_TOO_LARGE', { outcomeUnknown: true, retryable: true }));
            return;
          }
          chunks.push(chunk);
        });
        response.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let data: any = {};
          const contentType = String(response.headers['content-type'] ?? '').toLowerCase();
          if (raw && contentType.includes('json')) {
            try {
              data = JSON.parse(raw);
            } catch {
              const error = outboundError('OUTBOUND_INVALID_JSON_RESPONSE', { outcomeUnknown: true, retryable: true });
              return reject(error);
            }
          }
          const status = response.statusCode ?? 502;
          resolve({ status, ok: status >= 200 && status < 300, data });
        });
        response.on('error', reject);
      });
      const deadline = setTimeout(() => {
        request.destroy(outboundError('OUTBOUND_TIMEOUT', { outcomeUnknown: true, retryable: true }));
      }, timeoutMs);
      request.on('close', () => clearTimeout(deadline));
      request.setTimeout(timeoutMs, () => request.destroy(outboundError('OUTBOUND_TIMEOUT', { outcomeUnknown: true, retryable: true })));
      request.on('error', reject);
      if (body) request.write(body);
      request.end();
    });
  } catch (error: any) {
    if (error?.message === 'OUTBOUND_TIMEOUT' || error?.message === 'OUTBOUND_RESPONSE_TOO_LARGE' ||
      error?.message === 'OUTBOUND_INVALID_JSON_RESPONSE' || error?.code === 'ECONNRESET' || error?.code === 'EPIPE') {
      error.outcomeUnknown = true;
      error.retryable = true;
    }
    throw error;
  } finally {
    agent.destroy();
  }
}
