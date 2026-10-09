# Architecture
## Multi-Platform SEO & Content Automation Engine

## 1. Kiến trúc tổng thể

Hệ thống sử dụng **Layered Architecture** kết hợp **Provider/Adapter Pattern** và **Factory Pattern**. Domain/service layer chỉ phụ thuộc vào interface chuẩn, không phụ thuộc SDK hoặc HTTP contract của từng nền tảng.

### Các lớp
1. **Routes/Controllers:** xác thực request, parse input, trả response chuẩn và đẩy tác vụ dài vào queue.
2. **Middleware:** authentication, tenant context, authorization, validation, rate limiting và global error handling.
3. **Services/Use Cases:** điều phối mining, clustering, generation, linking, publishing và indexing.
4. **Repositories:** truy cập database, transaction, filtering theo tenant và persistence audit log.
5. **Providers/Adapters:** tích hợp Google, Shopee, Lazada, TikTok, YouTube, WordPress, Shopify, Webhook, Google Indexing và IndexNow.
6. **Database/Queue:** PostgreSQL, JSONB, cache và message broker/worker.

## 2. Cấu trúc thư mục
```text
src/
├── config/                 # environment, feature flags, provider config
├── database/               # connection, migrations, models
├── middleware/             # auth, tenant, validation, rate-limit, errors
├── providers/              # interfaces, adapters và factories
│   ├── contracts/          # KeywordMiner, Publisher, Indexer interfaces
│   ├── factories/          # tạo adapter theo platform/type
│   ├── keyword-miners/     # Google, Shopee, Lazada, TikTok, YouTube
│   ├── publishers/         # WordPress, Shopify, Webhook, TikTok, YouTube
│   └── indexers/           # Google Indexing, IndexNow
├── repositories/           # project, keyword, content, publish log repositories
├── routes/                 # REST route modules
├── services/               # application/domain services
└── utils/                  # logger, crypto, retry, idempotency helpers
```

## 3. Provider/Adapter và Factory

Mỗi provider mới phải implement contract tương ứng, chuẩn hóa input/output và tự quản lý mapping lỗi, rate limit, timeout. Factory nhận `platform`/`providerType`, kiểm tra allowlist và trả adapter phù hợp.

```text
KeywordMinerFactory.create(platform) -> KeywordMinerAdapter
PublisherFactory.create(platform)    -> PublisherAdapter
IndexerFactory.create(engine)        -> IndexerAdapter
```

Service không import SDK trực tiếp. Adapter chịu trách nhiệm credential, request signing, response mapping, pagination, timeout và provider-specific retry. Factory không chứa business logic. Credentials lấy từ secret manager/config đã giải mã trong runtime, không ghi vào log.

## 4. Data Flow
```text
Request tạo job
    -> Auth/Tenant Middleware
    -> `POST` trả `jobId`
    -> Client polling `GET /api/v1/seo/jobs/:jobId`
       -> Job State Service trả queued | processing | completed | failed + progress/result/error
    -> Keyword Mining Service
    -> KeywordMinerFactory
       -> Google | Shopee | Lazada | TikTok Search | YouTube Autosuggest
    -> Normalize & Persist keywords
    -> Intent Clustering Service
    -> Content Generation Service
       -> Anti-AI HTML/Markdown + 3 short-video scripts
    -> Internal Linker
    -> Publish Orchestrator
       -> Idempotency Check (`content_id + platform + idempotency_key`)
       -> PublisherFactory
          -> WordPress | Shopify | Webhook | TikTok | YouTube
    -> Indexing Queue
       -> Google Indexing API || IndexNow API (Bing/Yandex)
    -> Publish/Index Audit Logs
```

## 5. Async Queue và Retry
- Mỗi use case dài chạy trong queue riêng hoặc routing key riêng: `keyword-mining`, `clustering`, `content-generation`, `publishing`, `indexing`.
- Job có `tenantId`, `projectId`, `idempotencyKey`, correlation ID, attempt count và deadline.
- API bất đồng bộ trả `jobId`; client kiểm tra tiến độ qua `GET /api/v1/seo/jobs/:jobId`. Job state chỉ được trả nếu `job.tenantId` trùng tenant context, tránh lộ trạng thái giữa các tenant.
- Retry lỗi tạm thời bằng exponential backoff có jitter; lỗi validation/auth đưa thẳng vào failed state.
- Sau số lần retry tối đa, chuyển Dead Letter Queue và tạo alert.
- Publish nhiều platform dùng fan-out; lỗi một adapter không chặn các adapter khác.
- Trước mỗi lần publish/retry, Publish Orchestrator kiểm tra `idempotency_key` trong `seo_publish_logs`; unique index trên `content_id`, `platform`, `idempotency_key` ngăn đăng hoặc ghi audit log trùng.
- Indexing Google và IndexNow chạy song song, trạng thái được ghi độc lập.

## 6. Global Error Handling
- Tất cả controller async phải chuyển lỗi về middleware bằng `next(err)`.
- Lỗi domain có mã ổn định; lỗi provider được map thành `ProviderError` với platform, retryable và public message.
- Global handler ghi structured log có correlation/tenant/project nhưng redact secrets.
- API response không expose stack trace, access token, webhook secret hoặc provider raw credential.
- Timeout, circuit breaker và rate-limit được xử lý ở adapter; service nhận kết quả chuẩn hóa.

## 7. Bảo mật và mở rộng
- Mọi truy vấn bắt buộc tenant scope; authorization kiểm tra project ownership/role.
- Worker có thể scale ngang độc lập theo queue depth và provider quota.
- Adapter contract, factory registry và contract tests cho phép thêm nền tảng mà không sửa business service.
- Metrics tối thiểu: latency/error/429 theo provider, queue lag, retry count, publish success và indexing status.
