# Hướng dẫn sử dụng NovaSEO

Tài liệu này hướng dẫn quy trình cơ bản từ tạo dự án, nghiên cứu từ khóa, tạo bài viết đến xuất bản. Phần cuối mô tả cách gửi bài viết sang TRIA CAFE bằng Custom Webhook.

## 1. Đăng nhập và chọn workspace

Đăng nhập NovaSEO, sau đó chọn đúng workspace/tenant ở góc trên của thanh điều hướng. Dự án, nội dung, cấu hình kênh và tác vụ đều thuộc workspace đang chọn.

## 2. Tạo dự án SEO

1. Mở **Dự án SEO** và chọn **Tạo dự án**.
2. Nhập tên dự án, ngành hàng và website.
3. Bổ sung bối cảnh thương hiệu, sản phẩm/dịch vụ, thị trường, đối tượng mục tiêu và giọng thương hiệu.
4. Chọn **Tạo dự án**.

Thông tin thương hiệu giúp NovaSEO tạo nội dung phù hợp hơn. Hãy cung cấp dữ liệu cụ thể, chính xác và không đưa thông tin bí mật vào phần mô tả.

## 3. Nghiên cứu từ khóa

1. Mở **Từ khóa** và chọn dự án.
2. Chọn nền tảng nghiên cứu.
3. Nhập từ khóa hạt giống, mỗi từ khóa trên một dòng, rồi chọn số lượng tối đa.
4. Chọn **Nghiên cứu từ khóa**.
5. Theo dõi tác vụ trong **Tác vụ**. Khi hoàn tất, nhóm từ khóa sẽ xuất hiện trong bảng kết quả.
6. Chọn một nhóm từ khóa để bắt đầu tạo nội dung.

Autocomplete chỉ tạo ý tưởng, không có search volume. Mở **SEO Insights** để lấy chỉ số keyword, vị trí SERP, dữ liệu Search Console, audit và backlink.

### Cấu hình DataForSEO

