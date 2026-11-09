# CTMS-223 — Verify Offline Package Integrity

Nghiệp vụ được chuyển từ tài liệu CTMS-223 ngày 09/11/2026. CTMS-237 sở hữu xác minh, lưu kết quả và kích hoạt. CTMS-238 hiển thị trạng thái trong luồng tải.

## Luồng Camper và Porter

1. Camper hoặc Porter nhấn **Tải xuống**. CTMS-053 kiểm tra quyền, phiên bản, dung lượng và truyền ZIP. Khi gián đoạn, giữ tệp `.part` và tiếp tục từ kích thước thực tế bằng Range và If-Range. Tạm dừng chủ động cần thao tác tiếp tục.
2. Khi transfer hoàn tất, hệ thống tự xác minh trên thiết bị. Giao diện hiển thị **Đang hoàn tất dữ liệu…**. Mở lại ứng dụng có thể tiếp tục xác minh từ ZIP và metadata đã lưu.
3. Khi hợp lệ và đủ điều kiện kích hoạt, hiển thị **Sẵn sàng sử dụng ngoại tuyến**. Phiên bản đã kích hoạt còn dùng được khi bản thay thế đang tải hoặc gặp lỗi. Trip ongoing giữ bản đã khóa.
4. Khi không hợp lệ, hiển thị **Không thể hoàn tất dữ liệu ngoại tuyến** và **Tải lại**. Sau khi xác thực lại quyền, lần tải lại dọn bản lỗi đúng identity và lấy lại byte từ đầu. Nếu lần tải lại bị gián đoạn, các byte mới tiếp tục được giữ.
5. CTMS-224 có thể đọc ZIP đã kích hoạt theo đúng Trip/version trong chế độ ngoại tuyến. Việc hiển thị route, checkpoints và guidance thuộc CTMS-224. Độ mới của cảnh báo thuộc CTMS-057.

## Điều kiện xác minh

| Mã | Kiểm tra |
| --- | --- |
| V1 | ZIP tồn tại và bằng đúng kích thước đã pin. |
| V2 | SHA-256 toàn ZIP khớp metadata lấy từ API có kiểm tra quyền. |
| V3 | Đúng sáu mục `manifest.json`, `route.geojson`, `checkpoints.json`, `waypoints.json`, `hazards.geojson` và `guidance.json`. |
| V4 | Tên mục khớp chính xác, không trùng, không thừa hoặc thiếu. Chỉ chấp nhận ZIP lưu trực tiếp theo định dạng CTMS-052. Giới hạn đọc 20 MiB và kiểm tra CRC, header, vị trí dữ liệu. |
| V5 | Manifest là JSON hợp lệ, schema 1 và đúng Trip/package version. |
| V6 | Năm payload có đủ khai báo path, kích thước và SHA-256 khớp nội dung. |
| V7 | Ghi kết quả cho đúng artifact sau khi kiểm tra xong và phiên xác minh còn hiệu lực. Khi bị hủy trước khi ghi, ứng dụng có thể xác minh lại. |

## Dữ liệu cục bộ và kích hoạt

| Bản ghi trong thư mục theo tài khoản | Nội dung |
| --- | --- |
| `.part`, `.zip` và journal tải `.json` | Cơ chế CTMS-053, gồm metadata đúng artifact. `downloaded` chỉ biểu thị transfer hoàn tất. |
| `.integrity` theo artifact | Kết quả `verified` hoặc `failed`, gắn Trip, version, package ID, SHA-256 và size. `pending` và `verifying` là trạng thái chạy, không ghi thành kết quả bền vững. |
| `.active` theo Trip | Tham chiếu đầy đủ tới artifact đã kích hoạt. Kết quả xác minh và tham chiếu active được ghi qua tệp tạm rồi đổi tên. |
| `.access-denied` theo Trip | Chặn đọc cục bộ sau khi API từ chối quyền. Metadata được cấp quyền lại sẽ gỡ chặn. |

Lần kích hoạt đầu tiên có thể khôi phục từ metadata cục bộ đã pin của CTMS-053. Metadata có `activationAllowed: false` ngăn tạo tham chiếu mới. Khi đã có tham chiếu active, chỉ đổi sang phiên bản cao hơn sau khi xác minh và kiểm tra lại quyền kích hoạt của đúng artifact qua API. Offline và ongoing giữ tham chiếu cũ. Cổng đọc `openActive` kiểm tra lại file cục bộ và trả byte đã được kiểm tra cho đúng phiên bản yêu cầu.

## Nghiệm thu

| Phạm vi | Bằng chứng trong repo |
| --- | --- |
| AC-01, AC-02, AC-05, AC-06 | Integration Flutter với filesystem thật và API giả lập. Kiểm tra resume 70%, hủy trong xác minh, khôi phục offline và tải lại từ byte 0. |
| AC-03, AC-04 | Unit test ZIP, SHA-256, giới hạn định dạng, manifest và từng payload. Integration kiểm tra file đã lưu bị đổi hoặc mất. |
| AC-07, AC-08 | Integration kiểm tra đổi phiên bản trước khởi hành, giữ bản active khi bản mới lỗi hoặc Trip đã bắt đầu, quyền bị từ chối và đọc offline. |
| AC-09, AC-10 | Widget test các trạng thái, kiểm thử hồi quy downloader và các bộ kiểm thử API CTMS-053. |
