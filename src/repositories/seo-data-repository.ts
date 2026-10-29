import { query } from '../database/connection.js';

export class SeoDataRepository {
  async create(tenantId: string, projectId: string, dataType: string, source: string, context: unknown, data: unknown) {
    const result = await query(
      `INSERT INTO seo_data_snapshots (tenant_id, project_id, data_type, source, context, data)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
       RETURNING id, data_type AS "dataType", source, context, data,
                 retrieved_at AS "retrievedAt", created_at AS "createdAt"`,
      [tenantId, projectId, dataType, source, JSON.stringify(context), JSON.stringify(data)],
    );
    return result.rows[0];
  }

  async list(tenantId: string, projectId: string, dataType?: string, limit = 20) {
    const result = await query(
      `SELECT id, data_type AS "dataType", source, context, data,
              retrieved_at AS "retrievedAt", created_at AS "createdAt"
         FROM seo_data_snapshots
        WHERE tenant_id = $1 AND project_id = $2
          AND ($3::text IS NULL OR data_type = $3)
        ORDER BY retrieved_at DESC
        LIMIT $4`,
      [tenantId, projectId, dataType ?? null, limit],
    );
    return result.rows;
  }
}
