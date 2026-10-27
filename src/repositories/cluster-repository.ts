import { query } from '../database/connection.js';

export class ClusterRepository {
  async findById(tenantId: string, id: string) { const result = await query('SELECT * FROM seo_keyword_clusters WHERE id = $1 AND tenant_id = $2', [id, tenantId]); return result.rows[0]; }
  async listPage(tenantId: string, projectId: string, platform: string | undefined, intent: string | undefined, limit: number, offset: number) {
    const [data, count] = await Promise.all([
      query(
        `SELECT id,platform,cluster_name AS "clusterName",primary_keyword AS "primaryKeyword",
                intent,cluster_data AS "clusterData",created_at AS "createdAt"
           FROM seo_keyword_clusters
          WHERE tenant_id = $1 AND project_id = $2
            AND ($3::text IS NULL OR platform = $3) AND ($4::text IS NULL OR intent = $4)
          ORDER BY created_at DESC, id DESC LIMIT $5 OFFSET $6`,
        [tenantId, projectId, platform ?? null, intent ?? null, limit, offset],
      ),
      query(
        `SELECT count(*)::int AS total FROM seo_keyword_clusters
          WHERE tenant_id = $1 AND project_id = $2
            AND ($3::text IS NULL OR platform = $3) AND ($4::text IS NULL OR intent = $4)`,
        [tenantId, projectId, platform ?? null, intent ?? null],
      ),
    ]);
    return { rows: data.rows, total: count.rows[0].total as number };
  }
  async createMany(rows: any[]) {
    if (!rows.length) return;
    const values: unknown[] = [];
    const tuples = rows.map((row, index) => {
      const offset = index * 7;
      values.push(row.tenantId, row.projectId, row.platform, row.clusterName, row.primaryKeyword, row.intent, JSON.stringify(row.clusterData));
      return `($${offset + 1},$${offset + 2},$${offset + 3},$${offset + 4},$${offset + 5},$${offset + 6},$${offset + 7}::jsonb)`;
    });
    await query(
      `INSERT INTO seo_keyword_clusters
        (tenant_id,project_id,platform,cluster_name,primary_keyword,intent,cluster_data)
       VALUES ${tuples.join(',')}
       ON CONFLICT (tenant_id,project_id,platform,(lower(btrim(primary_keyword))))
       DO UPDATE SET
         cluster_name = EXCLUDED.cluster_name,
         primary_keyword = EXCLUDED.primary_keyword,
         intent = EXCLUDED.intent,
         cluster_data = jsonb_set(
           jsonb_set(
             jsonb_set(
               seo_keyword_clusters.cluster_data || EXCLUDED.cluster_data,
               '{keywords}',
               COALESCE((
                 SELECT jsonb_agg(DISTINCT keyword)
                   FROM jsonb_array_elements_text(
                     COALESCE(seo_keyword_clusters.cluster_data->'keywords', '[]'::jsonb) ||
                     COALESCE(EXCLUDED.cluster_data->'keywords', '[]'::jsonb)
                   ) AS related(keyword)
               ), '[]'::jsonb),
               true
             ),
             '{volume}',
             COALESCE(
               NULLIF(EXCLUDED.cluster_data->'volume', 'null'::jsonb),
               seo_keyword_clusters.cluster_data->'volume',
               'null'::jsonb
             ),
             true
           ),
           '{competition}',
           COALESCE(
             NULLIF(EXCLUDED.cluster_data->'competition', 'null'::jsonb),
             seo_keyword_clusters.cluster_data->'competition',
             'null'::jsonb
           ),
           true
         )`,
      values,
    );
  }
}
