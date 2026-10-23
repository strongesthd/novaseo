import { describe, expect, it, vi } from 'vitest';
import { createHmac, generateKeyPairSync, verify } from 'node:crypto';
import { GenericKeywordMiner, HttpIndexer, HttpPublisher } from '../src/providers/adapters.js';
import { JsonResponse } from '../src/utils/safe-http.js';

const success = (data: unknown = {}) => ({ status: 200, ok: true, data }) satisfies JsonResponse;

describe('GenericKeywordMiner', () => {
  it('does not fabricate metrics or suggestions when no mining provider is configured', async () => {
    const miner = new GenericKeywordMiner('google');
    await expect(miner.mine({ seeds: ['seo'], locale: 'en-US', country: 'US', limit: 10 }))
      .rejects.toMatchObject({ code: 'MINING_PROVIDER_NOT_CONFIGURED', retryable: false });
  });

  it('normalizes results returned by the configured provider', async () => {
    const transport = vi.fn(async () => success({ records: [
      { keyword: '  keyword research  ', volume: 120, competition: 0.4, suggestions: ['related'] },
      { keyword: '   ' },
    ] }));
    const miner = new GenericKeywordMiner('google', transport);
    const records = await miner.mine({
      seeds: ['keyword research'],
      locale: 'en-US',
      country: 'US',
      limit: 10,
      credentials: { miningEndpoint: 'https://provider.example/api', apiKey: 'private' },
    });
    expect(transport).toHaveBeenCalledWith('https://provider.example/api', expect.objectContaining({
      headers: { authorization: 'Bearer private' },
      body: expect.objectContaining({ platform: 'google', limit: 10 }),
    }));
    expect(records).toEqual([expect.objectContaining({
      keyword: 'keyword research',
      platform: 'google',
      volume: 120,
      competition: 0.4,
      suggestions: ['related'],
    })]);
  });

  it('rejects invalid seed limits before calling a provider', async () => {
    const transport = vi.fn();
    const miner = new GenericKeywordMiner('google', transport);
    await expect(miner.mine({
      seeds: Array(21).fill('seed'),
      locale: 'vi-VN',
      country: 'VN',
      limit: 10,
      credentials: { miningEndpoint: 'https://provider.example/api' },
    })).rejects.toMatchObject({ code: 'INVALID_SEEDS' });
    expect(transport).not.toHaveBeenCalled();
  });
});

describe('HttpPublisher', () => {
  it('fails closed when credentials are missing', async () => {
    const publisher = new HttpPublisher('wordpress');
    await expect(publisher.publish({ title: 'Test' })).rejects.toMatchObject({ code: 'CREDENTIALS_REQUIRED', retryable: false });
  });

  it('maps WordPress credentials and post fields to the REST API', async () => {
    const transport = vi.fn(async () => success({ id: 42, link: 'https://blog.example/posts/42' }));
    const publisher = new HttpPublisher('wordpress', transport);
    const result = await publisher.publish({
      title: 'Post title',
      html: '<p>Body</p>',
      slug: 'post-title',
      credentials: { siteUrl: 'https://blog.example', username: 'editor', appPassword: 'app-password', visibility: 'private' },
    });
    expect(transport).toHaveBeenCalledWith('https://blog.example/wp-json/wp/v2/posts', expect.objectContaining({
      headers: { authorization: `Basic ${Buffer.from('editor:app-password').toString('base64')}` },
      body: { title: 'Post title', content: '<p>Body</p>', slug: 'post-title', status: 'private' },
    }));
    expect(result).toMatchObject({ externalId: '42', externalUrl: 'https://blog.example/posts/42' });
  });

  it('maps Shopify articles and rejects non-MyShopify credential destinations', async () => {
    const transport = vi.fn(async () => success({ article: { id: 7, handle: 'article-handle' } }));
    const publisher = new HttpPublisher('shopify', transport);
    const result = await publisher.publish({
      title: 'Article',
      html: '<p>Body</p>',
      slug: 'article',
      credentials: {
        storeUrl: 'https://shop.myshopify.com',
        accessToken: 'token',
        apiVersion: '2026-01',
        blogId: '12',
        blogHandle: 'news',
        visibility: 'public',
      },
    });
    expect(transport).toHaveBeenCalledWith(
      'https://shop.myshopify.com/admin/api/2026-01/blogs/12/articles.json',
      expect.objectContaining({
        headers: { 'x-shopify-access-token': 'token' },
        body: { article: { title: 'Article', body_html: '<p>Body</p>', handle: 'article', published: true } },
      }),
    );
    expect(result.externalUrl).toBe('https://shop.myshopify.com/blogs/news/article-handle');
    await expect(publisher.publish({
      title: 'Article',
      credentials: {
        storeUrl: 'https://attacker.example',
        accessToken: 'token',
        apiVersion: '2026-01',
        blogId: '12',
        blogHandle: 'news',
      },
    })).rejects.toMatchObject({ code: 'SHOPIFY_STORE_DOMAIN_INVALID' });
  });

  it('signs webhook payloads and passes idempotency through', async () => {
    const transport = vi.fn(async (
      _url: string,
      _options: { method?: string; headers?: Record<string, string>; body?: string | Record<string, unknown> },
    ) => success({ accepted: true }));
    const publisher = new HttpPublisher('webhook', transport);
    await publisher.publish({
      title: 'Post title',
      html: '<p>Body</p>',
      slug: 'post-title',
      payload: {
        contentId: '8aa0e6d2-53e1-4fb3-a91a-0c91ecf546c7',
        seoTitle: 'SEO title',
        metaDescription: 'SEO description',
        focusKeyword: 'primary keyword',
        secondaryKeywords: 'related keyword',
      },
      credentials: { url: 'https://hooks.example/publish', secret: 'secret' },
      idempotencyKey: 'request-123',
    });
    const call = transport.mock.calls.at(0);
    expect(call).toBeDefined();
    if (!call) throw new Error('Expected webhook transport call.');
    const [, options] = call;
    const body = options.body as Record<string, unknown>;
    expect(body).toMatchObject({
      contentId: '8aa0e6d2-53e1-4fb3-a91a-0c91ecf546c7',
      title: 'Post title',
      seoTitle: 'SEO title',
      metaDescription: 'SEO description',
      focusKeyword: 'primary keyword',
      secondaryKeywords: 'related keyword',
      content: '<p>Body</p>',
      slug: 'post-title',
      platform: 'webhook',
      visibility: 'public',
    });
    expect(Object.keys(body).sort()).toEqual([
      'contentId',
      'content',
      'focusKeyword',
      'metaDescription',
      'platform',
      'secondaryKeywords',
      'seoTitle',
      'slug',
      'title',
      'visibility',
    ].sort());
    expect(options.headers).toMatchObject({
      'x-novaseo-signature': createHmac('sha256', 'secret').update(JSON.stringify(body)).digest('hex'),
      'idempotency-key': 'request-123',
    });
  });

  it('does not send non-public content to a public-only webhook', async () => {
    const transport = vi.fn(async (
      _url: string,
      _options: { method?: string; headers?: Record<string, string>; body?: string | Record<string, unknown> },
    ) => success());
    const publisher = new HttpPublisher('webhook', transport);
    await expect(publisher.publish({
      title: 'Private draft',
      credentials: { url: 'https://hooks.example/publish', visibility: 'draft' },
    })).rejects.toMatchObject({ code: 'WEBHOOK_PUBLIC_VISIBILITY_REQUIRED' });
    expect(transport).not.toHaveBeenCalled();
  });

  it('does not claim unsupported video platforms were published', async () => {
    const publisher = new HttpPublisher('youtube');
    await expect(publisher.publish({ title: 'Test' }))
      .rejects.toMatchObject({ code: 'PLATFORM_INTEGRATION_NOT_CONFIGURED' });
  });

  it('marks provider throttling as retryable', async () => {
    const publisher = new HttpPublisher('webhook', async () => ({ status: 429, ok: false, data: {} }));
    await expect(publisher.publish({ title: 'Test', credentials: { url: 'https://hooks.example' } }))
      .rejects.toMatchObject({ code: 'HTTP_429', retryable: true });
  });
});

