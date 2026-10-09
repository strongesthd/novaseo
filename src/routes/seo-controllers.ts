import { Request, Response, NextFunction } from 'express';
import { KeywordMiningService } from '../services/keyword-mining-service-v2.js';
import { ContentOrchestrationService } from '../services/content-orchestration-service.js';
import { PublishingOrchestrationService } from '../services/publishing-orchestration-service.js';

const tenantId = (request: Request) => String((request as any).tenantId ?? request.header('X-Tenant-Id') ?? '');
const required = (value: unknown, name: string) => { if (typeof value !== 'string' || !value.trim()) { const error = new Error(`${name} is required`); (error as any).statusCode = 400; throw error; } return value; };

export const createSeoControllers = (dependencies: { mining?: KeywordMiningService; generation?: ContentOrchestrationService; publishing?: PublishingOrchestrationService } = {}) => {
  const mining = dependencies.mining ?? new KeywordMiningService();
  const generation = dependencies.generation ?? new ContentOrchestrationService();
  const publishing = dependencies.publishing ?? new PublishingOrchestrationService();
  return {
    mine: async (request: Request, response: Response, next: NextFunction) => { try { const body = request.body ?? {}; const result = await mining.mine({ tenantId: required(tenantId(request), 'tenantId'), projectId: required(body.projectId, 'projectId'), platform: required(body.platform, 'platform'), seedKeywords: Array.isArray(body.seedKeywords) ? body.seedKeywords : [], locale: body.locale, country: body.country, limit: body.limit }); response.status(201).json({ data: { jobId: result.jobId, status: 'completed', platform: body.platform, records: result.records } }); } catch (error) { next(error); } },
    generate: async (request: Request, response: Response, next: NextFunction) => { try { const result = await generation.generate({ ...request.body, tenantId: required(tenantId(request), 'tenantId') }); response.status(201).json({ data: { jobId: result.id, status: 'completed', result } }); } catch (error) { next(error); } },
    publish: async (request: Request, response: Response, next: NextFunction) => { try { const body = request.body ?? {}; const targets = Array.isArray(body.targetPlatforms) ? body.targetPlatforms.map((platform: any) => ({ platform })) : []; const result = await publishing.publish({ ...body, targets, tenantId: required(tenantId(request), 'tenantId'), idempotencyKey: request.header('Idempotency-Key') ?? `${body.contentId}:${targets.map((target: any) => target.platform).join(',')}` }); response.status(201).json({ data: { jobId: crypto.randomUUID(), status: 'completed', results: result.results } }); } catch (error) { next(error); } },
  };
};
