CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS seo_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  industry VARCHAR(150) NOT NULL,
  brand_context JSONB NOT NULL DEFAULT '{}',
  target_audience JSONB NOT NULL DEFAULT '{}',
  tone_of_voice VARCHAR(100),
  target_platforms JSONB NOT NULL DEFAULT '[]',
  platform_settings JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS seo_keyword_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES seo_projects(id) ON DELETE CASCADE,
  platform VARCHAR(30) NOT NULL CHECK (platform IN ('google','shopee','lazada','tiktok','youtube')),
  cluster_name VARCHAR(200) NOT NULL,
  primary_keyword TEXT NOT NULL,
  intent VARCHAR(40) NOT NULL,
  cluster_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS seo_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES seo_projects(id) ON DELETE CASCADE,
  cluster_id UUID REFERENCES seo_keyword_clusters(id),
  title VARCHAR(500) NOT NULL,
  slug VARCHAR(500),
  content_markdown TEXT,
  content_html TEXT,
  published_url TEXT,
  canonical_url TEXT,
  short_video_scripts JSONB NOT NULL DEFAULT '[]',
  multi_platform_payload JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS seo_publish_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES seo_projects(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES seo_contents(id) ON DELETE CASCADE,
  platform VARCHAR(30) NOT NULL CHECK (platform IN ('wordpress','shopify','webhook','tiktok','youtube')),
  status VARCHAR(30) NOT NULL,
  external_id VARCHAR(500),
  external_url TEXT,
  idempotency_key VARCHAR(100) NOT NULL,
  request_payload JSONB,
  response_data JSONB,
  error_code VARCHAR(100),
  error_message TEXT,
  attempt INTEGER NOT NULL DEFAULT 1,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS seo_jobs (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type VARCHAR(40) NOT NULL CHECK (type IN ('keyword_mining','content_generation','publishing','indexing')),
  status VARCHAR(20) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','completed','failed')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  result JSONB,
  error JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS seo_indexing_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES seo_projects(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES seo_contents(id) ON DELETE CASCADE,
  engine VARCHAR(30) NOT NULL CHECK (engine IN ('google','indexnow')),
  url TEXT NOT NULL,
  status VARCHAR(30) NOT NULL,
  accepted BOOLEAN NOT NULL DEFAULT false,
  response_data JSONB,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_tenant ON seo_projects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clusters_tenant_project ON seo_keyword_clusters(tenant_id, project_id);
CREATE INDEX IF NOT EXISTS idx_contents_tenant_project ON seo_contents(tenant_id, project_id);
CREATE INDEX IF NOT EXISTS idx_publish_logs_tenant_created ON seo_publish_logs(tenant_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_publish_logs_idempotency ON seo_publish_logs(content_id, platform, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_jobs_tenant ON seo_jobs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_indexing_logs_tenant_content ON seo_indexing_logs(tenant_id, content_id);
CREATE INDEX IF NOT EXISTS idx_indexing_logs_engine_status ON seo_indexing_logs(engine, status);

ALTER TABLE seo_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_keyword_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_publish_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_indexing_logs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION app_tenant_id() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::UUID;
$$ LANGUAGE SQL STABLE;

DO $$ BEGIN
  CREATE POLICY projects_tenant_policy ON seo_projects USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id());
  CREATE POLICY clusters_tenant_policy ON seo_keyword_clusters USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id());
  CREATE POLICY contents_tenant_policy ON seo_contents USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id());
  CREATE POLICY logs_tenant_policy ON seo_publish_logs USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id());
  CREATE POLICY jobs_tenant_policy ON seo_jobs USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id());
  CREATE POLICY indexing_logs_tenant_policy ON seo_indexing_logs USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
