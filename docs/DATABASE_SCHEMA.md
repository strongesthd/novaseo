# Database Schema
## Multi-Platform SEO & Content Automation Engine

PostgreSQL là database chính. Tất cả bảng nghiệp vụ có `tenant_id`, timestamps và index phục vụ tenant scoping. Credentials trong JSONB phải được mã hóa field-level hoặc lưu reference tới secret manager.

## 1. `seo_projects`
```sql
CREATE TABLE seo_projects (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
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
```

`platform_settings` lưu cấu hình/credential đa kênh theo key, ví dụ:
```json
{
  "wordpress": { "siteUrl": "https://example.com", "appPasswordRef": "secret://wp/app-password" },
  "shopify": { "storeUrl": "https://store.myshopify.com", "tokenRef": "secret://shopify/token" },
  "tiktok": { "oauthRef": "secret://tiktok/oauth" },
  "youtube": { "oauthRef": "secret://youtube/oauth" },
  "webhook": { "url": "https://hooks.example.com/content", "secretRef": "secret://webhook/secret" }
}
```

Không lưu plaintext token/password/secret. `target_platforms` là danh sách platform mặc định của project.

## 2. `seo_keyword_clusters`
```sql
CREATE TABLE seo_keyword_clusters (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  project_id UUID NOT NULL REFERENCES seo_projects(id) ON DELETE CASCADE,
  platform VARCHAR(30) NOT NULL CHECK (platform IN ('google', 'shopee', 'lazada', 'tiktok', 'youtube')),
  cluster_name VARCHAR(200) NOT NULL,
  primary_keyword TEXT NOT NULL,
  intent VARCHAR(40) NOT NULL,
  cluster_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_keyword_clusters_project_platform
  ON seo_keyword_clusters(project_id, platform);
CREATE INDEX idx_keyword_clusters_tenant_project
  ON seo_keyword_clusters(tenant_id, project_id);
```

`cluster_data` chứa keywords, scores, volume, competition, source metadata và embedding/reference nếu có.

## 3. `seo_contents`
```sql
CREATE TABLE seo_contents (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
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
CREATE INDEX idx_seo_contents_project_status ON seo_contents(project_id, status);
CREATE INDEX idx_seo_contents_tenant_project ON seo_contents(tenant_id, project_id);
```

`short_video_scripts` chứa ba kịch bản cho TikTok/Reels/Shorts. `multi_platform_payload` chứa payload đã chuẩn hóa và/hoặc override theo từng target platform. Status gồm `draft`, `generating`, `ready`, `publishing`, `published`, `failed`.

## 4. `seo_publish_logs`
```sql
CREATE TABLE seo_publish_logs (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  project_id UUID NOT NULL REFERENCES seo_projects(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES seo_contents(id) ON DELETE CASCADE,
  platform VARCHAR(30) NOT NULL CHECK (platform IN ('wordpress', 'shopify', 'webhook', 'tiktok', 'youtube')),
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
CREATE INDEX idx_publish_logs_content_platform ON seo_publish_logs(content_id, platform);
CREATE INDEX idx_publish_logs_tenant_created ON seo_publish_logs(tenant_id, created_at DESC);
CREATE UNIQUE INDEX idx_publish_logs_idempotency
  ON seo_publish_logs(content_id, platform, idempotency_key);
```

Mỗi target platform trong một lần publish phải tạo một bản ghi, tạo audit trail chi tiết. `idempotency_key` được kiểm tra trước khi insert/publish để retry queue không tạo bản ghi hoặc đăng trùng; unique index bảo vệ thêm ở database theo `content_id + platform + idempotency_key`.

## 5. Quy tắc dữ liệu
- Mọi read/write phải lọc `tenant_id` hoặc suy ra tenant từ project đã authorize. `seo_keyword_clusters` và `seo_contents` lưu trực tiếp `tenant_id` để tối ưu truy vấn multi-tenant và áp dụng Row Level Security (RLS).
- JSONB có schema validation ở service layer; không tin cậy dữ liệu tùy ý từ client.
- Request/response payload phải redact secret trước khi ghi log.
- Xóa project dùng cascade có kiểm soát; audit log có thể áp dụng retention riêng.