describe('HttpIndexer', () => {
  const resolver = async () => [{ address: '93.184.216.34', family: 4 }];

  it('submits to IndexNow with host and key-location verification', async () => {
    const transport = vi.fn(async () => ({ status: 202, ok: true, data: {} }));
    const indexer = new HttpIndexer('indexnow', transport, resolver);
    await expect(indexer.submit(['https://site.example/article'], {
      apiKey: 'key',
      keyLocation: 'https://site.example/key.txt',
    })).resolves.toMatchObject({ engine: 'indexnow', accepted: true });
    expect(transport).toHaveBeenCalledWith('https://api.indexnow.org/indexnow', expect.objectContaining({
      body: expect.objectContaining({ host: 'site.example', key: 'key', urlList: ['https://site.example/article'] }),
    }));
  });

  it('rejects an IndexNow key file hosted on another domain', async () => {
    const transport = vi.fn();
    const indexer = new HttpIndexer('indexnow', transport, resolver);
    await expect(indexer.submit(['https://site.example/article'], {
      apiKey: 'key',
      keyLocation: 'https://attacker.example/key.txt',
    })).rejects.toMatchObject({ code: 'INDEXNOW_KEY_HOST_MISMATCH' });
    expect(transport).not.toHaveBeenCalled();
  });

  it('requires real credentials rather than returning a fake accepted status', async () => {
    const indexer = new HttpIndexer('google', vi.fn(), resolver);
    await expect(indexer.submit(['https://site.example/article']))
      .rejects.toMatchObject({ code: 'GOOGLE_INDEXING_NOT_CONFIGURED' });
  });

  it('signs a Google service-account assertion and submits URL notifications', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const publicPem = publicKey.export({ type: 'spki', format: 'pem' });
    const transport = vi.fn()
      .mockResolvedValueOnce({ status: 200, ok: true, data: { access_token: 'access-token' } })
      .mockResolvedValueOnce({ status: 200, ok: true, data: {} });
    const indexer = new HttpIndexer('google', transport, resolver);
    await expect(indexer.submit(['https://site.example/article'], {
      clientEmail: 'service@example.iam.gserviceaccount.com',
      privateKey: privatePem,
    })).resolves.toMatchObject({ engine: 'google', accepted: true });
    const tokenBody = new URLSearchParams(transport.mock.calls[0][1].body as string);
    const assertion = tokenBody.get('assertion')!;
    const [header, claims, signature] = assertion.split('.');
    expect(verify('RSA-SHA256', Buffer.from(`${header}.${claims}`), publicPem, Buffer.from(signature, 'base64url'))).toBe(true);
    expect(transport.mock.calls[1][0]).toBe('https://indexing.googleapis.com/v3/urlNotifications:publish');
    expect(transport.mock.calls[1][1]).toMatchObject({
      headers: { authorization: 'Bearer access-token' },
      body: { url: 'https://site.example/article', type: 'URL_UPDATED' },
    });
  });
});
