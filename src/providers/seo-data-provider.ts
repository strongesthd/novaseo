import { JsonResponse, requestJson } from '../utils/safe-http.js';
import { ProviderError } from '../utils/provider-error.js';

type Transport = (url: string, options: {
  method?: string;
  headers?: Record<string, string>;
  body?: string | Record<string, unknown>;
}) => Promise<JsonResponse>;

export type KeywordMetrics = {
  keyword: string;
  volume?: number;
  adCompetition?: number;
  adCompetitionLevel?: string;
  seoDifficulty?: number;
  monthlySearches?: Array<{ year: number; month: number; searches: number }>;
  volumeSource?: string;
  adCompetitionSource?: string;
  seoDifficultySource?: string;
  searchIntent?: string;
  locationCode?: number;
  languageCode?: string;
  source: string;
  retrievedAt: string;
};

function dataForSeoPayload(response: JsonResponse, provider: string): any[] {
  if (!response.ok) {
    throw new ProviderError(`DATAFORSEO_HTTP_${response.status}`, provider, [408, 429, 500, 502, 503, 504].includes(response.status));
  }
  const body = response.data;
  const task = Array.isArray(body?.tasks) ? body.tasks[0] : undefined;
  if (body?.status_code !== 20000 || !task || task.status_code !== 20000) {
    const code = typeof task?.status_code === 'number' ? task.status_code : body?.status_code;
    throw new ProviderError(`DATAFORSEO_${code ?? 'REQUEST_FAILED'}`, provider, false);
  }
  return Array.isArray(task.result) ? task.result : [];
}

