ALTER TABLE seo_publish_logs
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

UPDATE seo_publish_logs
   SET updated_at = COALESCE(published_at, created_at, now())
 WHERE updated_at IS NULL;

ALTER TABLE seo_publish_logs
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contents_page
  ON seo_contents(tenant_id, project_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_contents_page_status
  ON seo_contents(tenant_id, project_id, status, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_clusters_page
  ON seo_keyword_clusters(tenant_id, project_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_clusters_page_filters
  ON seo_keyword_clusters(tenant_id, project_id, platform, intent, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_publish_urls_tenant_content
  ON seo_publish_logs(tenant_id, content_id)
  WHERE status = 'published' AND external_url IS NOT NULL;
