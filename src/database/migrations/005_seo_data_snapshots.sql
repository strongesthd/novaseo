CREATE TABLE seo_data_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES seo_projects(id) ON DELETE CASCADE,
  data_type VARCHAR(40) NOT NULL CHECK (data_type IN ('keyword_metrics', 'serp_positions', 'search_console', 'on_page_audit', 'backlinks')),
  source VARCHAR(100) NOT NULL,
  context JSONB NOT NULL DEFAULT '{}',
  data JSONB NOT NULL DEFAULT '{}',
  retrieved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_seo_data_snapshots_project_type
  ON seo_data_snapshots(tenant_id, project_id, data_type, retrieved_at DESC);
