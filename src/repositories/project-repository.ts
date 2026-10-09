import { query } from '../database/connection.js';
import { encryptSettings } from '../utils/settings-crypto.js';

export class ProjectRepository {
  async create(tenantId: string, input: any) {
    const settings = encryptSettings(input.platformSettings || {});
    const result = await query(`INSERT INTO seo_projects (tenant_id,name,industry,brand_context,target_audience,tone_of_voice,target_platforms,platform_settings) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,name,industry,target_platforms,status,created_at`, [tenantId, input.name, input.industry, input.brandContext || {}, input.targetAudience || {}, input.toneOfVoice, JSON.stringify(input.targetPlatforms || []), JSON.stringify(settings)]);
    return result.rows[0];
  }
  async findById(tenantId: string, id: string) { const result = await query('SELECT * FROM seo_projects WHERE id = $1 AND tenant_id = $2', [id, tenantId]); return result.rows[0]; }
}
