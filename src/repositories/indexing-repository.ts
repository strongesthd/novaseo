export interface IndexingLogInput {
  tenantId: string;
  projectId: string;
  contentId: string;
  engine: string;
  url: string;
  status: string;
  responseData?: Record<string, unknown>;
  errorMessage?: string;
}

export interface IndexingRepository {
  log(input: IndexingLogInput): Promise<unknown>;
  findByContent(tenantId: string, contentId: string): Promise<unknown[]>;
}

export class InMemoryIndexingRepository implements IndexingRepository {
  private readonly logs: any[] = [];

  async log(input: IndexingLogInput): Promise<unknown> {
    const row = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...input };
    this.logs.push(row);
    return row;
  }

  async findByContent(tenantId: string, contentId: string): Promise<unknown[]> {
    return this.logs.filter((row) => row.tenantId === tenantId && row.contentId === contentId);
  }
}