export type IndexingEngine = 'google_indexing' | 'indexnow';

export interface IndexingProvider {
  readonly engine: IndexingEngine;
  submit(url: string): Promise<Record<string, unknown>>;
}

export class StaticIndexingProvider implements IndexingProvider {
  constructor(public readonly engine: IndexingEngine) {}

  async submit(url: string): Promise<Record<string, unknown>> {
    return { accepted: true, url, engine: this.engine, submittedAt: new Date().toISOString() };
  }
}

export const createIndexingProvider = (engine: string): IndexingProvider => {
  const allowed: IndexingEngine[] = ['google_indexing', 'indexnow'];
  if (!allowed.includes(engine as IndexingEngine)) throw new Error(`Unsupported indexing engine: ${engine}`);
  return new StaticIndexingProvider(engine as IndexingEngine);
};