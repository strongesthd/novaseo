import { query } from '../database/connection.js';

export class ContentRepository {
  async findById(tenantId: string, id: string) { const result = await query('SELECT * FROM seo_contents WHERE id = $1 AND tenant_id = $2', [id, tenantId]); return result.rows[0]; }
  async listPage(tenantId: string, projectId: string, status: string | undefined, limit: number, offset: number) {
    const [data, count] = await Promise.all([
      query(
        `SELECT id,title,slug,content_markdown,content_html,published_url,canonical_url,
                short_video_scripts,multi_platform_payload,status,created_at,updated_at
           FROM seo_contents
          WHERE tenant_id = $1 AND project_id = $2 AND ($3::text IS NULL OR status = $3)
          ORDER BY created_at DESC, id DESC LIMIT $4 OFFSET $5`,
        [tenantId, projectId, status ?? null, limit, offset],
      ),
      query(
        `SELECT count(*)::int AS total FROM seo_contents
          WHERE tenant_id = $1 AND project_id = $2 AND ($3::text IS NULL OR status = $3)`,
        [tenantId, projectId, status ?? null],
      ),
    ]);
    return { rows: data.rows, total: count.rows[0].total as number };
  }
  async findLinkCandidates(tenantId: string, projectId: string, contentId: string, limit = 3) {
    const result = await query(
      `SELECT id,title,published_url,canonical_url FROM seo_contents
        WHERE tenant_id = $1 AND project_id = $2 AND id <> $3
          AND status = 'published' AND published_url IS NOT NULL
        ORDER BY updated_at DESC, id DESC LIMIT $4`,
      [tenantId, projectId, contentId, limit],
    );
    return result.rows;
  }
  async listIndexableUrls(tenantId: string, contentId: string): Promise<string[]> {
    const result = await query(
      `SELECT url FROM (
         SELECT published_url AS url FROM seo_contents WHERE tenant_id = $1 AND id = $2
         UNION
         SELECT canonical_url AS url FROM seo_contents WHERE tenant_id = $1 AND id = $2
         UNION
         SELECT external_url AS url FROM seo_publish_logs
          WHERE tenant_id = $1 AND content_id = $2 AND status = 'published'
       ) urls
       WHERE url IS NOT NULL`,
      [tenantId, contentId],
    );
    return result.rows.map((row) => row.url as string);
  }
  async create(input: any) { const result = await query(`INSERT INTO seo_contents (tenant_id,project_id,cluster_id,title,slug,content_markdown,content_html,short_video_scripts,multi_platform_payload,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'ready') RETURNING *`, [input.tenantId, input.projectId, input.clusterId, input.title, input.slug, input.markdown, input.html, JSON.stringify(input.scripts), JSON.stringify(input.payload)]); return result.rows[0]; }
  async updateDraft(tenantId: string, id: string, input: { title?: string; contentMarkdown?: string }) {
    const result = await query(
      `UPDATE seo_contents
          SET title = COALESCE($3, title),
              content_markdown = COALESCE($4, content_markdown),
              content_html = CASE WHEN $4::text IS NULL THEN content_html ELSE NULL END,
              status = 'ready',
              updated_at = now()
        WHERE tenant_id = $1 AND id = $2
        RETURNING id,title,slug,content_markdown AS "contentMarkdown",status,updated_at AS "updatedAt"`,
      [tenantId, id, input.title ?? null, input.contentMarkdown ?? null],
    );
    return result.rows[0];
  }
  async setPublishedUrl(tenantId: string, id: string, url: string) { await query('UPDATE seo_contents SET published_url = $1, updated_at = now(), status = $2 WHERE tenant_id = $3 AND id = $4', [url, 'published', tenantId, id]); }
  async updateHtml(tenantId: string, id: string, html: string) { await query('UPDATE seo_contents SET content_html = $1, updated_at = now() WHERE tenant_id = $2 AND id = $3', [html, tenantId, id]); }
}
