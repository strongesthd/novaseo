import { query } from '../database/connection.js';
import { encryptSettings, redactSettings } from '../utils/settings-crypto.js';

export class ProjectRepository {
  async list(tenantId: string) {
    const result = await query(
      `SELECT id,name,industry,target_platforms AS "targetPlatforms",status,created_at AS "createdAt"
         FROM seo_projects WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows;
  }

  async create(tenantId: string, input: any) {
    const settings = encryptSettings(input.platformSettings || {});
    const result = await query(`INSERT INTO seo_projects (tenant_id,name,industry,brand_context,target_audience,tone_of_voice,target_platforms,platform_settings) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,name,industry,brand_context AS "brandContext",target_audience AS "targetAudience",tone_of_voice AS "toneOfVoice",target_platforms AS "targetPlatforms",status,created_at AS "createdAt"`, [tenantId, input.name, input.industry, input.brandContext || {}, input.targetAudience || {}, input.toneOfVoice, JSON.stringify(input.targetPlatforms || []), JSON.stringify(settings)]);
    return result.rows[0];
  }

  async findPublic(tenantId: string, id: string) {
    const result = await query(
      `SELECT id,name,industry,brand_context AS "brandContext",target_audience AS "targetAudience",
              tone_of_voice AS "toneOfVoice",target_platforms AS "targetPlatforms",
              platform_settings AS "platformSettings",status,created_at AS "createdAt"
         FROM seo_projects WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    const project = result.rows[0];
    return project ? { ...project, platformSettings: redactSettings(project.platformSettings) } : undefined;
  }

  async update(tenantId: string, id: string, input: any) {
    const settings = input.platformSettings ? encryptSettings(input.platformSettings) : undefined;
    const result = await query(
      `UPDATE seo_projects
          SET name = COALESCE($3, name),
              industry = COALESCE($4, industry),
              brand_context = COALESCE($5::jsonb, brand_context),
              target_audience = COALESCE($6::jsonb, target_audience),
              tone_of_voice = COALESCE($7, tone_of_voice),
              target_platforms = COALESCE($8::jsonb, target_platforms),
              platform_settings = COALESCE(platform_settings, '{}'::jsonb) ||
                COALESCE((
                  SELECT jsonb_object_agg(
                    incoming.platform,
                    COALESCE(seo_projects.platform_settings -> incoming.platform, '{}'::jsonb) || incoming.settings
                  )
                  FROM jsonb_each(COALESCE($9::jsonb, '{}'::jsonb)) AS incoming(platform, settings)
                ), '{}'::jsonb),
              updated_at = now()
        WHERE id = $1 AND tenant_id = $2
        RETURNING id,name,industry,brand_context AS "brandContext",target_audience AS "targetAudience",
                  tone_of_voice AS "toneOfVoice",target_platforms AS "targetPlatforms",
                  platform_settings AS "platformSettings",status,created_at AS "createdAt"`,
      [
        id,
        tenantId,
        input.name ?? null,
        input.industry ?? null,
        input.brandContext === undefined ? null : JSON.stringify(input.brandContext),
        input.targetAudience === undefined ? null : JSON.stringify(input.targetAudience),
        input.toneOfVoice ?? null,
        input.targetPlatforms === undefined ? null : JSON.stringify(input.targetPlatforms),
        settings === undefined ? null : JSON.stringify(settings),
      ],
    );
    const project = result.rows[0];
    return project ? { ...project, platformSettings: redactSettings(project.platformSettings) } : undefined;
  }

  async delete(tenantId: string, id: string) {
    const result = await query(
      'DELETE FROM seo_projects WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, tenantId],
    );
    return result.rows.length > 0;
  }

  async findById(tenantId: string, id: string) { const result = await query('SELECT * FROM seo_projects WHERE id = $1 AND tenant_id = $2', [id, tenantId]); return result.rows[0]; }
}
