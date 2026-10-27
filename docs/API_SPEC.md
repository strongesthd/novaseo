# RESTful API Specification
## Multi-Platform SEO & Content Automation Engine

Base prefix: `/api/v1/seo`

## 1. Quy ước chung
- Header bắt buộc: `Authorization: Bearer <token>`, `Content-Type: application/json`.
- Khuyến nghị `X-Tenant-Id` khi user có nhiều tenant và `Idempotency-Key` cho POST tạo job/publish.
- Response lỗi thống nhất: `{ "error": { "code": "...", "message": "...", "requestId": "..." } }`.
- HTTP 200 cho read/action hoàn tất; 201 cho resource/job tạo mới; 400 cho validation; 401/403 cho auth; 404 cho resource không tồn tại; 409 cho idempotency/conflict; 429 cho rate limit; 500 cho lỗi không xác định.

## 2. Tạo project
### `POST /api/v1/seo/projects`
Request body:
```json
{
  "name": "Organic Beauty",
  "industry": "beauty",
  "brandContext": { "description": "...", "products": ["..."] },
  "targetAudience": { "region": "VN", "segments": ["..."] },
  "toneOfVoice": "expert-friendly",
  "targetPlatforms": ["wordpress", "shopify", "tiktok", "youtube", "webhook"],
  "platformSettings": {
    "wordpress": { "siteUrl": "https://example.com", "username": "...", "appPassword": "..." },
    "shopify": { "storeUrl": "https://store.myshopify.com", "accessToken": "...", "apiVersion": "YYYY-MM", "blogId": "123", "blogHandle": "news" },
    "tiktok": { "oauthToken": "..." },
    "youtube": { "oauthToken": "..." },
    "webhook": { "url": "https://hooks.example.com", "secret": "..." }
  }
}
```
Response `201`:
```json
{ "data": { "id": "uuid", "name": "Organic Beauty", "targetPlatforms": ["wordpress", "shopify"], "status": "active" } }
```
Credentials không xuất hiện trong response. Response `400` khi platform/config không hợp lệ; `500` khi không tạo được project.

## 3. Cập nhật và xóa project
### `PATCH /api/v1/seo/projects/:projectId`
Cập nhật một hoặc nhiều trường project; tên được loại bỏ khoảng trắng ở đầu/cuối và phải dài từ 1 đến 200 ký tự. Trả `200` với project đã cập nhật, `400` nếu payload không hợp lệ hoặc rỗng, `404` nếu project không tồn tại trong tenant hiện tại.

### `DELETE /api/v1/seo/projects/:projectId`
Xóa vĩnh viễn project trong tenant hiện tại và các keyword cluster, nội dung, lịch sử xuất bản/indexing liên quan (theo khóa ngoại cascade). Trả `204` khi xóa thành công, `404` nếu project không tồn tại trong tenant hiện tại.

## 4. Mine keywords
### `POST /api/v1/seo/keywords/mine`
Request body:
```json
{
  "projectId": "uuid",
  "seedKeywords": ["kem chống nắng"],
  "platform": "google",
  "locale": "vi-VN",
  "country": "VN",
  "limit": 100
}
```
`platform` bắt buộc và nhận một trong: `google | shopee | lazada | tiktok | youtube`.
`seedKeywords` nhận từ 1 đến 20 mục, tối đa 120 ký tự mỗi mục; `limit` tối đa 200.
Mining cần `platformSettings[platform].miningEndpoint` được cấu hình trong project.
Endpoint custom nhận `{ platform, seeds, locale, country, limit }` và trả `{ "records": [{ "keyword": "...", "volume": 10, "competition": 0.2, "suggestions": [] }] }`.
`miningEndpoint` và API key (nếu cần) được cấu hình trong mục Tích hợp của project; API key được mã hóa khi lưu. Thiếu endpoint trả `400 MINING_PROVIDER_NOT_CONFIGURED` trước khi enqueue. Không có provider thì hệ thống không sinh số liệu giả.
Với Google, có thể dùng SerpApi Google Autocomplete bằng endpoint `https://serpapi.com/search.json` và API key nhập riêng ở ô API key (không dán key vào endpoint). SerpApi được gọi bằng HTTPS GET, mỗi seed tạo một yêu cầu với `engine=google_autocomplete`, `q`, `gl`, `hl` và API key. Phản hồi `suggestions[].value` được lưu thành keyword; dịch vụ không cung cấp search volume nên các trường `volume` và `competition` để trống. Tích hợp này chỉ hỗ trợ nền tảng Google. Thiếu key trả `400 SERPAPI_API_KEY_REQUIRED`.
Response `201`:
```json
{ "data": { "jobId": "uuid", "status": "queued", "platform": "google" } }
```
Response `400` khi platform/params sai; `500` khi không enqueue được job.

## 5. Lấy keyword clusters
### `GET /api/v1/seo/keywords/clusters/:projectId`
Query params: `platform`, `intent`, `page`, `limit`, `sort`.
Response `200`:
```json
{ "data": [{ "id": "uuid", "platform": "tiktok", "clusterName": "...", "primaryKeyword": "...", "intent": "commercial", "clusterData": {} }], "meta": { "page": 1, "limit": 20, "total": 1 } }
```
Response `400` khi query sai; `500` khi truy vấn thất bại.

