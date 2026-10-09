# Software Requirements Specification
## Multi-Platform SEO & Content Automation Engine

## 1. Tổng quan

### 1.1 Mục tiêu
Xây dựng một SaaS Multi-tenant, Niche-Agnostic và Multi-Platform Engine để tự động hóa toàn bộ quy trình SEO và Content Automation: quản lý dự án, cào từ khóa đa kênh, phân nhóm ý định tìm kiếm, sinh nội dung Anti-AI, xuất bản đa nền tảng và gửi yêu cầu lập chỉ mục cho nhiều công cụ tìm kiếm.

### 1.2 Phạm vi
- Hỗ trợ nhiều tenant độc lập, mỗi tenant có nhiều SEO project.
- Không phụ thuộc một ngành dọc; cấu hình niche, thương hiệu, đối tượng và giọng văn theo từng project.
- Tách biệt hoàn toàn cơ chế khai thác dữ liệu, sinh nội dung, xuất bản và indexing thông qua Provider/Adapter.
- Các kênh khai thác từ khóa: Google, Shopee, Lazada, TikTok Search và YouTube Autosuggest.
- Các kênh xuất bản: WordPress, Shopify, Custom Webhook, TikTok và YouTube.
- Multi-Search Indexing: Google Indexing API chạy song song IndexNow API cho Bing/Yandex.

## 2. Người dùng và phân quyền
- `Tenant Owner`: quản lý tenant, thành viên, billing và toàn bộ project.
- `Project Manager`: cấu hình project, nền tảng, job và phê duyệt nội dung.
- `Content Editor`: xem, chỉnh sửa và xuất bản nội dung được cấp quyền.
- `System Operator`: giám sát queue, provider, rate limit và audit log.

## 3. Functional Requirements

### FR-01. Quản lý Project/Tenant
- Hệ thống phải hỗ trợ tạo, cập nhật, lưu trữ và archive tenant/project.
- Mỗi project phải lưu: `industry`, `brandContext`, `targetAudience`, `toneOfVoice` và `targetPlatforms`.
- `targetPlatforms` xác định mặc định các kênh mining, content format và publishing.
- Credentials của nền tảng phải được mã hóa khi lưu và không được trả về trong API response.
- Tenant isolation phải được áp dụng ở database query, cache key, job payload và log context.
- Mọi tác vụ bất đồng bộ phải trả `jobId`; client có thể polling `GET /api/v1/seo/jobs/:jobId` để nhận `queued`, `processing`, `completed` hoặc `failed`, cùng phần trăm tiến độ và result/error tương ứng.

### FR-02. Keyword Mining & Intent Clustering Đa Kênh
- Cho phép chọn một hoặc nhiều `platform`: `google`, `shopee`, `lazada`, `tiktok`, `youtube`.
- Provider phải chuẩn hóa kết quả về cùng mô hình keyword: từ khóa, nguồn, ngôn ngữ, khu vực, volume, competition, suggestions và metadata.
- Hệ thống phải chạy mining bất đồng bộ, hỗ trợ pagination, rate limit và retry theo provider.
- Keyword phải được phân nhóm theo semantic similarity và search intent: informational, commercial, transactional, navigational.
- Một keyword có thể xuất hiện ở nhiều nền tảng nhưng phải giữ nguồn và điểm dữ liệu riêng.

### FR-03. Anti-AI Content Generation
- Sinh bài viết HTML hoặc Markdown tối thiểu 1.500 từ theo context của project và intent cluster.
- Nội dung phải có title, meta description, heading hierarchy, FAQ, CTA, entity coverage và internal-link candidates.
- Pipeline phải có bước kiểm tra lặp ý, tính tự nhiên, factual consistency, keyword stuffing và policy safety.
- Mỗi content brief có thể sinh 3 kịch bản video ngắn cho TikTok, Instagram Reels và YouTube Shorts.
- Kịch bản gồm hook, scene, voice-over, on-screen text, CTA, thời lượng dự kiến và hashtag.

### FR-04. Auto Publishing & Internal Linker Đa Kênh
- Cho phép preview, schedule, publish ngay hoặc retry nội dung.
- Hỗ trợ WordPress, Shopify, Custom Webhook, TikTok và YouTube qua các provider độc lập.
- Payload xuất bản phải được adapter chuyển đổi theo yêu cầu từng nền tảng.
- Internal Linker phải chọn các content liên quan trong cùng project, tránh vòng lặp và hỗ trợ anchor text tự nhiên.
- Mỗi lần publish phải tạo audit log riêng cho từng target platform, kể cả khi một request publish nhiều kênh.
- Hệ thống phải kiểm tra `idempotency_key` trước khi publish và retry; khóa duy nhất theo content, platform và idempotency key phải ngăn đăng trùng hoặc tạo audit log trùng.

### FR-05. Multi-Search Indexing
- Sau khi publish thành công, hệ thống có thể gửi URL tới Google Indexing API.
- Đồng thời hoặc độc lập, hệ thống gửi URL qua IndexNow API để thông báo cho Bing và Yandex.
- Indexing là job bất đồng bộ, idempotent, có retry và lưu response/status từng search engine.
- Không để lỗi indexing làm rollback nội dung đã publish thành công.

## 4. Non-Functional Requirements
- **Async Job Queue:** mining, clustering, generation, publishing và indexing phải chạy qua queue; API trả job ID khi tác vụ dài.
- **Multi-tenant Security:** authorization theo tenant/project, mã hóa secrets, least privilege, audit trail và chống cross-tenant access.
- **Rate Limiting:** giới hạn theo tenant, provider, endpoint và credential; hỗ trợ backoff khi nhận 429.
- **High Throughput:** worker horizontal scaling, batch processing, connection pooling và provider circuit breaker.
- **Reliability:** retry có exponential backoff, dead-letter queue, idempotency key và health check.
- **Job Visibility:** job state phải tenant-scoped; endpoint polling không được trả về job ID của tenant khác.
- **Observability:** structured logging, metrics queue/provider, tracing request-job và cảnh báo lỗi.
- **Data Protection:** validate input, redact credentials, retention policy và backup/restore có kiểm thử.

## 5. Acceptance Criteria
- Tạo được project với cấu hình đa nền tảng và credentials được bảo vệ.
- Mining được từ tối thiểu năm platform enum và lưu cluster theo nguồn.
- Sinh được bài HTML/Markdown từ 1.500 từ cùng ba short-video scripts.
- Một content có thể publish tới nhiều nền tảng với log riêng từng nền tảng.
- Google Indexing API và IndexNow API có thể chạy song song, retry độc lập.
- Tenant không thể đọc dữ liệu, job, credential hoặc log của tenant khác.
- Polling trả đúng tiến độ/result/error theo trạng thái job; retry publish cùng idempotency key không tạo thao tác hoặc bản ghi trùng.
