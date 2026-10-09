import { query } from '../database/connection.js';

export class ContentRepository {
  async findById(tenantId: string, id: string) { const result = await query('SELECT * FROM seo_contents WHERE id = $1 AND tenant_id = $2', [id, tenantId]); return result.rows[0]; }
  async list(tenantId: string, projectId: string, status?: string) { const result = await query('SELECT id,title,slug,content_markdown,content_html,published_url,canonical_url,short_video_scripts,multi_platform_payload,status,created_at,updated_at FROM seo_contents WHERE tenant_id = $1 AND project_id = $2 AND ($3::text IS NULL OR status = $3) ORDER BY created_at DESC', [tenantId, projectId, status || null]); return result.rows; }
  async create(input: any) { const result = await query(`INSERT INTO seo_contents (tenant_id,project_id,cluster_id,title,slug,content_markdown,content_html,short_video_scripts,multi_platform_payload,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'ready') RETURNING *`, [input.tenantId, input.projectId, input.clusterId, input.title, input.slug, input.markdown, input.html, JSON.stringify(input.scripts), JSON.stringify(input.payload)]); return result.rows[0]; }
  async setPublishedUrl(tenantId: string, id: string, url: string) { await query('UPDATE seo_contents SET published_url = $1, updated_at = now(), status = $2 WHERE tenant_id = $3 AND id = $4', [url, 'published', tenantId, id]); }
  async updateHtml(tenantId: string, id: string, html: string) { await query('UPDATE seo_contents SET content_html = $1, updated_at = now() WHERE tenant_id = $2 AND id = $3', [html, tenantId, id]); }
}
