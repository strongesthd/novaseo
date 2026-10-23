import { query } from '../database/connection.js';

export class PublishLogRepository {
  async markStaleUnknown(tenantId: string, contentId: string, platform: string, key: string) {
    await query(
      `UPDATE seo_publish_logs
          SET status = 'unknown', error_code = 'PUBLISH_OUTCOME_UNKNOWN',
              error_message = 'Provider outcome requires reconciliation', updated_at = now()
        WHERE tenant_id = $1 AND content_id = $2 AND platform = $3 AND idempotency_key = $4
          AND status = 'processing' AND updated_at < now() - interval '15 minutes'`,
      [tenantId, contentId, platform, key],
    );
  }

  async findByIdempotency(tenantId: string, contentId: string, platform: string, key: string) {
    const result = await query(
      'SELECT * FROM seo_publish_logs WHERE tenant_id = $1 AND content_id = $2 AND platform = $3 AND idempotency_key = $4',
      [tenantId, contentId, platform, key],
    );
    return result.rows[0];
  }

  async claim(input: { tenantId: string; projectId: string; contentId: string; platform: string; idempotencyKey: string }) {
    const result = await query(
      `INSERT INTO seo_publish_logs
        (tenant_id,project_id,content_id,platform,status,idempotency_key,attempt,updated_at)
       VALUES ($1,$2,$3,$4,'processing',$5,1,now())
       ON CONFLICT (content_id,platform,idempotency_key) DO UPDATE
         SET status = 'processing', attempt = seo_publish_logs.attempt + 1,
             error_code = NULL, error_message = NULL, response_data = NULL, updated_at = now()
       WHERE seo_publish_logs.status = 'failed'
       RETURNING *`,
      [input.tenantId, input.projectId, input.contentId, input.platform, input.idempotencyKey],
    );
    return result.rows[0];
  }

  async finish(input: {
    tenantId: string;
    contentId: string;
    platform: string;
    idempotencyKey: string;
    status: 'published' | 'failed' | 'unknown';
    externalId?: string;
    externalUrl?: string;
    responseData?: Record<string, unknown>;
    errorCode?: string;
    errorMessage?: string;
  }) {
    const result = await query(
      `UPDATE seo_publish_logs
          SET status = $5, external_id = $6, external_url = $7, response_data = $8,
              error_code = $9, error_message = $10,
              published_at = CASE WHEN $5 = 'published' THEN now() ELSE NULL END,
              updated_at = now()
        WHERE tenant_id = $1 AND content_id = $2 AND platform = $3 AND idempotency_key = $4
        RETURNING *`,
      [
        input.tenantId, input.contentId, input.platform, input.idempotencyKey, input.status,
        input.externalId ?? null, input.externalUrl ?? null,
        JSON.stringify(input.responseData ?? {}), input.errorCode ?? null, input.errorMessage ?? null,
      ],
    );
    return result.rows[0];
  }
}