## 6. Sinh content
### `POST /api/v1/seo/content/generate`
Request body:
```json
{
  "projectId": "uuid",
  "clusterId": "uuid",
  "format": "html",
  "minWords": 1500,
  "generateShortVideoScripts": true,
  "targetPlatforms": ["wordpress", "shopify", "tiktok", "youtube"],
  "language": "vi"
}
```
`minWords` phải nằm trong khoảng 1.500-5.000. Content được tạo qua provider
OpenAI-compatible cấu hình bằng `LLM_API_URL`, `LLM_API_KEY`, `LLM_MODEL`.
Response `201`: `{ "data": { "jobId": "uuid", "status": "queued" } }`.
Response `400` khi format/cluster không hợp lệ; `500` khi không tạo được job.

## 7. Lấy content theo project
### `GET /api/v1/seo/content/:projectId`
Query params: `status`, `page`, `limit`, `includePayload`.
Response `200`:
```json
{ "data": [{ "id": "uuid", "title": "...", "status": "ready", "shortVideoScripts": [], "multiPlatformPayload": {} }], "meta": { "page": 1, "limit": 20, "total": 1 } }
```
Response `400` khi query sai; `500` khi truy vấn thất bại.

## 8. Publish content đa nền tảng
### `POST /api/v1/seo/content/publish`
Request body:
```json
{
  "contentId": "uuid",
  "targetPlatforms": ["wordpress", "shopify", "webhook", "tiktok", "youtube"],
  "scheduleAt": null,
  "publishOptions": { "visibility": "public", "sendIndexing": true }
}
```
`targetPlatforms` là mảng bắt buộc các kênh muốn đăng, mỗi phần tử thuộc `wordpress | shopify | webhook | tiktok | youtube`.
`scheduleAt`, nếu có, phải là ISO 8601 có timezone và nằm trong tương lai;
job được đưa vào queue với delay, tối đa một năm. Có thể gửi header
`Idempotency-Key` để retry cùng một thao tác. Kết quả `unknown` cần đối soát
với nền tảng trước khi tạo key mới.
Response `201`:
```json
{ "data": { "jobId": "uuid", "status": "queued", "targetPlatforms": ["wordpress", "shopify"] } }
```
Response `400` khi mảng rỗng/platform không được hỗ trợ; `500` khi không enqueue được. Kết quả từng platform xem trong publish logs; lỗi một platform không làm mất kết quả các platform còn lại.
WordPress, Shopify và webhook có adapter publish thật. TikTok/YouTube hiện
trả lỗi cấu hình thay vì giả lập đăng thành công.

## 9. Polling trạng thái job bất đồng bộ
### `GET /api/v1/seo/jobs/:jobId`
Headers:
- `Authorization: Bearer <token>`
- `X-Tenant-Id: <tenantId>`

Query params: Không có.

Response `200`:
```json
{
  "data": {
    "jobId": "uuid",
    "type": "content_generation",
    "status": "processing",
    "progress": 65,
    "result": null,
    "error": null,
    "createdAt": "2026-10-08T10:00:00Z",
    "updatedAt": "2026-10-08T10:02:00Z"
  }
}
```

`type` nhận một trong `keyword_mining | content_generation | publishing | indexing`. `status` nhận một trong `queued | processing | completed | failed`; `progress` là số nguyên từ 0 đến 100. `result` chỉ trả về object kết quả khi job `completed`. `error` chỉ trả về `{ "code": "...", "message": "..." }` khi job `failed`.

Response `404` khi không tìm thấy `jobId` hoặc `jobId` không thuộc tenant hiện tại. Response `401/403` khi thiếu hoặc không có quyền với tenant; `500` khi truy vấn job thất bại.

## 10. Xuất bản bài viết sang TRIA CAFE

Trong `platformSettings.webhook` của project, cấu hình endpoint và secret dùng chung với biến môi trường `NOVASEO_WEBHOOK_SECRET` trên TRIA:

```json
{
  "url": "https://triacafe.vn/api/integrations/novaseo/articles",
  "secret": "<shared-secret>"
}
```

NovaSEO gửi `POST` JSON và ký nguyên văn request body bằng HMAC-SHA256 trong header `X-NovaSEO-Signature`. Request bao gồm `contentId`, `title`, `seoTitle`, `metaDescription`, `focusKeyword`, `secondaryKeywords`, `slug`, `content` (HTML), `platform: "webhook"` và `visibility: "public"`. Tạo content sẽ sinh 3-8 từ khóa phụ ngoài từ khóa chính để phù hợp form SEO của TRIA. Webhook TRIA chỉ nhận bài công khai; yêu cầu đăng nháp/riêng tư bị NovaSEO từ chối trước khi gửi. TRIA xác minh chữ ký, lọc HTML, lưu bài ở trạng thái đã xuất bản và trả `article.link`; retry cùng `contentId` cập nhật bài hiện có thay vì tạo bản trùng. Slug đang được bài viết khác sử dụng trả HTTP `409`.
