import { ProviderError } from '../utils/provider-error.js';

export type IndexingEngine = 'google_indexing' | 'indexnow';

export interface IndexingProvider {
  readonly engine: IndexingEngine;
  submit(url: string): Promise<Record<string, unknown>>;
}

export class StaticIndexingProvider implements IndexingProvider {
  constructor(public readonly engine: IndexingEngine) {}

  async submit(_url: string): Promise<Record<string, unknown>> {
    throw new ProviderError('INDEXING_PROVIDER_NOT_CONFIGURED', this.engine, false);
  }
}

export const createIndexingProvider = (engine: string): IndexingProvider => {
  const allowed: IndexingEngine[] = ['google_indexing', 'indexnow'];
  if (!allowed.includes(engine as IndexingEngine)) throw new Error(`Unsupported indexing engine: ${engine}`);
  return new StaticIndexingProvider(engine as IndexingEngine);
};
