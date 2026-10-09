# Agent Rules
## Multi-Platform SEO & Content Automation Engine

## 1. Naming Conventions & Code Standards
- JavaScript/TypeScript variables, functions, methods và object properties dùng `camelCase`.
- Classes, interfaces, types và React components dùng `PascalCase`.
- File/folder route và module dùng `kebab-case`.
- Environment variables, constants và feature flags dùng `UPPER_SNAKE_CASE`.
- API JSON dùng `camelCase`; database columns dùng `snake_case`.
- Provider platform identifiers phải dùng enum/allowlist thống nhất, không tự tạo spelling khác.
- Ưu tiên module nhỏ, type rõ ràng, input validation và dependency injection.

## 2. Async và Error Handling
- Dùng `async/await`; không tạo promise chain khó theo dõi.
- Mọi handler/controller async phải có try-catch hoặc async wrapper và bắt buộc đẩy lỗi về `next(err)`.
- Không nuốt lỗi, không trả stack trace/secret cho client.
- Lỗi provider phải được chuẩn hóa thành error type có `code`, `platform`, `retryable` và `requestId`.
- Job queue phải có idempotency key, timeout, exponential backoff, retry limit và dead-letter handling.

## 3. Logging và Bảo mật
- Cấm `console.log`, `console.error` và debug output trực tiếp trong production code; dùng structured logger của hệ thống.
- Không ghi access token, password, app password, OAuth token, webhook secret hoặc raw credential vào log/response.
- Mọi repository query phải áp dụng tenant scope và authorization theo project.
- Validate payload, platform enum và URL trước khi gọi provider.

## 4. Quy tắc Provider/Adapter
- Bắt buộc tuân thủ Provider/Adapter Pattern khi bổ sung provider mới trong `src/providers/`.
- Provider mới phải implement contract tương ứng trong `src/providers/contracts/`.
- Phải đăng ký provider trong Factory, không import SDK trực tiếp từ service/controller.
- Adapter chịu trách nhiệm mapping request/response, authentication, timeout, pagination, rate-limit và provider-specific errors.
- Factory chỉ chọn adapter theo allowlist; business logic thuộc service, không đặt trong factory.
- Mỗi adapter mới phải có unit/contract tests cho success, validation error, rate limit, timeout và retryable error.

## 5. Hướng dẫn AI Agent đọc tài liệu
- Task về yêu cầu nghiệp vụ, scope hoặc acceptance criteria: đọc `/docs/SRS.md`.
- Task về layer, data flow, provider, queue hoặc error handling: đọc `/docs/ARCHITECTURE.md`.
- Task về bảng, cột, JSONB, index hoặc migration: đọc `/docs/DATABASE_SCHEMA.md`.
- Task về route, request/response, params hoặc status code: đọc `/docs/API_SPEC.md`.
- Trước khi sửa code, xác định tài liệu tương ứng và giữ implementation nhất quán với cả các tài liệu liên quan.
- Khi thêm nền tảng, cập nhật contract/adapter/factory, schema enum, API enum và tài liệu liên quan trong cùng change set.

## 6. Quy trình thay đổi
- Không sửa generated/vendor/lock file nếu task không yêu cầu.
- Giữ thay đổi nhỏ, review diff và bổ sung test cho behavior mới.
- Không commit secret hoặc credential thật.
- Mọi thay đổi publish/indexing phải tạo được audit trail và giữ tenant isolation.
