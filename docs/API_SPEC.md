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
    "wordpress": { "siteUrl": "https://example.com", "appPassword": "..." },
    "shopify": { "storeUrl": "https://store.myshopify.com", "token": "..." },
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

## 3. Mine keywords
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
Response `201`:
```json
{ "data": { "jobId": "uuid", "status": "queued", "platform": "google" } }
```
Response `400` khi platform/params sai; `500` khi không enqueue được job.

## 4. Lấy keyword clusters
### `GET /api/v1/seo/keywords/clusters/:projectId`
Query params: `platform`, `intent`, `page`, `limit`, `sort`.
Response `200`:
```json
{ "data": [{ "id": "uuid", "platform": "tiktok", "clusterName": "...", "primaryKeyword": "...", "intent": "commercial", "clusterData": {} }], "meta": { "page": 1, "limit": 20, "total": 1 } }
```
Response `400` khi query sai; `500` khi truy vấn thất bại.

## 5. Sinh content
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
Response `201`: `{ "data": { "jobId": "uuid", "status": "queued" } }`.
Response `400` khi format/cluster không hợp lệ; `500` khi không tạo được job.

## 6. Lấy content theo project
### `GET /api/v1/seo/content/:projectId`
Query params: `status`, `page`, `limit`, `includePayload`.
Response `200`:
```json
{ "data": [{ "id": "uuid", "title": "...", "status": "ready", "shortVideoScripts": [], "multiPlatformPayload": {} }], "meta": { "page": 1, "limit": 20, "total": 1 } }
```
Response `400` khi query sai; `500` khi truy vấn thất bại.

## 7. Publish content đa nền tảng
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
Response `201`:
```json
{ "data": { "jobId": "uuid", "status": "queued", "targetPlatforms": ["wordpress", "shopify"] } }
```
Response `400` khi mảng rỗng/platform không được hỗ trợ; `500` khi không enqueue được. Kết quả từng platform xem trong publish logs; lỗi một platform không làm mất kết quả các platform còn lại.

## 8. Polling trạng thái job bất đồng bộ
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
