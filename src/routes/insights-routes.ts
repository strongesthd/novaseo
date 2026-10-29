import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/async-handler.js';
import { rateLimitProvider } from '../middleware/rate-limit.js';
import { validate } from '../middleware/validate.js';
import { ProjectRepository } from '../repositories/project-repository.js';
import { SeoDataRepository } from '../repositories/seo-data-repository.js';
import { DataForSeoClient, GoogleSearchConsoleClient } from '../providers/seo-data-provider.js';
import { decryptSettings } from '../utils/settings-crypto.js';
import { validatePublicHttpsUrl } from '../utils/safe-http.js';

const router = Router();
const projects = new ProjectRepository();
const snapshots = new SeoDataRepository();
const dataForSeo = new DataForSeoClient();
const searchConsole = new GoogleSearchConsoleClient();

const projectParams = z.object({ projectId: z.string().uuid() });
const keywordsBody = z.object({
  keywords: z.array(z.string().trim().min(1).max(240)).min(1).max(200),
  locationCode: z.number().int().positive().optional(),
  languageCode: z.string().trim().min(2).max(10).optional(),
});

async function loadProject(tenantId: string, projectId: string) {
  const project = await projects.findById(tenantId, projectId);
  if (!project) return undefined;
  return { project, settings: decryptSettings(project.platform_settings || {}).seoData ?? {} };
}

function dataForSeoCredentials(settings: Record<string, unknown>) {
  const credentials = {
    login: typeof settings.dataforseoLogin === 'string' ? settings.dataforseoLogin : '',
    password: typeof settings.dataforseoPassword === 'string' ? settings.dataforseoPassword : '',
  };
  if (!credentials.login.trim() || !credentials.password.trim()) {
    throw Object.assign(new Error('Cấu hình API login/password DataForSEO tại Tích hợp → Dữ liệu SEO nâng cao.'), {
      statusCode: 400,
      code: 'DATAFORSEO_CREDENTIALS_REQUIRED',
    });
  }
  return credentials;
}

function requireSearchConsoleSettings(settings: Record<string, unknown>) {
  const required = ['searchConsoleSiteUrl', 'googleClientId', 'googleClientSecret', 'googleRefreshToken'];
  if (required.some((key) => typeof settings[key] !== 'string' || !(settings[key] as string).trim())) {
    throw Object.assign(new Error('Cấu hình property và OAuth credentials Search Console tại Tích hợp → Dữ liệu SEO nâng cao.'), {
      statusCode: 400,
      code: 'SEARCH_CONSOLE_CREDENTIALS_REQUIRED',
    });
  }
}

function locationCode(settings: Record<string, unknown>, override?: number) {
  if (override !== undefined) return override;
  if (settings.locationCode === undefined || settings.locationCode === '') return 2392;
  const configured = Number(settings.locationCode);
  if (!Number.isInteger(configured) || configured < 1) {
    throw Object.assign(new Error('DataForSEO location code must be a positive integer.'), {
      statusCode: 400,
      code: 'INVALID_LOCATION_CODE',
    });
  }
  return configured;
}

function languageCode(settings: Record<string, unknown>, override?: string) {
  const language = override ?? (typeof settings.languageCode === 'string' ? settings.languageCode : 'vi');
  if (!/^[a-z]{2,3}$/i.test(language)) {
    throw Object.assign(new Error('Language code must be a two- or three-letter ISO code.'), {
      statusCode: 400,
      code: 'INVALID_LANGUAGE_CODE',
    });
  }
  return language.toLowerCase();
}

function normalizeDomain(value: string) {
  const parsed = new URL(value.includes('://') ? value : `https://${value}`);
  if (parsed.username || parsed.password || parsed.hostname.length > 253) {
    throw Object.assign(new Error('Enter a valid website domain.'), { statusCode: 400, code: 'INVALID_DOMAIN' });
  }
  return parsed.hostname;
}

