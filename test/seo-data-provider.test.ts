import { describe, expect, it, vi } from 'vitest';
import { DataForSeoClient, GoogleSearchConsoleClient } from '../src/providers/seo-data-provider.js';

const ok = (data: unknown) => ({ status: 200, ok: true, data });

describe('DataForSeoClient', () => {
  it('combines monthly volume, ad competition, and SEO difficulty without conflating them', async () => {
    const transport = vi.fn()
      .mockResolvedValueOnce(ok({
        status_code: 20000,
        tasks: [{
          status_code: 20000,
          result: [{
            keyword: 'cà phê',
            search_volume: 1200,
            competition: 'HIGH',
            competition_index: 84,
            monthly_searches: [{ year: 2026, month: 8, search_volume: 1300 }],
          }],
        }],
      }))
      .mockResolvedValueOnce(ok({
        status_code: 20000,
        tasks: [{
          status_code: 20000,
          result: [{
            items: [{
              keyword: 'cà phê',
              keyword_info: { search_volume: 1200, competition: 0.84, competition_level: 'HIGH' },
              keyword_properties: { keyword_difficulty: 63 },
            }],
          }],
        }],
      }));
    const client = new DataForSeoClient(transport);

    const metrics = await client.keywordMetrics(['cà phê'], { login: 'user', password: 'pass' }, 2392, 'vi');

    expect(metrics[0]).toMatchObject({
      keyword: 'cà phê',
      volume: 1200,
      adCompetition: 84,
      adCompetitionLevel: 'HIGH',
      seoDifficulty: 63,
      monthlySearches: [{ year: 2026, month: 8, searches: 1300 }],
      source: 'DataForSEO Google Ads Search Volume',
    });
    expect(transport).toHaveBeenCalledTimes(2);
    expect(transport.mock.calls[0][0]).toContain('/keywords_data/google_ads/search_volume/live');
    expect(transport.mock.calls[1][0]).toContain('/dataforseo_labs/google/keyword_overview/live');
    const labsRequest = JSON.parse(String(transport.mock.calls[1][1].body))[0];
    expect(labsRequest).toMatchObject({
      location_code: 2392,
      language_code: 'vi',
      keywords: ['cà phê'],
    });
    expect(labsRequest).not.toHaveProperty('language_name');
  });

  it('returns available volume metrics and warns when the difficulty endpoint rejects its request', async () => {
    const transport = vi.fn()
      .mockResolvedValueOnce(ok({
        status_code: 20000,
        tasks: [{
          status_code: 20000,
          result: [{ keyword: 'cà phê', search_volume: 1200, competition_index: 84 }],
        }],
      }))
      .mockResolvedValueOnce(ok({
        status_code: 20000,
        tasks: [{ status_code: 40501, status_message: "Invalid Field: 'language_code'.", result: null }],
      }));
    const client = new DataForSeoClient(transport);

    await expect(client.keywordMetrics(['cà phê'], { login: 'user', password: 'pass' }, 2392, 'vi'))
      .resolves.toMatchObject([{
        keyword: 'cà phê',
        volume: 1200,
        adCompetition: 84,
        warnings: ['SEO difficulty unavailable: DATAFORSEO_40501'],
      }]);
  });

  it('normalizes Labs competition to the same 0-100 scale when volume data is missing', async () => {
    const transport = vi.fn()
      .mockResolvedValueOnce(ok({ status_code: 20000, tasks: [{ status_code: 20000, result: [] }] }))
      .mockResolvedValueOnce(ok({
        status_code: 20000,
        tasks: [{
          status_code: 20000,
          result: [{
            items: [{
              keyword: 'seo',
              keyword_info: { search_volume: 40, competition: 0.84, competition_level: 'HIGH' },
              keyword_properties: { keyword_difficulty: 22 },
            }],
          }],
        }],
      }));
    const client = new DataForSeoClient(transport);

    await expect(client.keywordMetrics(['seo'], { login: 'user', password: 'pass' }, 2392, 'vi'))
      .resolves.toMatchObject([{
        volume: 40,
        volumeSource: 'DataForSEO Labs',
        adCompetition: 84,
        adCompetitionSource: 'DataForSEO Labs',
        seoDifficulty: 22,
      }]);
  });

  it('matches organic SERP positions for the requested domain', async () => {
    const transport = vi.fn().mockResolvedValue(ok({
      status_code: 20000,
      tasks: [{
        status_code: 20000,
        result: [{
          items: [
            { type: 'organic', domain: 'other.vn', rank_group: 1, url: 'https://other.vn/' },
            { type: 'organic', domain: 'www.example.vn', rank_group: 2, url: 'https://www.example.vn/page' },
          ],
        }],
      }],
    }));
    const client = new DataForSeoClient(transport);

    const result = await client.serpPositions(['seo'], 'example.vn', { login: 'user', password: 'pass' }, 2392, 'vi');

    expect(result[0]).toMatchObject({ keyword: 'seo', position: 2, url: 'https://www.example.vn/page' });
  });

  it('rejects missing credentials before making a provider request', async () => {
    const transport = vi.fn();
    const client = new DataForSeoClient(transport);
    await expect(client.keywordMetrics(['seo'], { login: '', password: '' }, 2392, 'vi'))
      .rejects.toMatchObject({ code: 'DATAFORSEO_CREDENTIALS_REQUIRED' });
    expect(transport).not.toHaveBeenCalled();
  });

  it('marks provider rate limits as retryable', async () => {
    const transport = vi.fn().mockResolvedValue({ status: 429, ok: false, data: {} });
    const client = new DataForSeoClient(transport);

    await expect(client.keywordMetrics(['seo'], { login: 'user', password: 'pass' }, 2392, 'vi'))
      .rejects.toMatchObject({ code: 'DATAFORSEO_HTTP_429', retryable: true });
  });

  it('maps on-page audit and backlink summary data', async () => {
    const transport = vi.fn()
      .mockResolvedValueOnce(ok({
        status_code: 20000,
        tasks: [{
          status_code: 20000,
          result: [{
            items: [{
              type: 'page',
              status_code: 200,
              onpage_score: 92,
              meta: { title: 'SEO page', description: 'Page description', htags: { h1: ['SEO'] } },
              checks: { title_exists: true },
            }],
          }],
        }],
      }))
      .mockResolvedValueOnce(ok({
        status_code: 20000,
        tasks: [{
          status_code: 20000,
          result: [{ target: 'example.vn', backlinks: 123, referring_domains: 45 }],
        }],
      }));
    const client = new DataForSeoClient(transport);

    const audit = await client.auditPage('https://example.vn/', { login: 'user', password: 'pass' });
    const backlinks = await client.backlinkSummary('example.vn', { login: 'user', password: 'pass' });

    expect(audit).toMatchObject({ statusCode: 200, onPageScore: 92, title: 'SEO page' });
    expect(backlinks.summary).toMatchObject({ target: 'example.vn', backlinks: 123, referring_domains: 45 });
  });
});

