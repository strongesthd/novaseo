import { createHash, createHmac, createSign } from 'node:crypto';
import {
  Indexer,
  IndexingEngine,
  IndexResult,
  KeywordMiner,
  KeywordRecord,
  MiningPlatform,
  Publisher,
  PublishingPlatform,
  PublishResult,
} from './contracts/index.js';
import { ProviderError } from '../utils/provider-error.js';
import { HostResolver, JsonResponse, requestJson, validatePublicHttpsUrl } from '../utils/safe-http.js';

type Transport = (url: string, options: {
  method?: string;
  headers?: Record<string, string>;
  body?: string | Record<string, unknown>;
}) => Promise<JsonResponse>;

const sourceNames: Record<MiningPlatform, string> = {
  google: 'Google',
  shopee: 'Shopee',
  lazada: 'Lazada',
  tiktok: 'TikTok Search',
  youtube: 'YouTube',
};

function retryableStatus(status: number): boolean {
  return [408, 429, 500, 502, 503, 504].includes(status);
}

function failHttp(status: number, platform: string): never {
  throw new ProviderError(`HTTP_${status}`, platform, retryableStatus(status));
}

function requiredString(value: unknown, code: string, platform: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new ProviderError(code, platform, false);
  return value.trim();
}

export function isSerpApiEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.protocol === 'https:' &&
      url.hostname === 'serpapi.com' &&
      ['/search', '/search.json'].includes(url.pathname);
  } catch {
    return false;
  }
}

export class GenericKeywordMiner implements KeywordMiner {
  constructor(
    public readonly platform: MiningPlatform,
    private readonly transport: Transport = (url, options) => requestJson(url, options),
  ) {}

  async mine(input: {
    seeds: string[];
    locale: string;
    country: string;
    limit: number;
    credentials?: Record<string, unknown>;
  }): Promise<KeywordRecord[]> {
    if (!input.seeds.length) throw new ProviderError('SEEDS_REQUIRED', this.platform, false);
    if (input.seeds.length > 20 || input.seeds.some((seed) => !seed.trim() || seed.length > 120)) {
      throw new ProviderError('INVALID_SEEDS', this.platform, false);
    }
    const endpoint = input.credentials?.miningEndpoint;
    if (typeof endpoint !== 'string' || !endpoint) {
      throw new ProviderError('MINING_PROVIDER_NOT_CONFIGURED', this.platform, false);
    }
    const apiKey = input.credentials?.apiKey;
    if (isSerpApiEndpoint(endpoint)) {
      if (this.platform !== 'google') throw new ProviderError('SERPAPI_GOOGLE_AUTOCOMPLETE_ONLY', this.platform, false);
      if (typeof apiKey !== 'string' || !apiKey.trim()) throw new ProviderError('SERPAPI_API_KEY_REQUIRED', this.platform, false);

      const records: KeywordRecord[] = [];
      for (const seed of input.seeds) {
        const url = new URL('https://serpapi.com/search.json');
        url.searchParams.set('engine', 'google_autocomplete');
        url.searchParams.set('q', seed);
        url.searchParams.set('api_key', apiKey);
        url.searchParams.set('gl', input.country.toLowerCase());
        url.searchParams.set('hl', input.locale.split('-')[0].toLowerCase());
        const response = await this.transport(url.toString(), { method: 'GET' });
        if (!response.ok) failHttp(response.status, this.platform);
        if (typeof response.data?.error === 'string') {
          throw new ProviderError('SERPAPI_REQUEST_FAILED', this.platform, false);
        }
        if (!Array.isArray(response.data?.suggestions)) {
          throw new ProviderError('MINING_INVALID_RESPONSE', this.platform, false);
        }
        for (const item of response.data.suggestions) {
          if (typeof item?.value !== 'string' || !item.value.trim()) continue;
          records.push({
            keyword: item.value.trim().slice(0, 240),
            platform: this.platform,
            source: 'Google Autocomplete via SerpApi',
            locale: input.locale,
            country: input.country,
            suggestions: [],
            metadata: { provider: 'serpapi-google-autocomplete' },
          });
          if (records.length >= input.limit) return records;
        }
      }
      return records;
    }

    const response = await this.transport(endpoint, {
      method: 'POST',
      headers: typeof apiKey === 'string' ? { authorization: `Bearer ${apiKey}` } : undefined,
      body: {
        platform: this.platform,
        seeds: input.seeds,
        locale: input.locale,
        country: input.country,
        limit: input.limit,
      },
    });
    if (!response.ok) failHttp(response.status, this.platform);
    const items = Array.isArray(response.data) ? response.data : response.data?.records;
    if (!Array.isArray(items)) throw new ProviderError('MINING_INVALID_RESPONSE', this.platform, false);
    return items.slice(0, input.limit).flatMap((item: any) => {
      if (typeof item?.keyword !== 'string' || !item.keyword.trim()) return [];
      return [{
        keyword: item.keyword.trim().slice(0, 240),
        platform: this.platform,
        source: sourceNames[this.platform],
        locale: input.locale,
        country: input.country,
        volume: Number.isFinite(item.volume) && item.volume >= 0 ? item.volume : undefined,
        competition: Number.isFinite(item.competition) && item.competition >= 0 && item.competition <= 1 ? item.competition : undefined,
        suggestions: Array.isArray(item.suggestions)
          ? item.suggestions.filter((value: unknown): value is string => typeof value === 'string').slice(0, 20)
          : [],
        metadata: { provider: 'configured-endpoint' },
      }];
    });
  }
}

