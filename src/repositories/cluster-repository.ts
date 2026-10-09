import { query } from '../database/connection.js';

export class ClusterRepository {
  async findById(tenantId: string, id: string) { const result = await query('SELECT * FROM seo_keyword_clusters WHERE id = $1 AND tenant_id = $2', [id, tenantId]); return result.rows[0]; }
  async list(tenantId: string, projectId: string, platform?: string, intent?: string) { const result = await query('SELECT id,platform,cluster_name AS "clusterName",primary_keyword AS "primaryKeyword",intent,cluster_data AS "clusterData",created_at AS "createdAt" FROM seo_keyword_clusters WHERE tenant_id=$1 AND project_id=$2 AND ($3::text IS NULL OR platform=$3) AND ($4::text IS NULL OR intent=$4) ORDER BY created_at DESC', [tenantId, projectId, platform || null, intent || null]); return result.rows; }
  async createMany(rows: any[]) { for (const row of rows) { await query('INSERT INTO seo_keyword_clusters (tenant_id,project_id,platform,cluster_name,primary_keyword,intent,cluster_data) VALUES ($1,$2,$3,$4,$5,$6,$7)', [row.tenantId, row.projectId, row.platform, row.clusterName, row.primaryKeyword, row.intent, JSON.stringify(row.clusterData)]); } }
}
