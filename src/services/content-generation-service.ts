import { ContentRepository } from '../repositories/content-repository.js';
import { ClusterRepository } from '../repositories/cluster-repository.js';
import { ProjectRepository } from '../repositories/project-repository.js';
import { LlmProvider, OpenAiCompatibleLlmProvider } from '../providers/llm-provider.js';
import { checkContentQuality } from '../utils/content-quality-check.js';
import { escapeHtml, renderMarkdownToHtml } from '../utils/html.js';

export class ContentGenerationService {
  constructor(
    private contents = new ContentRepository(),
    private clusters = new ClusterRepository(),
    private projects = new ProjectRepository(),
    private provider: LlmProvider = new OpenAiCompatibleLlmProvider(),
  ) {}

  async generate(tenantId: string, input: {
    projectId: string;
    clusterId: string;
    format: 'html' | 'markdown';
    minWords: number;
    generateShortVideoScripts: boolean;
    language: string;
  }) {
    if (!Number.isInteger(input.minWords) || input.minWords < 1500 || input.minWords > 5000) {
      throw Object.assign(new Error('MIN_WORDS_OUT_OF_RANGE'), { statusCode: 400 });
    }
    const project = await this.projects.findById(tenantId, input.projectId);
    if (!project) throw Object.assign(new Error('PROJECT_NOT_FOUND'), { statusCode: 404 });
    const cluster = await this.clusters.findById(tenantId, input.clusterId);
    if (!cluster || cluster.project_id !== input.projectId) throw Object.assign(new Error('CLUSTER_NOT_FOUND'), { statusCode: 404 });

    const generated = await this.provider.generateContent({
      title: this.buildTitle(cluster.primary_keyword),
      primaryKeyword: cluster.primary_keyword,
      intent: cluster.intent,
      language: input.language,
      minWords: input.minWords,
      generateShortVideoScripts: input.generateShortVideoScripts,
      brandContext: project.brand_context ?? {},
      targetAudience: project.target_audience ?? {},
    });
    const title = generated.title.trim();
    const markdown = generated.markdown.trim();
    const validFaq = Array.isArray(generated.faq) &&
      generated.faq.length <= 20 &&
      generated.faq.every((item) => typeof item?.question === 'string' && item.question.length <= 1000 &&
        typeof item?.answer === 'string' && item.answer.length <= 5000);
    const validScripts = Array.isArray(generated.scripts) && generated.scripts.length <= 3 &&
      generated.scripts.every((script) => script && typeof script === 'object' && JSON.stringify(script).length <= 10_000);
    if (!title || title.length > 180 || !markdown || markdown.length > 200_000 ||
      typeof generated.metaDescription !== 'string' || !generated.metaDescription.trim() ||
      !Array.isArray(generated.secondaryKeywords) || generated.secondaryKeywords.length < 1 ||
      generated.secondaryKeywords.length > 10 ||
      generated.secondaryKeywords.some((keyword) => typeof keyword !== 'string' || !keyword.trim() || keyword.length > 100) ||
      typeof generated.cta !== 'string' ||
      generated.cta.length > 2000 || !validFaq || !validScripts) {
      throw Object.assign(new Error('CONTENT_GENERATION_INVALID'), { statusCode: 502 });
    }
    const wordCount = markdown.split(/\s+/).filter(Boolean).length;
    if (wordCount < input.minWords) {
      throw Object.assign(new Error('GENERATED_CONTENT_BELOW_MIN_WORDS'), { statusCode: 502, wordCount });
    }
    const scripts = input.generateShortVideoScripts ? generated.scripts.slice(0, 3) : [];
    if (input.generateShortVideoScripts && scripts.length !== 3) {
      throw Object.assign(new Error('CONTENT_GENERATION_INVALID_SCRIPTS'), { statusCode: 502 });
    }
    const description = generated.metaDescription.trim().slice(0, 300);
    const html = `<!doctype html><html lang="${escapeHtml(input.language)}"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"></head><body>${renderMarkdownToHtml(markdown)}</body></html>`;
    const quality = checkContentQuality({ title, markdown, primaryKeyword: cluster.primary_keyword });
    if (!quality.passed) {
      throw Object.assign(new Error('CONTENT_QUALITY_CHECK_FAILED'), { statusCode: 400, issues: quality.issues });
    }
    const content = await this.contents.create({
      tenantId,
      projectId: input.projectId,
      clusterId: input.clusterId,
      title,
      slug: this.slugify(title),
      markdown,
      html,
      scripts,
      payload: {
        format: input.format,
        language: input.language,
        seoTitle: title.slice(0, 180),
        metaDescription: description,
        focusKeyword: cluster.primary_keyword.slice(0, 100),
        secondaryKeywords: generated.secondaryKeywords.map((keyword) => keyword.trim()).join(', ').slice(0, 300),
        faq: generated.faq,
        cta: generated.cta,
        qualityIssues: quality.issues,
      },
    });
    return { contentId: content.id, title, wordCount, scripts: scripts.length, qualityIssues: quality.issues };
  }

  private buildTitle(keyword: string): string {
    return `${keyword}: hướng dẫn thực tế`;
  }

  private slugify(value: string): string {
    return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 140).replace(/-+$/g, '');
  }
}
