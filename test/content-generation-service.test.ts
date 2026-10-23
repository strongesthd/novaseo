import { describe, expect, it, vi } from 'vitest';
import { ContentGenerationService } from '../src/services/content-generation-service.js';
import { GeneratedContent, LlmProvider } from '../src/providers/llm-provider.js';

function fixture() {
  const saved: any[] = [];
  const contents = {
    async create(input: any) {
      saved.push(input);
      return { ...input, id: 'content-1' };
    },
  };
  const projects = { async findById() { return { id: 'p1', name: 'Workspace', brand_context: {}, target_audience: {} }; } };
  const clusters = { async findById() { return { id: 'c1', project_id: 'p1', primary_keyword: 'keyword', intent: 'informational' }; } };
  const generated: GeneratedContent = {
    title: '<script>alert(1)</script>',
    markdown: `## Guide\n${Array.from({ length: 1500 }, (_, index) => `word${index} <script>alert(1)</script>`).join(' ')}`,
    metaDescription: '"><img src=x onerror=alert(1)>',
    secondaryKeywords: ['related phrase'],
    faq: [{ question: 'Question?', answer: 'Answer.' }],
    cta: 'Read more',
    scripts: [{ platform: 'tiktok' }, { platform: 'reels' }, { platform: 'shorts' }],
  };
  const provider: LlmProvider = { generateContent: vi.fn(async () => generated) };
  const service = new ContentGenerationService(
    contents as any,
    clusters as any,
    projects as any,
    provider,
  );
  return { service, saved, provider, generated };
}

describe('ContentGenerationService', () => {
  it('persists generated content above the requested count and escapes HTML output', async () => {
    const { service, saved, provider, generated } = fixture();
    const result = await service.generate('tenant-1', {
      projectId: 'p1',
      clusterId: 'c1',
      format: 'html',
      minWords: 1500,
      generateShortVideoScripts: true,
      language: 'vi',
    });
    expect(result).toMatchObject({ contentId: 'content-1', scripts: 3 });
    expect(result.wordCount).toBeGreaterThanOrEqual(1500);
    expect(provider.generateContent).toHaveBeenCalledWith(expect.objectContaining({
      title: 'keyword: hướng dẫn thực tế',
      primaryKeyword: 'keyword',
      minWords: 1500,
    }));
    expect(saved[0].html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(saved[0].html).not.toContain('<script>');
    expect(saved[0].html).toContain('&quot;&gt;&lt;img src=x onerror=alert(1)&gt;');
    expect(saved[0].payload.faq).toEqual(generated.faq);
  });

  it('fails when a cluster does not exist and does not call the LLM', async () => {
    const { service, provider } = fixture();
    (service as any).clusters = { async findById() { return null; } };
    await expect(service.generate('tenant-1', {
      projectId: 'p1',
      clusterId: 'missing',
      format: 'html',
      minWords: 1500,
      generateShortVideoScripts: true,
      language: 'vi',
    })).rejects.toMatchObject({ statusCode: 404 });
    expect(provider.generateContent).not.toHaveBeenCalled();
  });

  it('rejects excessive word-count requests before provider work', async () => {
    const { service, provider } = fixture();
    await expect(service.generate('tenant-1', {
      projectId: 'p1',
      clusterId: 'c1',
      format: 'markdown',
      minWords: 5001,
      generateShortVideoScripts: false,
      language: 'vi',
    })).rejects.toMatchObject({ statusCode: 400 });
    expect(provider.generateContent).not.toHaveBeenCalled();
  });

  it('rejects provider output below the requested word count', async () => {
    const { service, provider } = fixture();
    (provider.generateContent as any).mockResolvedValue({
      title: 'A sufficiently descriptive title',
      markdown: '# Title\nonly a few words',
      metaDescription: 'Description',
      secondaryKeywords: ['related phrase'],
      faq: [],
      cta: 'Read',
      scripts: [],
    });
    await expect(service.generate('tenant-1', {
      projectId: 'p1',
      clusterId: 'c1',
      format: 'markdown',
      minWords: 1500,
      generateShortVideoScripts: false,
      language: 'vi',
    })).rejects.toMatchObject({ statusCode: 502, message: 'GENERATED_CONTENT_BELOW_MIN_WORDS' });
  });
});
