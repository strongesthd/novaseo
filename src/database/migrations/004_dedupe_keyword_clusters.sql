WITH ranked AS (
  SELECT id,
         first_value(id) OVER (
           PARTITION BY tenant_id, project_id, platform, lower(btrim(primary_keyword))
           ORDER BY created_at DESC, id DESC
         ) AS keep_id,
         row_number() OVER (
           PARTITION BY tenant_id, project_id, platform, lower(btrim(primary_keyword))
           ORDER BY created_at DESC, id DESC
         ) AS position
    FROM seo_keyword_clusters
),
merged_keywords AS (
  SELECT ranked.keep_id,
         jsonb_agg(DISTINCT related.keyword) AS keywords
    FROM ranked
    JOIN seo_keyword_clusters cluster ON cluster.id = ranked.id
    CROSS JOIN LATERAL jsonb_array_elements_text(
      CASE
        WHEN jsonb_typeof(cluster.cluster_data->'keywords') = 'array'
          THEN cluster.cluster_data->'keywords'
        ELSE '[]'::jsonb
      END
    ) AS related(keyword)
   GROUP BY ranked.keep_id
)
UPDATE seo_keyword_clusters cluster
   SET cluster_data = jsonb_set(cluster.cluster_data, '{keywords}', merged_keywords.keywords, true)
  FROM merged_keywords
 WHERE cluster.id = merged_keywords.keep_id;

WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY tenant_id, project_id, platform, lower(btrim(primary_keyword))
           ORDER BY created_at DESC, id DESC
         ) AS position
    FROM seo_keyword_clusters
)
DELETE FROM seo_keyword_clusters cluster
 USING ranked
 WHERE cluster.id = ranked.id
   AND ranked.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_keyword_clusters_unique_keyword
  ON seo_keyword_clusters(tenant_id, project_id, platform, lower(btrim(primary_keyword)));
