import { JsonResponse, requestJson } from '../utils/safe-http.js';
import { ProviderError } from '../utils/provider-error.js';

export interface ContentGenerationInput {
  title: string;
  primaryKeyword: string;
  intent: string;
  language?: string;
  minWords?: number;
  generateShortVideoScripts?: boolean;
  brandContext?: Record<string, unknown>;
  targetAudience?: Record<string, unknown>;
}

export interface GeneratedContent {
  title: string;
  markdown: string;
  metaDescription: string;
  secondaryKeywords: string[];
  faq: Array<{ question: string; answer: string }>;
  cta: string;
  scripts: Array<Record<string, unknown>>;
}

export interface LlmProvider {
  generateContent(input: ContentGenerationInput): Promise<GeneratedContent>;
}

export type JsonTransport = (url: string, options: {
  method?: string;
  headers?: Record<string, string>;
  body?: string | Record<string, unknown>;
}) => Promise<JsonResponse>;

export class OpenAiCompatibleLlmProvider implements LlmProvider {
  constructor(
    private readonly endpoint = process.env.LLM_API_URL,
    private readonly apiKey = process.env.LLM_API_KEY,
    private readonly model = process.env.LLM_MODEL,
    private readonly transport: JsonTransport = (url, options) => requestJson(url, options),
  ) {}

  async generateContent(input: ContentGenerationInput): Promise<GeneratedContent> {
    if (!this.endpoint || !this.apiKey || !this.model) {
      throw new ProviderError('LLM_NOT_CONFIGURED', 'llm', false);
    }
    const minWords = input.minWords ?? 1500;
    const response = await this.transport(this.endpoint, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.apiKey}` },
      body: {
        model: this.model,
        temperature: 0.7,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'Write accurate, useful content in the requested language. Do not invent research, statistics, citations, or product claims. Keep title at or below 180 characters. Return only a JSON object with title, markdown, metaDescription, secondaryKeywords (an array of 3-8 relevant search phrases, excluding the primary keyword), faq (question/answer objects), cta, and scripts (exactly three short-video script objects when requested, otherwise an empty array).',
          },
          {
            role: 'user',
            content: JSON.stringify({
              title: input.title,
              primaryKeyword: input.primaryKeyword,
              intent: input.intent,
              language: input.language ?? 'vi',
              minimumWordCount: minWords,
              generateShortVideoScripts: input.generateShortVideoScripts ?? true,
              brandContext: input.brandContext ?? {},
              targetAudience: input.targetAudience ?? {},
            }),
          },
        ],
      },
    });
    if (!response.ok) {
      throw new ProviderError(`LLM_HTTP_${response.status}`, 'llm', [408, 429, 500, 502, 503, 504].includes(response.status));
    }
    const content = response.data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new ProviderError('LLM_INVALID_RESPONSE', 'llm', false);
    let generated: any;
    try {
      generated = JSON.parse(content);
    } catch {
      throw new ProviderError('LLM_INVALID_RESPONSE', 'llm', false);
    }
    if (
      typeof generated.title !== 'string' ||
      typeof generated.markdown !== 'string' ||
      typeof generated.metaDescription !== 'string' ||
      !Array.isArray(generated.secondaryKeywords) ||
      generated.secondaryKeywords.length < 1 ||
      generated.secondaryKeywords.length > 10 ||
      generated.secondaryKeywords.some((keyword: unknown) => typeof keyword !== 'string' || !keyword.trim() || keyword.length > 100) ||
      typeof generated.cta !== 'string' ||
      !Array.isArray(generated.faq) ||
      !Array.isArray(generated.scripts)
    ) {
      throw new ProviderError('LLM_INVALID_RESPONSE', 'llm', false);
    }
    return generated as GeneratedContent;
  }
}