export class HttpPublisher implements Publisher {
  constructor(
    public readonly platform: PublishingPlatform,
    private readonly transport: Transport = (url, options) => requestJson(url, options),
  ) {}

  async publish(input: {
    title: string;
    html?: string;
    markdown?: string;
    slug?: string;
    payload?: Record<string, unknown>;
    credentials?: Record<string, unknown>;
    idempotencyKey?: string;
  }): Promise<PublishResult> {
    const credentials = input.credentials ?? {};
    const content = input.html ?? input.markdown ?? '';

    if (this.platform === 'tiktok' || this.platform === 'youtube') {
      throw new ProviderError('PLATFORM_INTEGRATION_NOT_CONFIGURED', this.platform, false);
    }

    let endpoint: string;
    let headers: Record<string, string> = {};
    let body: Record<string, unknown>;
    if (this.platform === 'wordpress') {
      const siteUrl = requiredString(credentials.siteUrl, 'CREDENTIALS_REQUIRED', this.platform).replace(/\/+$/, '');
      const username = requiredString(credentials.username, 'CREDENTIALS_REQUIRED', this.platform);
      const appPassword = requiredString(credentials.appPassword, 'CREDENTIALS_REQUIRED', this.platform);
      endpoint = `${siteUrl}/wp-json/wp/v2/posts`;
      headers.authorization = `Basic ${Buffer.from(`${username}:${appPassword}`).toString('base64')}`;
      body = {
        title: input.title,
        content,
        slug: input.slug,
        status: credentials.visibility === 'draft' ? 'draft' : credentials.visibility === 'private' ? 'private' : 'publish',
      };
    } else if (this.platform === 'shopify') {
      const storeUrl = requiredString(credentials.storeUrl, 'CREDENTIALS_REQUIRED', this.platform).replace(/\/+$/, '');
      const token = requiredString(credentials.accessToken, 'CREDENTIALS_REQUIRED', this.platform);
      const blogId = requiredString(credentials.blogId, 'CREDENTIALS_REQUIRED', this.platform);
      const apiVersion = requiredString(credentials.apiVersion, 'SHOPIFY_API_VERSION_REQUIRED', this.platform);
      const blogHandle = requiredString(credentials.blogHandle, 'SHOPIFY_BLOG_HANDLE_REQUIRED', this.platform);
      if (!/^\d{4}-\d{2}$/.test(apiVersion) || !/^\d+$/.test(blogId)) {
        throw new ProviderError('SHOPIFY_CONFIGURATION_INVALID', this.platform, false);
      }
      const storeHost = new URL(storeUrl).hostname;
      if (storeHost !== 'myshopify.com' && !storeHost.endsWith('.myshopify.com')) {
        throw new ProviderError('SHOPIFY_STORE_DOMAIN_INVALID', this.platform, false);
      }
      endpoint = `${storeUrl}/admin/api/${apiVersion}/blogs/${blogId}/articles.json`;
      headers['x-shopify-access-token'] = token;
      body = {
        article: {
          title: input.title,
          body_html: content,
          handle: input.slug,
          published: credentials.visibility === 'public',
        },
      };
    } else {
      endpoint = requiredString(credentials.url, 'CREDENTIALS_REQUIRED', this.platform);
      if (credentials.visibility !== undefined && credentials.visibility !== 'public') {
        throw new ProviderError('WEBHOOK_PUBLIC_VISIBILITY_REQUIRED', this.platform, false);
      }
      body = {
        contentId: typeof input.payload?.contentId === 'string' ? input.payload.contentId : '',
        title: input.title,
        seoTitle: typeof input.payload?.seoTitle === 'string' ? input.payload.seoTitle : input.title,
        metaDescription: typeof input.payload?.metaDescription === 'string' ? input.payload.metaDescription : '',
        focusKeyword: typeof input.payload?.focusKeyword === 'string' ? input.payload.focusKeyword : '',
        secondaryKeywords: typeof input.payload?.secondaryKeywords === 'string' ? input.payload.secondaryKeywords : '',
        content: content || (typeof input.payload?.content === 'string' ? input.payload.content : ''),
        slug: input.slug,
        platform: this.platform,
        visibility: credentials.visibility ?? 'public',
      };
      const secret = credentials.secret;
      if (typeof secret === 'string' && secret) {
        headers['x-novaseo-signature'] = createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');
      }
      if (input.idempotencyKey) headers['idempotency-key'] = input.idempotencyKey;
    }

    const response = await this.transport(endpoint, { method: 'POST', headers, body });
    if (!response.ok) failHttp(response.status, this.platform);
    const article = response.data?.article ?? response.data;
    const externalId = article?.id == null
      ? createHash('sha256').update(`${this.platform}:${endpoint}:${input.idempotencyKey ?? input.title}`).digest('hex')
      : String(article.id);
    const externalUrl = this.platform === 'shopify'
      ? `${new URL(endpoint).origin}/blogs/${encodeURIComponent(String(credentials.blogHandle))}/${encodeURIComponent(String(article?.handle ?? input.slug ?? ''))}`
      : typeof article?.link === 'string'
        ? article.link
        : typeof article?.url === 'string'
          ? article.url
          : undefined;
    return { externalId, externalUrl, responseData: { status: response.status } };
  }
}

