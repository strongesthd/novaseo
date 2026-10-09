import { query } from '../database/connection.js';

export class IndexingLogRepository {
  async create(input: { tenantId: string; projectId: string; contentId: string; engine: string; url: string; status: string; accepted: boolean; responseData?: Record<string, unknown> }) {
    const result = await query(
      `INSERT INTO seo_indexing_logs (tenant_id, project_id, content_id, engine, url, status, accepted, response_data, submitted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
       RETURNING *`,
      [input.tenantId, input.projectId, input.contentId, input.engine, input.url, input.status, input.accepted, JSON.stringify(input.responseData || {})],
    );
    return result.rows[0];
  }

  async list(tenantId: string, contentId: string) {
    const result = await query('SELECT * FROM seo_indexing_logs WHERE tenant_id = $1 AND content_id = $2 ORDER BY submitted_at DESC', [tenantId, contentId]);
    return result.rows;
  }
}