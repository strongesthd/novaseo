import { describe, expect, it, vi } from 'vitest';
import { OpenAiCompatibleLlmProvider } from '../src/providers/llm-provider.js';

describe('OpenAiCompatibleLlmProvider', () => {
  it('fails explicitly when required provider configuration is missing', async () => {
    const transport = vi.fn();
    const provider = new OpenAiCompatibleLlmProvider(undefined, undefined, undefined, transport);
    await expect(provider.generateContent({
      title: 'Title',
      primaryKeyword: 'keyword',
      intent: 'informational',
      minWords: 1500,
    })).rejects.toMatchObject({ code: 'LLM_NOT_CONFIGURED', retryable: false });
    expect(transport).not.toHaveBeenCalled();
  });

  it('sends project context and parses structured provider output', async () => {
    const content = JSON.stringify({
      title: 'Useful title',
      markdown: '# Useful title\nContent',
      metaDescription: 'Description',
      secondaryKeywords: ['related phrase'],
      faq: [{ question: 'Q?', answer: 'A.' }],
      cta: 'Read',
      scripts: [{ platform: 'tiktok' }, { platform: 'reels' }, { platform: 'shorts' }],
    });
    const transport = vi.fn(async () => ({
      status: 200,
      ok: true,
      data: { choices: [{ message: { content } }] },
    }));
    const provider = new OpenAiCompatibleLlmProvider(
      'https://llm.example/v1/chat/completions',
      'secret-token',
      'model-1',
      transport,
    );
    const result = await provider.generateContent({
      title: 'Input title',
      primaryKeyword: 'keyword',
      intent: 'commercial',
      language: 'vi',
      minWords: 1800,
      brandContext: { name: 'Brand' },
    });
    expect(result).toMatchObject({ title: 'Useful title' });
    expect(result.scripts).toHaveLength(3);
    expect(transport).toHaveBeenCalledWith(
      'https://llm.example/v1/chat/completions',
      expect.objectContaining({
        headers: { authorization: 'Bearer secret-token' },
        body: expect.objectContaining({
          model: 'model-1',
          messages: expect.arrayContaining([expect.objectContaining({
            content: expect.stringContaining('"minimumWordCount":1800'),
          })]),
        }),
      }),
    );
  });

  it('rejects malformed provider output rather than persisting it', async () => {
    const provider = new OpenAiCompatibleLlmProvider(
      'https://llm.example/v1/chat/completions',
      'secret-token',
      'model-1',
      async () => ({ status: 200, ok: true, data: { choices: [{ message: { content: 'not-json' } }] } }),
    );
    await expect(provider.generateContent({
      title: 'Input',
      primaryKeyword: 'keyword',
      intent: 'informational',
    })).rejects.toMatchObject({ code: 'LLM_INVALID_RESPONSE' });
  });
});