describe('GoogleSearchConsoleClient', () => {
  it('refreshes OAuth access and queries search analytics', async () => {
    const transport = vi.fn()
      .mockResolvedValueOnce(ok({ access_token: 'access-token' }))
      .mockResolvedValueOnce(ok({ rows: [{ keys: ['seo', 'https://example.vn/'], clicks: 4, impressions: 80, ctr: 0.05, position: 3.2 }] }));
    const client = new GoogleSearchConsoleClient(transport);

    const result = await client.query({
      siteUrl: 'sc-domain:example.vn',
      startDate: '2026-10-01',
      endDate: '2026-10-28',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      refreshToken: 'refresh-token',
      rowLimit: 100,
    });

    expect(result.rows).toHaveLength(1);
    expect(transport.mock.calls[0][0]).toBe('https://oauth2.googleapis.com/token');
    expect(transport.mock.calls[1][0]).toContain('/sites/sc-domain%3Aexample.vn/searchAnalytics/query');
    expect(transport.mock.calls[1][1].headers).toMatchObject({ authorization: 'Bearer access-token' });
  });

  it('reports an invalid refresh token without exposing provider response details', async () => {
    const transport = vi.fn().mockResolvedValue({ status: 400, ok: false, data: { error: 'invalid_grant' } });
    const client = new GoogleSearchConsoleClient(transport);

    await expect(client.query({
      siteUrl: 'sc-domain:example.vn',
      startDate: '2026-10-01',
      endDate: '2026-10-28',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      refreshToken: 'invalid-refresh-token',
      rowLimit: 100,
    })).rejects.toMatchObject({ code: 'SEARCH_CONSOLE_AUTH_FAILED' });
  });
});