export class HttpIndexer implements Indexer {
  constructor(
    public readonly engine: IndexingEngine,
    private readonly transport: Transport = (url, options) => requestJson(url, options),
    private readonly resolver?: HostResolver,
  ) {}

  async submit(urls: string[], credentials?: Record<string, unknown>): Promise<IndexResult> {
    if (!urls.length) throw new ProviderError('URLS_REQUIRED', this.engine, false);
    if (urls.length > 100) throw new ProviderError('TOO_MANY_URLS', this.engine, false);
    for (const url of urls) await validatePublicHttpsUrl(url, this.resolver);

    if (this.engine === 'indexnow') {
      const key = requiredString(credentials?.apiKey, 'INDEXNOW_NOT_CONFIGURED', this.engine);
      const keyLocation = requiredString(credentials?.keyLocation, 'INDEXNOW_NOT_CONFIGURED', this.engine);
      const { url: first } = await validatePublicHttpsUrl(urls[0], this.resolver);
      const { url: keyFile } = await validatePublicHttpsUrl(keyLocation, this.resolver);
      if (first.hostname !== keyFile.hostname) throw new ProviderError('INDEXNOW_KEY_HOST_MISMATCH', this.engine, false);
      const response = await this.transport('https://api.indexnow.org/indexnow', {
        method: 'POST',
        body: { host: first.hostname, key, keyLocation, urlList: urls },
      });
      if (![200, 202].includes(response.status)) failHttp(response.status, this.engine);
      return { engine: this.engine, accepted: true, responseData: { status: response.status } };
    }

    const clientEmail = requiredString(credentials?.clientEmail, 'GOOGLE_INDEXING_NOT_CONFIGURED', this.engine);
    const privateKey = requiredString(credentials?.privateKey, 'GOOGLE_INDEXING_NOT_CONFIGURED', this.engine).replace(/\\n/g, '\n');
    const now = Math.floor(Date.now() / 1000);
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
      iss: clientEmail,
      scope: 'https://www.googleapis.com/auth/indexing',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })}`;
    const signer = createSign('RSA-SHA256');
    signer.update(unsigned);
    const assertion = `${unsigned}.${signer.sign(privateKey, 'base64url')}`;
    const tokenResponse = await this.transport('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }).toString(),
    });
    if (!tokenResponse.ok || typeof tokenResponse.data?.access_token !== 'string') {
      failHttp(tokenResponse.status, this.engine);
    }

    const results = await Promise.all(urls.map(async (url) => {
      const response = await this.transport('https://indexing.googleapis.com/v3/urlNotifications:publish', {
        method: 'POST',
        headers: { authorization: `Bearer ${tokenResponse.data.access_token}` },
        body: { url, type: 'URL_UPDATED' },
      });
      if (!response.ok) failHttp(response.status, this.engine);
      return { status: response.status };
    }));
    return { engine: this.engine, accepted: true, responseData: { notifications: results.length } };
  }
}