function numeric(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function monthlySearchHistory(value: unknown) {
  return Array.isArray(value)
    ? value.flatMap((month: any) => {
      const year = numeric(month.year);
      const monthNumber = numeric(month.month);
      const searches = numeric(month.search_volume);
      return year !== undefined && monthNumber !== undefined && searches !== undefined
        ? [{ year, month: monthNumber, searches }]
        : [];
    })
    : undefined;
}

function competitionIndex(value: unknown) {
  const competition = numeric(value);
  return competition !== undefined && competition <= 1 ? competition * 100 : competition;
}

export class DataForSeoClient {
  constructor(private readonly transport: Transport = (url, options) => requestJson(url, options)) {}

  private async post(path: string, credentials: { login: string; password: string }, body: Record<string, unknown>) {
    if (!credentials.login.trim() || !credentials.password.trim()) {
      throw new ProviderError('DATAFORSEO_CREDENTIALS_REQUIRED', 'dataforseo', false);
    }
    const authorization = Buffer.from(`${credentials.login}:${credentials.password}`).toString('base64');
    const response = await this.transport(`https://api.dataforseo.com/v3/${path}`, {
      method: 'POST',
      headers: { authorization: `Basic ${authorization}` },
      body: JSON.stringify([body]),
    });
    return dataForSeoPayload(response, 'dataforseo');
  }

  async keywordMetrics(
    keywords: string[],
    credentials: { login: string; password: string },
    locationCode: number,
    languageCode: string,
  ): Promise<KeywordMetrics[]> {
    if (!keywords.length || keywords.length > 200) throw new ProviderError('INVALID_KEYWORDS', 'dataforseo', false);
    const common = { keywords, location_code: locationCode, language_code: languageCode };
    const [volumeResults, difficultyResults] = await Promise.all([
      this.post('keywords_data/google_ads/search_volume/live', credentials, common),
      this.post('dataforseo_labs/google/keyword_overview/live', credentials, {
        ...common,
      }),
    ]);

    const byKeyword = new Map<string, KeywordMetrics>();
    const retrievedAt = new Date().toISOString();
    for (const result of volumeResults.flat()) {
      const items = Array.isArray(result.items) ? result.items : [result];
      for (const item of items) {
        if (typeof item.keyword !== 'string') continue;
        const key = item.keyword.toLocaleLowerCase();
        const monthlySearches = monthlySearchHistory(item.monthly_searches);
        byKeyword.set(key, {
          keyword: item.keyword,
          volume: numeric(item.search_volume),
          adCompetition: numeric(item.competition_index),
          adCompetitionLevel: typeof item.competition === 'string'
            ? item.competition
            : typeof item.competition_level === 'string' ? item.competition_level : undefined,
          monthlySearches,
          volumeSource: 'DataForSEO Google Ads Search Volume',
          adCompetitionSource: 'DataForSEO Google Ads Search Volume',
          locationCode,
          languageCode,
          source: 'DataForSEO Google Ads Search Volume',
          retrievedAt,
        });
      }
    }
    for (const result of difficultyResults.flat()) {
      for (const item of Array.isArray(result.items) ? result.items : []) {
        const keyword = item.keyword;
        if (typeof keyword !== 'string') continue;
        const key = keyword.toLocaleLowerCase();
        const existing = byKeyword.get(key) ?? {
          keyword,
          source: 'DataForSEO Labs',
          retrievedAt,
        };
        const info = item.keyword_info ?? {};
        const properties = item.keyword_properties ?? {};
        if (existing.volume === undefined && numeric(info.search_volume) !== undefined) {
          existing.volume = numeric(info.search_volume);
          existing.volumeSource = 'DataForSEO Labs';
        }
        if (existing.monthlySearches === undefined) existing.monthlySearches = monthlySearchHistory(info.monthly_searches);
        if (existing.adCompetition === undefined && numeric(info.competition) !== undefined) {
          existing.adCompetition = competitionIndex(info.competition);
          existing.adCompetitionSource = 'DataForSEO Labs';
        }
        existing.adCompetitionLevel ??= typeof info.competition_level === 'string' ? info.competition_level : undefined;
        existing.seoDifficulty = numeric(properties.keyword_difficulty);
        existing.seoDifficultySource = 'DataForSEO Labs';
        const intent = item.search_intent_info?.main_intent;
        if (typeof intent === 'string') existing.searchIntent = intent;
        existing.locationCode = locationCode;
        existing.languageCode = languageCode;
        byKeyword.set(key, existing);
      }
    }
    return keywords.map((keyword) => byKeyword.get(keyword.toLocaleLowerCase()) ?? {
      keyword,
      source: 'DataForSEO',
      retrievedAt,
    });
  }

  async serpPositions(
    keywords: string[],
    domain: string,
    credentials: { login: string; password: string },
    locationCode: number,
    languageCode: string,
  ) {
    if (!keywords.length || keywords.length > 20) throw new ProviderError('INVALID_KEYWORDS', 'dataforseo', false);
    const results = await Promise.all(keywords.map((keyword) => this.post('serp/google/organic/live/advanced', credentials, {
      keyword,
      location_code: locationCode,
      language_code: languageCode,
      depth: 100,
    })));
    const normalizedDomain = domain.toLowerCase().replace(/^www\./, '');
    const retrievedAt = new Date().toISOString();
    return results.map((taskResults, index) => {
      const result = taskResults[0];
      const items = Array.isArray(result?.items) ? result.items : [];
      const match = items.find((item: any) => item.type === 'organic' &&
        typeof item.domain === 'string' && item.domain.toLowerCase().replace(/^www\./, '') === normalizedDomain);
      return {
        keyword: keywords[index],
        position: numeric(match?.rank_group),
        url: typeof match?.url === 'string' ? match.url : undefined,
        source: 'DataForSEO Google Organic SERP',
        locationCode,
        languageCode,
        retrievedAt,
      };
    });
  }

  async auditPage(url: string, credentials: { login: string; password: string }) {
    const results = await this.post('on_page/instant_pages', credentials, { url });
    const items = results.flatMap((result) => Array.isArray(result.items) ? result.items : []);
    const page = items.find((item: any) => item.type === 'page') ?? items[0];
    if (!page) throw new ProviderError('DATAFORSEO_EMPTY_AUDIT_RESULT', 'dataforseo', false);
    return {
      url,
      statusCode: page.status_code,
      title: page.meta?.title,
      description: page.meta?.description,
      h1: page.meta?.htags?.h1,
      onPageScore: numeric(page.onpage_score),
      checks: page.checks ?? {},
      retrievedAt: new Date().toISOString(),
      source: 'DataForSEO OnPage API',
    };
  }

  async backlinkSummary(target: string, credentials: { login: string; password: string }) {
    const results = await this.post('backlinks/summary/live', credentials, {
      target,
      include_subdomains: true,
      backlinks_status_type: 'all',
    });
    const summary = results.flat()[0];
    if (!summary) throw new ProviderError('DATAFORSEO_EMPTY_BACKLINK_RESULT', 'dataforseo', false);
    return {
      target,
      summary,
      retrievedAt: new Date().toISOString(),
      source: 'DataForSEO Backlinks API',
    };
  }
}

export class GoogleSearchConsoleClient {
  constructor(private readonly transport: Transport = (url, options) => requestJson(url, options)) {}

  async query(input: {
    siteUrl: string;
    startDate: string;
    endDate: string;
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    rowLimit: number;
  }) {
    if (!input.siteUrl || !input.clientId || !input.clientSecret || !input.refreshToken) {
      throw new ProviderError('SEARCH_CONSOLE_CREDENTIALS_REQUIRED', 'google-search-console', false);
    }
    const tokenResponse = await this.transport('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: input.clientId,
        client_secret: input.clientSecret,
        refresh_token: input.refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    });
    if (!tokenResponse.ok || typeof tokenResponse.data?.access_token !== 'string') {
      throw new ProviderError('SEARCH_CONSOLE_AUTH_FAILED', 'google-search-console', tokenResponse.status >= 500);
    }
    const site = encodeURIComponent(input.siteUrl);
    const result = await this.transport(
      `https://www.googleapis.com/webmasters/v3/sites/${site}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${tokenResponse.data.access_token}` },
        body: {
          startDate: input.startDate,
          endDate: input.endDate,
          dimensions: ['query', 'page', 'country', 'device'],
          rowLimit: input.rowLimit,
        },
      },
    );
    if (!result.ok) {
      throw new ProviderError(`SEARCH_CONSOLE_HTTP_${result.status}`, 'google-search-console', [408, 429, 500, 502, 503, 504].includes(result.status));
    }
    return {
      siteUrl: input.siteUrl,
      startDate: input.startDate,
      endDate: input.endDate,
      rows: Array.isArray(result.data?.rows) ? result.data.rows : [],
      retrievedAt: new Date().toISOString(),
      source: 'Google Search Console',
    };
  }
}
