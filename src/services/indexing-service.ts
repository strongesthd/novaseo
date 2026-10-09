import { createIndexingProvider, IndexingEngine } from '../providers/indexing-provider.js';
import { InMemoryIndexingRepository } from '../repositories/indexing-repository.js';

export class IndexingService {
  constructor(private readonly repository = new InMemoryIndexingRepository()) {}

  async submit(input: { tenantId: string; projectId: string; contentId: string; url: string; engines?: IndexingEngine[] }) {
    const engines = input.engines ?? ['google_indexing', 'indexnow'];
    return Promise.all(engines.map(async (engine) => {
      try {
        const responseData = await createIndexingProvider(engine).submit(input.url);
        return this.repository.log({ ...input, engine, status: 'submitted', responseData });
      } catch (error) {
        return this.repository.log({ ...input, engine, status: 'failed', errorMessage: error instanceof Error ? error.message : 'Unknown indexing error' });
      }
    }));
  }
}
