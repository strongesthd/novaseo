import { query } from '../database/connection.js';

export class PublishLogRepository {
  async findByIdempotency(contentId: string, platform: string, key: string) { const result = await query('SELECT * FROM seo_publish_logs WHERE content_id = $1 AND platform = $2 AND idempotency_key = $3', [contentId, platform, key]); return result.rows[0]; }
  async create(input: any) { const result = await query(`INSERT INTO seo_publish_logs (tenant_id,project_id,content_id,platform,status,external_id,external_url,idempotency_key,response_data,published_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now()) ON CONFLICT (content_id,platform,idempotency_key) DO NOTHING RETURNING *`, [input.tenantId,input.projectId,input.contentId,input.platform,input.status,input.externalId,input.externalUrl,input.idempotencyKey,JSON.stringify(input.responseData || {})]); return result.rows[0]; }
}