router.get('/:projectId/history', validate({
  params: projectParams,
  query: z.object({
    type: z.enum(['keyword_metrics', 'serp_positions', 'search_console', 'on_page_audit', 'backlinks']).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
}), asyncHandler(async (req, res) => {
  const projectId = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
  const project = await projects.findById(req.tenantId!, projectId);
  if (!project) {
    res.status(404).json({ error: { code: 'PROJECT_NOT_FOUND', message: 'Project was not found.' } });
    return;
  }
  const type = typeof req.query.type === 'string' ? req.query.type : undefined;
  const limit = Number(req.query.limit ?? 20);
  res.status(200).json({ data: await snapshots.list(req.tenantId!, projectId, type, limit) });
}));

router.post('/:projectId/keyword-metrics', rateLimitProvider, validate({
  params: projectParams,
  body: keywordsBody,
}), asyncHandler(async (req, res) => {
  const projectId = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
  const loaded = await loadProject(req.tenantId!, projectId);
  if (!loaded) {
    res.status(404).json({ error: { code: 'PROJECT_NOT_FOUND', message: 'Project was not found.' } });
    return;
  }
  const location = locationCode(loaded.settings, req.body.locationCode);
  const language = languageCode(loaded.settings, req.body.languageCode);
  const metrics = await dataForSeo.keywordMetrics(
    req.body.keywords,
    dataForSeoCredentials(loaded.settings),
    location,
    language,
  );
  const snapshot = await snapshots.create(req.tenantId!, projectId, 'keyword_metrics', 'DataForSEO', { keywords: req.body.keywords, locationCode: location, languageCode: language }, metrics);
  res.status(200).json({ data: snapshot });
}));

router.post('/:projectId/serp-positions', rateLimitProvider, validate({
  params: projectParams,
  body: keywordsBody.extend({
    keywords: z.array(z.string().trim().min(1).max(240)).min(1).max(20),
    domain: z.string().trim().min(1).max(2048).refine((value) => {
      try {
        const url = new URL(value.includes('://') ? value : `https://${value}`);
        return !url.username && !url.password;
      } catch {
        return false;
      }
    }, 'Enter a valid website domain.'),
  }),
}), asyncHandler(async (req, res) => {
  const projectId = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
  const loaded = await loadProject(req.tenantId!, projectId);
  if (!loaded) {
    res.status(404).json({ error: { code: 'PROJECT_NOT_FOUND', message: 'Project was not found.' } });
    return;
  }
  const location = locationCode(loaded.settings, req.body.locationCode);
  const language = languageCode(loaded.settings, req.body.languageCode);
  const domain = normalizeDomain(req.body.domain);
  const positions = await dataForSeo.serpPositions(
    req.body.keywords,
    domain,
    dataForSeoCredentials(loaded.settings),
    location,
    language,
  );
  const snapshot = await snapshots.create(req.tenantId!, projectId, 'serp_positions', 'DataForSEO', { keywords: req.body.keywords, domain, locationCode: location, languageCode: language }, positions);
  res.status(200).json({ data: snapshot });
}));

router.post('/:projectId/search-console', rateLimitProvider, validate({
  params: projectParams,
  body: z.object({
    startDate: z.string().date(),
    endDate: z.string().date(),
    rowLimit: z.number().int().min(1).max(1000).default(1000),
  }),
}), asyncHandler(async (req, res) => {
  const projectId = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
  const loaded = await loadProject(req.tenantId!, projectId);
  if (!loaded) {
    res.status(404).json({ error: { code: 'PROJECT_NOT_FOUND', message: 'Project was not found.' } });
    return;
  }
  if (req.body.startDate > req.body.endDate) {
    res.status(400).json({ error: { code: 'INVALID_DATE_RANGE', message: 'startDate must not be after endDate.' } });
    return;
  }
  const settings = loaded.settings;
  requireSearchConsoleSettings(settings);
  const result = await searchConsole.query({
    siteUrl: typeof settings.searchConsoleSiteUrl === 'string' ? settings.searchConsoleSiteUrl : '',
    clientId: typeof settings.googleClientId === 'string' ? settings.googleClientId : '',
    clientSecret: typeof settings.googleClientSecret === 'string' ? settings.googleClientSecret : '',
    refreshToken: typeof settings.googleRefreshToken === 'string' ? settings.googleRefreshToken : '',
    startDate: req.body.startDate,
    endDate: req.body.endDate,
    rowLimit: req.body.rowLimit,
  });
  const snapshot = await snapshots.create(req.tenantId!, projectId, 'search_console', result.source, { startDate: result.startDate, endDate: result.endDate, siteUrl: result.siteUrl }, result);
  res.status(200).json({ data: snapshot });
}));

router.post('/:projectId/on-page-audit', rateLimitProvider, validate({
  params: projectParams,
  body: z.object({
    url: z.string().url().max(2048).refine((value) => {
      try { return new URL(value).protocol === 'https:'; } catch { return false; }
    }, 'URL must use HTTPS.'),
  }),
}), asyncHandler(async (req, res) => {
  const projectId = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
  const loaded = await loadProject(req.tenantId!, projectId);
  if (!loaded) {
    res.status(404).json({ error: { code: 'PROJECT_NOT_FOUND', message: 'Project was not found.' } });
    return;
  }
  await validatePublicHttpsUrl(req.body.url);
  const result = await dataForSeo.auditPage(req.body.url, dataForSeoCredentials(loaded.settings));
  const snapshot = await snapshots.create(req.tenantId!, projectId, 'on_page_audit', result.source, { url: req.body.url }, result);
  res.status(200).json({ data: snapshot });
}));

router.post('/:projectId/backlinks', rateLimitProvider, validate({
  params: projectParams,
  body: z.object({
    target: z.string().trim().min(1).max(253).refine((value) => {
      try {
        const url = new URL(value.includes('://') ? value : `https://${value}`);
        return !url.username && !url.password;
      } catch {
        return false;
      }
    }, 'Target must be a valid domain or URL.'),
  }),
}), asyncHandler(async (req, res) => {
  const projectId = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
  const loaded = await loadProject(req.tenantId!, projectId);
  if (!loaded) {
    res.status(404).json({ error: { code: 'PROJECT_NOT_FOUND', message: 'Project was not found.' } });
    return;
  }
  const parsedTarget = new URL(req.body.target.includes('://') ? req.body.target : `https://${req.body.target}`);
  await validatePublicHttpsUrl(parsedTarget.toString());
  const result = await dataForSeo.backlinkSummary(parsedTarget.hostname, dataForSeoCredentials(loaded.settings));
  const snapshot = await snapshots.create(req.tenantId!, projectId, 'backlinks', result.source, { target: parsedTarget.hostname }, result);
  res.status(200).json({ data: snapshot });
}));

export default router;