1. Tạo tài khoản tại [DataForSEO](https://dataforseo.com/) và lấy API login/password trong mục API access. Trang giá hiện công bố $1 trial credit cho tài khoản mới và top-up tối thiểu $50 sau đó; số dư không hết hạn. Giá endpoint thay đổi theo dịch vụ, vì vậy kiểm tra dashboard trước khi nạp tiền hoặc chạy nhiều từ khóa.
2. Trong NovaSEO, mở **Tích hợp → Dữ liệu SEO nâng cao** và nhập API login/password. Mặc định location code `2392` là Việt Nam và language code `vi`.
3. Vào **SEO Insights**, nhập từ khóa rồi chọn **Lấy metrics** để xem volume, lịch sử tìm kiếm tháng, độ khó SEO và cạnh tranh quảng cáo. Đây là API trả phí; mỗi lần tra có thể sử dụng credit.
4. Nhập domain và chọn **Kiểm tra thứ hạng** để lấy ảnh chụp SERP organic theo thị trường đã cấu hình. Đây là vị trí tại thời điểm kiểm tra, không phải lịch sử thứ hạng.
5. Dùng **Audit trang** để kiểm tra URL HTTPS công khai; dùng **Phân tích backlink** để lấy tổng quan backlink cho domain. Hai thao tác này cũng tiêu thụ credit của provider.

**Phân biệt chỉ số:** “Cạnh tranh Ads” là cạnh tranh quảng cáo Google, không phải độ khó SEO. “Độ khó SEO” là điểm ước tính của DataForSEO. SERP rank là kết quả tại thời điểm tra; Search Console average position là trung bình theo truy vấn, URL, quốc gia, thiết bị và khoảng ngày.

### Kết nối Google Search Console

1. Trong Google Cloud Console, tạo/chọn project, bật **Google Search Console API**, cấu hình OAuth consent screen và tạo OAuth client ID/secret.
2. Cấp quyền OAuth chỉ đọc `https://www.googleapis.com/auth/webmasters.readonly` cho tài khoản Google đã xác minh website trong Search Console. Lấy refresh token bằng quy trình OAuth của tổ chức hoặc OAuth 2.0 Playground được cấu hình dùng client ID/secret của bạn.
3. Nhập property URL, OAuth client ID, client secret và refresh token vào **Tích hợp → Dữ liệu SEO nâng cao**. Với Domain property, nhập dạng `sc-domain:example.com`; URL-prefix property nhập URL đầy đủ, ví dụ `https://example.com/`.
4. Mở **SEO Insights**, chọn khoảng ngày và chạy Search Console. Kết quả gồm truy vấn, trang, quốc gia, thiết bị, impressions, clicks, CTR và vị trí trung bình; chỉ xuất hiện dữ liệu của property bạn có quyền truy cập.

Credentials được mã hóa trong cơ sở dữ liệu. Không chia sẻ API password, OAuth client secret hoặc refresh token; không đưa chúng vào ticket/log.

## 4. Tạo và biên tập nội dung

1. Trong **Từ khóa**, chọn biểu tượng tạo nội dung ở nhóm từ khóa phù hợp; hoặc mở **Nội dung** và tạo bài viết.
2. Chọn nhóm từ khóa để đưa yêu cầu tạo bài vào hàng đợi.
3. Mở **Tác vụ** để xem tiến độ. Bài viết sẽ xuất hiện trong **Nội dung** khi hoàn tất.
4. Chọn bài viết để xem và chỉnh sửa tiêu đề, nội dung Markdown và phần xem trước.
5. Chọn **Lưu thay đổi** sau khi biên tập.

Việc tạo bài chạy bất đồng bộ. Nếu tác vụ thất bại, mở chi tiết tác vụ để xem lỗi trước khi thử lại.

## 5. Kết nối kênh xuất bản

1. Mở **Tích hợp**.
2. Chọn dự án cần cấu hình.
3. Bật các kênh dự định sử dụng.
4. Nhập thông tin kết nối cho từng kênh và chọn **Lưu cấu hình**.

NovaSEO hỗ trợ xuất bản qua Custom Webhook, WordPress và Shopify khi được cấu hình đúng. TikTok/YouTube hiện chưa có adapter xuất bản hoàn chỉnh. Dấu trạng thái “Đã kết nối” của webhook chỉ cho biết đã nhập URL; chưa phải kết quả kiểm tra kết nối thực tế.

## 6. Gửi bài viết sang TRIA CAFE

### Cấu hình một lần

1. Tạo một secret mạnh, riêng cho tích hợp. Không dùng chung mật khẩu tài khoản.
2. Trên máy chủ TRIA, đặt biến môi trường `NOVASEO_WEBHOOK_SECRET` bằng secret đó trong `.env.production`. Không commit secret vào Git hoặc gửi secret qua tin nhắn.
3. Đảm bảo phiên bản TRIA đã deploy thành công sau khi cập nhật cấu hình môi trường.
4. Trong NovaSEO, vào **Tích hợp**, chọn đúng dự án, bật kênh **Webhook**, rồi nhập:

   - **Webhook URL:** `https://triacafe.vn/api/integrations/novaseo/articles`
   - **Webhook secret:** cùng secret đã đặt ở TRIA

5. Chọn **Lưu cấu hình**. Secret được lưu mã hóa và không hiển thị lại sau khi lưu.

### Xuất bản bài

1. Mở **Xuất bản**.
2. Chọn bài viết có trạng thái sẵn sàng.
3. Chọn kênh **Webhook**. Có thể chọn thêm kênh khác nếu dự án đã cấu hình chúng.
4. Chọn **Đưa vào hàng đợi** và theo dõi kết quả trong **Tác vụ** hoặc nhật ký xuất bản.
5. Khi thành công, mở liên kết bài viết được trả về để xác nhận bài hiển thị trên TRIA.

Webhook TRIA chỉ nhận bài **công khai**. Bài viết cần có tiêu đề, tiêu đề SEO, mô tả meta, từ khóa chính, từ khóa phụ, slug hợp lệ và nội dung. Slug phải viết thường, không dấu, các từ cách nhau bằng dấu gạch ngang; ví dụ `cach-chon-ca-phe-rang-moc`.

Bài mới được tạo trên TRIA tại đường dẫn `/tin-tuc/{slug}`. NovaSEO gửi ID nội dung ổn định: xuất bản lại cùng bài sẽ cập nhật bài đã liên kết thay vì tạo bản sao. Nếu slug đã được một bài khác sử dụng, TRIA từ chối yêu cầu để tránh ghi đè.

## 7. Kiểm tra kết quả và xử lý lỗi

| Kết quả | Ý nghĩa và cách xử lý |
|---|---|
| Thành công | Mở liên kết bài viết trong kết quả xuất bản để kiểm tra tiêu đề, nội dung và URL. |
| `401 Unauthorized` | Secret hai hệ thống không khớp, chữ ký không hợp lệ hoặc body bị thay đổi sau khi ký. Nhập lại cùng secret ở cả hai phía. |
| `503 NovaSEO integration is not configured` | TRIA chưa nhận được `NOVASEO_WEBHOOK_SECRET`; kiểm tra `.env.production` và việc khởi động lại/deploy ứng dụng. |
| `400 Invalid article payload` | Thiếu trường bắt buộc, slug sai định dạng, nội dung rỗng hoặc dữ liệu vượt giới hạn. Sửa bài rồi xuất bản lại. |
| `409 This article slug is already in use` | Slug đang thuộc bài khác trên TRIA. Đổi slug thành duy nhất rồi thử lại. |
| `429 Too many publishing requests` | Đã gửi quá nhiều yêu cầu trong thời gian ngắn. Chờ theo thông tin `Retry-After` rồi thử lại. |
| `500 Could not publish the article` | Có lỗi xử lý phía TRIA. Quản trị viên kiểm tra log ứng dụng TRIA trước khi thử lại. |

Không chia sẻ webhook secret khi gửi log hỗ trợ. Khi retry cùng bài, giữ nguyên nội dung nguồn và kiểm tra nhật ký trước để tránh tạo nhiều yêu cầu không cần thiết.

## Lưu ý về trạng thái triển khai

Luồng gửi từ NovaSEO và endpoint nhận của TRIA đã được triển khai trong mã nguồn. Tuy nhiên, việc xuất bản thực tế còn phụ thuộc vào secret đã được cấu hình đúng và bản TRIA đã deploy thành công. Nếu deploy TRIA đang báo lỗi, hãy xử lý lỗi deploy trước khi kết luận webhook production hoạt động.
