# CTMS — Figma Screen Inventory (31 frame)

Thứ tự theo prototype. Dùng kèm `CTMS-DESIGN-SYSTEM.md`.
Cột **Target** cho biết màn đó thuộc `apps/web` hay `apps/mobile` (theo `app_router.dart`: Flutter chỉ phục vụ Camper + Porter).

| # | Frame | Persona | Target |
|---|---|---|---|
| 1 | Trang chủ công khai — CTMS Landing Page | Public | web |
| 2 | Đăng nhập — CTMS Portal | Public | web + mobile |
| 3 | Đăng ký tài khoản — CTMS Portal | Public | web + mobile |
| 4 | Tổng quan vận hành CTMS (Light Mode) | Admin | web |
| 5 | Quản lý khu cắm trại | Admin | web |
| 6 | Quản lý đặt chỗ | Admin | web |
| 7 | Quản lý thiết bị toàn hệ thống | Admin | web |
| 8 | Quản lý Porter | Admin | web |
| 9 | Theo dõi chuyến đi toàn hệ thống | Admin | web |
| 10 | Quản lý sự cố toàn hệ thống | Admin | web |
| 11 | Rủi ro thời tiết | Admin | web |
| 12 | Báo cáo toàn hệ thống | Admin | web |
| 13 | Cấu hình hệ thống | Admin | web |
| 14 | Quản lý tuyến trekking | Admin | web |
| 15 | Tổng quan vận hành — Host Dashboard | Host | web |
| 16 | Quản lý khu cắm trại (Host) | Host | web |
| 17 | Chỉnh sửa sơ đồ — Chi tiết đặt lều | Host | web |
| 18 | Quản lý đơn đặt chỗ — Host Dashboard | Host | web |
| 19 | Theo dõi chuyến đi — Host Dashboard | Host | web |
| 20 | Quản lý khách hàng — Host Dashboard | Host | web |
| 21 | Khám phá khu cắm trại — Camper Explorer | Camper | **mobile** |
| 22 | Chuyến đi của tôi — Camper Hub | Camper | **mobile** |
| 23 | Tổng quan — Camper Hub | Camper | **mobile** |
| 24 | Trợ lý sinh tồn AI — Camper Hub | Camper | **mobile** |
| 25 | Hồ sơ & Cài đặt — Camper Hub | Camper | **mobile** |
| 26 | Lịch phân công — Porter Dashboard | Porter | **mobile** |
| 27 | Tổng quan — Porter Dashboard | Porter | **mobile** |
| 28 | Quản lý sự cố — Porter Dashboard | Porter | **mobile** |
| 29 | Bản đồ chuyến đi — Porter Dashboard | Porter | **mobile** |
| 30 | Thành viên đoàn — Porter Dashboard | Porter | **mobile** |
| 31 | Trung tâm cảnh báo — Porter Dashboard | Porter | **mobile** |

---

## A. Public

### 1. Landing Page (`/`)
Header trong suốt trên hero: logo `CTMS` + nav `Home · Explore · Trekking · Safety · About` + `Login` + nút `Sign up` (primary).
Sections theo thứ tự:
1. **Hero** — 2 cột. Trái: eyebrow `Sẵn sàng cho mọi hành trình cắm trại và trekking`, H1 `Hệ thống quản lý an toàn và trải nghiệm ngoài trời hàng đầu Việt Nam. Tích hợp AI, bản đồ offline và cứu hộ thông minh.`, nút `Khám phá ngay →` (primary) + `Tìm hiểu thêm` (outline), rồi 4 feature-chip card: `Bản đồ Offline`, `GPS Chính xác`, `Thời tiết thực`, `Trợ lý AI`. Phải: ảnh cắm trại bo 16px + 2 floating card: `⚠ Cảnh báo rủi ro — Khu vực có gió mạnh` (góc trên phải) và `👥 Trạng thái — Còn 12 chỗ trống` (góc dưới trái).
2. **SearchPanel** — card trắng nổi đè lên hero: `Địa điểm` / `Ngày đi` / `Số người` / `Loại hình` + nút `🔍 Tìm kiếm` (primary).
3. **Địa điểm nổi bật** — `Những cung đường và bãi cắm được yêu thích nhất tháng này` + link `Xem tất cả ›`. Grid 4 card: ảnh + badge rating `★ 4.9` góc phải trên, tên, `📍 địa điểm`, chip thời tiết (`Thời tiết: Rất tốt` / `Có sương mù` — màu theo trạng thái), giá + nút mũi tên tròn.
4. **Tính năng thông minh đột phá** — grid 3×2 card: `Tìm kiếm thông minh`, `Sơ đồ trực quan`, `Offline Maps`, `GPS & Định vị cứu hộ`, `Cảnh báo thời tiết`, `AI Survival Assistant`. Mỗi card: icon-box 48px nền `brand.light` + tiêu đề `brand.primary` + mô tả.
5. **An toàn ngay cả khi mất kết nối** — trái: ảnh mockup bản đồ 3D isometric; phải: 5 dòng checklist ✓ + nút `Khám phá tính năng an toàn`.
6. **CTMS AI Assistant** — băng nền `brand.primary`, chữ trắng, gồm accordion FAQ (trái) + demo chat (phải).
7. **Mobile App** — mockup điện thoại + list tính năng 2 cột + nút `Google Play` / `App Store`.
8. **CTA cuối** + **Footer** 4 cột (CTMS / Khám phá / Hỗ trợ / Liên hệ) + dòng bản quyền.

### 2. Đăng nhập (`/login`)
Split 50/50. **Trái**: ảnh núi full-bleed, overlay tối nhẹ; logo `CTMS` (icon vuông trắng bo 10px + chữ) góc trên; tiêu đề `Sẵn sàng cho hành trình tiếp theo`; 4 chip kính mờ 2×2: `Offline Maps`, `Weather Risk`, `AI Analytics`, `GPS Tracking`; chân trang `🛡 Hệ thống quản lý leo núi đạt chuẩn quốc tế`.
**Phải**: nền trắng, `Chào mừng trở lại` + `Đăng nhập để tiếp tục hành trình của bạn.`; field `Email hoặc Số điện thoại` (icon user), `Mật khẩu` (icon khoá + toggle mắt); hàng `☐ Ghi nhớ` — `Quên mật khẩu?`; nút `Đăng nhập →` (primary full-width); nút `Đăng ký tài khoản mới` (outline full-width); divider `Hoặc đăng nhập bằng`; 2 nút social `Google` / `Lark`; link `Bạn chưa có tài khoản? Đăng ký ngay`; `🏠 Quay về trang chủ`.

### 3. Đăng ký (`/register`)
Card giữa màn. Tiêu đề `Tham gia CTMS`. **Stepper 5 bước**: `1 Vai trò` · `2 Tài khoản` · `3 Cá nhân` · `4 Nghiệp vụ` · `5 Xác minh` (bước active = tròn `brand.primary` chữ trắng; còn lại xám).
Bước 1 `Chào bạn, bạn là ai?`: 3 **RoleSelectionCard** dọc, mỗi card = icon-box + tên vai trò (`brand.primary`) + mô tả + badge điều kiện + 2 dòng ✓ lợi ích:
- `Camper` — Yêu thiên nhiên, muốn khám phá và trải nghiệm các chuyến trekking.
- `Host` — Cung cấp dịch vụ lưu trú, bãi cắm trại chuyên nghiệp. Badge cam `TÀI KHOẢN CẦN XÉT DUYỆT`.
- `Porter` — Người dẫn đường, hỗ trợ vận chuyển trang thiết bị leo núi. Badge xanh `CẦN MÃ MỜI/XÁC MINH`.
Nút `Tiếp tục` (primary, canh phải). Chân: `Bạn đã có tài khoản? Đăng nhập ngay` + `Trang chủ` · `Trợ giúp`.

---

## B. Administrator Portal

Sidebar Admin (13 mục): `Tổng quan · Khu cắm trại · Đặt chỗ · Thiết bị · Tuyến trekking · Porter · Theo dõi chuyến đi · Sự cố · Rủi ro thời tiết · Báo cáo · Cấu hình` + `Đăng xuất`.

### 4. Tổng quan vận hành CTMS
Banner đỏ `SOS: 01 yêu cầu chưa xử lý — Vị trí: Trạm kiểm soát số 3 - Nhóm Tà Năng 02` + nút `XỬ LÝ NGAY`.
2 card cảnh báo: `SỰ CỐ ĐANG MỞ — 2 Sự cố (1 hỏng lều, 1 lạc đường)`, `CẢNH BÁO THỜI TIẾT — Mưa lớn tại Bidoup sau 16:00` + badge `CẦN CHÚ Ý`.
KPI 7 cột: `CÔNG SUẤT 85%` · `SLOT CÒN TRỐNG 12` · `ĐANG CHỜ 08` · `CHUYẾN TREKKING 05` · `PORTER 14` · `THIẾT BỊ 42` · `DOANH THU 125.4M VND`.
Dưới: **MapPanel** `Theo dõi thời gian thực (Lâm Đồng - Đắk Lắk)` (trái, ~2/3) + **Hoạt động gần đây** timeline (phải).
Nút header: `Xuất báo cáo` (primary) + `⟳ Làm mới` (outline). FAB tròn góc phải dưới.

### 5. Quản lý khu cắm trại
KPI 5: `TỔNG SỐ KHU 12` · `ĐANG HOẠT ĐỘNG 08` · `CHỜ PHÊ DUYỆT 02` · `TẠM DỪNG 02` · `TỔNG SỐ SLOT 156`.
FilterBar: search + `Trạng thái: Tất cả` + `Tỉnh/Thành phố` + `Sắp xếp theo: Ngày cập nhật`.
Bảng: `HÌNH ẢNH | CAMPSITE & ĐỊA ĐIỂM | QUẢN LÝ | KHU VỰC/SLOT | HIỆU SUẤT | THỜI TIẾT | TRẠNG THÁI | THAO TÁC`.
Cột hiệu suất = progress bar + `%`. Thời tiết = chấm màu + `RỦI RO THẤP/TB/CAO`. Trạng thái = badge `HOẠT ĐỘNG` / `CHỜ DUYỆT` / `TẠM DỪNG`.
Nút header: `+ Tạo khu cắm trại` (primary) + `⟳ Làm mới`.

### 6. Quản lý đặt chỗ
KPI 2 hàng: `Tổng đơn 1,245 (+12%)` · `Đang chờ xác nhận 42 (Phản hồi TB: 15 phút)` · `Tổng doanh thu 450.2M` · `Tranh chấp 05` · `Xung đột 02 (Overbooking)` // `Đang hoạt động 156` · `Đã hủy 28` · `Yêu cầu hoàn tiền 12 (Hạn chót xử lý: 24h)`.
Header: date-range picker `01/10/2023 - 31/10/2023` + `Xem Audit Log` + `Xuất dữ liệu` (primary).
Filter: `Tìm kiếm` / `Khu cắm trại` / `Trạng thái` / `Check-in/out` + toggle `Xung đột` + `Đặt lại`.
Bảng: `Mã đơn | Camper | Host / Khu cắm trại | Vị trí | Thời gian | Tổng tiền | Trạng thái | Xung đột | ⋮`. FAB `+`.

### 7. Quản lý thiết bị
2 AlertBanner: đỏ `Cảnh báo bảo trì — 05 thiết bị an toàn quá hạn kiểm tra` (link `Xử lý ngay`) + cam `Sai lệch tồn kho — Số lượng hệ thống không khớp thực tế tại Host Verdant` (link `Chi tiết`).
KPI 6: `Tổng thiết bị 1,450` · `Sẵn sàng 890` · `Đang sử dụng 420` · `Đang bảo trì 85` · `Bị hỏng/mất 12` · `Quá hạn kiểm tra 5`.
Bảng: `Mã thiết bị | Tên thiết bị | Loại | Host sở hữu | Số lượng | Trạng thái | Bảo trì tiếp theo | ⋮`. Ngày trễ hiển thị đỏ `15/05/2024 (Trễ)`.
Nút: `Xem lịch bảo trì` · `Xuất dữ liệu` · `+ Tạo danh mục thiết bị` (primary).

### 8. Quản lý Porter
KPI 4 card lớn có icon + tag góc phải (`+12%`, `Thực tế`, `Ưu tiên`, `Cảnh báo`): `Tổng Porter 1,284` (820 đang hoạt động) · `Sẵn sàng / Đang chuyển 456/324` (có progress) · `Chờ xác minh 28` (12 hồ sơ quá hạn 48h) · `Rủi ro vận hành 15` (8 Trùng · 7 CC hết hạn).
Dải **insight** 5 cột nền `brand.light`: `CHỨNG CHỈ`, `LỊCH TRÌNH`, `KỸ THUẬT`, `KỶ LUẬT`, `HIỆU SUẤT` — mỗi mục icon + tiêu đề uppercase + 1 câu.
Filter + chip `ĐANG LỌC THEO: Tuyến Fansipan ×` `Có trùng lịch ×` `Xóa tất cả bộ lọc`.
Bảng: `Porter | Host / Khu vực | Tuyến thành thạo | Chứng chỉ | Hoạt động | Đánh giá | Tài khoản | ⋮`.

### 9. Theo dõi chuyến đi toàn hệ thống
Banner đỏ full-width `CẢNH BÁO KHẨN CẤP: Host chưa xác nhận tín hiệu SOS sau 5 phút` + `Tiếp quản xử lý`.
Header: `Cập nhật lúc 20:28` + search + `Cập nhật lúc: Vừa mới đây`.
KPI 5: `Chuyến đang chạy 12` · `Host vận hành 08` · `Thành viên Trekking 156` · `Cảnh báo hệ thống 04` · `SOS chưa xử lý 01`.
3 cột: **Bộ lọc chuyến đi** + danh sách trip card (trái) — **Map** (giữa) — **Chi tiết SOS** (phải).
Trip card: tên tuyến, badge `SOS`, `Host / Porter / Thành viên`, progress %, dòng cảnh báo đỏ.
Panel SOS: người gửi + `VỊ TRÍ`, `PIN THIẾT BỊ 15%`, `TÍN HIỆU Mạng yếu`, `HOST` + **Timeline xử lý** (`14:20 SOS Gửi` / `14:22 Đã gửi Host` / `14:25 Cảnh báo Admin`) + nút `📞 Liên hệ Host` (primary), `Liên hệ Porter`, `Tiếp quản sự cố` (danger), `Phát cảnh báo khẩn cấp` (danger outline), link `Đóng tuyến trekking tạm thời`.

### 10. Quản lý sự cố toàn hệ thống
KPI 6: `Tổng sự cố mở 12` · `Sự cố khẩn cấp 02` · `Chờ xác nhận 03` · `Đang xử lý 05` · `Quá hạn phản hồi 01` · `Đã giải quyết (Hôm nay) 08`.
Filter: `Mã sự cố` / `Host` / `Porter` / `Loại sự cố` / `Mức độ` + checkbox `Có SOS` + nút `Lọc` (primary).
Bảng: `MÃ | LOẠI | CHUYẾN | HOST | MỨC ĐỘ | TRẠNG THÁI | BÁO CÁO | HÀNH ĐỘNG`. Footer legal 2 link.

### 11. Rủi ro thời tiết
Header inline: `Rủi ro thời tiết toàn hệ thống` + `Cập nhật: 26/07/2026 - 14:30 · Nguồn: Trung tâm dự báo KTTV`. Nút `Cấu hình quy tắc` · `Phát cảnh báo` (danger) · `⟳ Làm mới dữ liệu` (primary).
KPI 7: `Campsite An toàn 42` · `Cần chú ý 08` · `Nguy hiểm 03` · `Tuyến bị hạn chế 05` · `Tuyến đã đóng 02` · `Chuyến bị ảnh hưởng 12` · `Dữ liệu cũ 01`.
Filter 5 select + toggle `Chỉ chuyến đang hoạt động`.
Bảng: `Đối tượng | Loại | Host | Khu vực | Mức rủi ro | Mưa | Gió | Nhiệt độ | Tầm nhìn | Dông sét | Cập nhật | ⓘ`.

### 12. Báo cáo toàn hệ thống
Header: date-range + toggle `So sánh` + `Xuất PDF` (primary).
Tabs: `Tổng quan · Đặt chỗ và doanh thu · Khu cắm trại · Trekking · Porter · An toàn và sự cố · Weather Risk`.
KPI grid 4×2 với delta màu: `Tổng người dùng 12,840 (+12%)` · `Tổng campsite 456 (+5 mới)` · `Tổng booking 3,245 (+18%)` · `Tổng chuyến trekking 842 (+8%)` · `Tổng giá trị giao dịch 2.85B VND (+15%)` · `Tỷ lệ hoàn thành 94.2%` · `Số sự cố 24 (-10%)` · `Thời gian phản hồi SOS 2m 15s (-15s)`.
Charts: bar chart nhóm `Tăng trưởng Booking & Doanh thu` (legend Booking / Doanh thu) + donut `Phân bổ sự cố theo mức độ` (Khẩn cấp 12% / Nghiêm trọng 24% / Trung bình 35% / Thấp 29%, tâm `24 TỔNG VỤ`).
Dưới: `Hiệu năng Porter & Host` (list + progress + điểm /10) + `Hiệu năng hệ thống` (`API LATENCY 120ms`, `WEBSOCKET 45ms`, `GPS SYNC ERROR 0.02%`, `AI RETRIEVAL PRECISION 98.5%`) + dòng `Tất cả dịch vụ đang hoạt động bình thường`.

### 13. Cấu hình hệ thống
Grid 2 cột, 4 panel:
- `⚙ Cấu hình chung` — `Tên hệ thống`, `Ngôn ngữ mặc định`, `Múi giờ`, toggle `Chế độ bảo trì (Maintenance)`.
- `🖼 Logo & Nhận diện` — vùng upload + nút `Thay đổi Logo` + `Định dạng hỗ trợ: PNG, SVG. Tối đa 1 MB`.
- `👤 Vai trò & Quyền hạn` — bảng ma trận quyền × 4 vai trò (Admin/Host/Porter/Camper), ô = ✓ xanh hoặc ⊘ xám. Link `✏ Chi tiết`.
- `☁ Weather Rules` — 3 slider: `Trọng số Mưa 45%`, `Trọng số Gió 30%`, `Nhiệt độ tối ưu 25%` + ghi chú.
- `✨ AI Assistant Configuration` — callout đỏ `AI không được phép tự ý thay đổi Weather Risk Score nếu không có sự phê duyệt từ quản trị viên.` + textarea `Prompt Template (Hệ thống)`.
- `🔗 Tích hợp dịch vụ (API)` — 3 dòng: `OpenWeather API` (Đã kết nối), `Google Maps SDK` (Đã kết nối), `Twilio SMS Gateway` (Lỗi xác thực).
Sticky bar đáy: `⚠ Bạn có thay đổi cấu hình chưa được lưu` + `Hủy thay đổi` · `Xem tác động` · `💾 Lưu cấu hình` (primary).

### 14. Quản lý tuyến trekking
KPI 7: `Tổng số tuyến 128 (+4)` · `Chờ phê duyệt 12` · `Đang mở 84` · `Đang hạn chế 15` · `Tạm đóng 9` · `Nguy hiểm 3` · `Weather Risk cao 5` (card cuối nền xanh nhạt highlight).
Toggle view `☰ Danh sách` / `🗺 Bản đồ` + 3 select + `Xóa bộ lọc`.
Bảng: `Tên tuyến (+ tỉnh) | Host | Khu vực | Độ dài / Độ khó | Checkpoints | Weather Risk | Trạng thái | ⋮`.
Badge trạng thái **solid**: `ĐANG MỞ` (green), `NGUY HIỂM` (red), `HẠN CHẾ` (amber), `PHÊ DUYỆT` (blue).

---

## C. Host Dashboard

Sidebar Host (6 mục): `Tổng quan · Khu cắm trại · Đơn đặt chỗ · Theo dõi chuyến đi · Khách hàng · Cài đặt` + `Hỗ trợ` / `Đăng xuất`.

### 15. Tổng quan vận hành (Host)
Dòng context: `🏠 Xin chào Host, Hùng Lâm · 📍 Pine Ridge Campsite · ● Đã kết nối trực tiếp · ⟳ Cập nhật: 14:32`.
Segmented `Hôm nay / 7 ngày qua / 30 ngày qua` + `⤓ Xuất báo cáo`.
KPI 6: `Tổng đơn hôm nay 24 (-12%)` · `Khách check-in 18 (-6%)` · `Vị trí trống 12 (Tăng 4G)` · `Chuyến trekking 05 (2 Đang đi)` · `Khách hàng mới 09 (+4)` · `Cảnh báo cần xử lý 03` (badge `CẦN GẤP`).
Chart `Đơn đặt chỗ trong 7 ngày` (legend `Xác nhận / Chờ xử lý / Bị hủy`, trục T2→CN).
Rail phải: donut `Vị trí cắm trại 70%` (`Đang sử dụng 32 / Còn trống 12 / Bảo trì 01`) + nút `Xem khu cắm trại`; card `Cảnh báo cần xử lý` (3 mục màu) ; `Hoạt động gần đây`.
Bảng `Check-in hôm nay`: `KHÁCH HÀNG | MÃ ĐƠN | VỊ TRÍ | THANH TOÁN | THAO TÁC` (nút `Xem đơn`).
Section `Chuyến trekking đang hoạt động`: row có badge `SOS`/`CẦN HỖ TRỢ`, `Porter · N thành viên · km / km`, `Rủi ro thời tiết`, nút `HỖ TRỢ NGAY` (danger) / `Theo dõi` (outline).

### 16. Quản lý khu cắm trại (Host)
KPI 5 giống Admin. Card `☰ Danh sách khu cắm trại` + search.
Bảng: `KHU VỰC | HOST | CẤU TRÚC (04 Khu / 48 Slot) | SLOT TRỐNG (badge) | HIỆU SUẤT (bar + %) | THỜI TIẾT | TRẠNG THÁI | ⋮`.
Nút `+ Tạo khu cắm trại`. FAB góc phải dưới.

### 17. Chỉnh sửa sơ đồ — Chi tiết đặt lều
Trình chỉnh sơ đồ kéo-thả: canvas lưới với các slot hình chữ nhật (viền nét đứt = trống, nét liền xanh = đã đặt), toolbar zoom `100%`, legend đáy (`Khả dụng / Bảo trì / K. khả dụng`).
Header: `Xem trước` · `Lưu bản nháp` · `Xuất bản sơ đồ` (primary).
Panel phải **Thuộc tính Slot** (badge mã `B01`): `MÃ SLOT`, `KHU VỰC` (select `Zone B - Ven suối`), `LOẠI LỀU` + `SỨC CHỨA`, `GIÁ THUÊ (VND/ĐÊM) 350,000`; card `KHOẢNG CÁCH TIỆN ÍCH` (`Nhà vệ sinh 45m`, `Nguồn nước 12m`); card `THÔNG TIN ĐẶT LỀU` (`TENT-B01-GL / Lều Glamping Cao Cấp` + chip tiện ích `Nệm nội`, `Đèn tích điện`, `Bàn ghế camping`); `TRẠNG THÁI MẶC ĐỊNH` = 3 chip chọn (`Khả dụng` / `Bảo trì` / `Đóng cửa`); nút `Lưu thay đổi` (primary) + icon xoá đỏ.

### 18. Quản lý đơn đặt chỗ (Host)
KPI 6: `TỔNG ĐƠN THÁNG NÀY 450 (+12%)` · `CHỜ XÁC NHẬN 12` · `ĐÃ XÁC NHẬN 320` · `CHECK-IN HÔM NAY 15` · `ĐÃ HỦY 08` · `DOANH THU DỰ KIẾN 125.4M VND`.
Tabs có badge: `Tất cả 450 · Chờ xác nhận 12 · Đã xác nhận 320 · Đang sử dụng 15 · Hoàn thành 85 · Đã hủy 18`.
Filter + toggle view `▦ Bảng` / `📅 Lịch`.
Bảng: `MÃ ĐƠN | KHÁCH HÀNG | KHU CẮM TRẠI | KHÁCH | THỜI GIAN | TỔNG TIỀN | THANH TOÁN | TRẠNG THÁI ĐƠN | ⋮`.
Nút `⤓ Xuất dữ liệu` + `+ Tạo đơn đặt chỗ` (primary).

### 19. Theo dõi chuyến đi (Host)
Banner đỏ `SOS: 01 YÊU CẦU HỖ TRỢ CHƯA XỬ LÝ - NHÓM TÀ NĂNG 02` + `Gửi lúc 14:20 (12 phút trước)` + `XỬ LÝ NGAY`.
3 cột: danh sách `ĐANG HOẠT ĐỘNG (4)` (mỗi item: tên chuyến, chấm trạng thái, `👥 12 Thành viên`, 2 ô nhỏ `RỦI RO TT` + `TRẠNG THÁI`) — **Map** với marker porter/SOS — panel `Chi tiết sự cố SOS` (badge `KHẨN CẤP`, `ID: SOS-TN02-004`, avatar + tên + nhóm, các dòng `Chuyến đi / Vị trí (GPS) / Độ chính xác / Pin thiết bị / Thời gian gửi`, card mô tả `Chấn thương chân` in nghiêng, nút `Xác nhận đã nhận` (primary) + `📞 Porter` / `👥 Điều phối`).

### 20. Quản lý khách hàng (Host)
KPI 6: `Tổng khách hàng 1,284 (+12%)` · `Khách hàng mới 48 (+5)` · `Khách quay lại 312 (24%)` · `Đang lưu trú 14` · `Đang trekking 08` · `Cần hỗ trợ 02`.
Filter: search + `Phân loại khách` + `Trạng thái hiện tại` + `Campsite đã dùng` + `Xóa bộ lọc`.
Bảng: `Khách hàng (avatar + tên + mã KH) | Thông tin liên hệ | Đơn/Chuyến (badge `8 đơn` + `3 trekking`) | Đơn gần nhất | Trạng thái | Ngày tham gia | ⋮`.
Nút `⤓ Xuất danh sách`.

---

## D. Camper Hub (→ Flutter)

Sidebar Camper: `Tổng quan · Khám phá địa điểm · Đơn đặt chỗ · Chuyến đi của tôi · Trợ lý sinh tồn AI · Hồ sơ & cài đặt`. Brand `CAMPER HUB / HỆ THỐNG KHÁM PHÁ`. Đáy: avatar + tên + `THÀNH VIÊN PRO` + `Logout`.

### 21. Khám phá khu cắm trại
H1 `Tìm địa điểm cho chuyến đi tiếp theo` + subtitle.
SearchPanel card: `Địa điểm` (icon 📍, `Đà Nẵng, Việt Nam`) / `Ngày nhận phòng` / `Ngày trả phòng` / `Số người` + nút `🔍 Tìm kiếm` (primary).
Dòng kết quả: `124 địa điểm` + `khu vực miền Trung` — bên phải toggle grid/list + `Sắp xếp: Phổ hiến nhất`.
Grid 2 cột card: ảnh + icon ♡ góc phải + badge an toàn góc trái dưới ảnh (`✓ An toàn` green / `⚠ Cần chú ý` amber / `✕ Nguy hiểm` red) + tên + `📍 địa điểm` + 2 dòng meta (độ khó, số vị trí cắm trại) + `★ 4.6 (124)` + giá `Từ 350.000đ / đêm` + nút `Xem chi tiết`.
Cột phải: **mini map giá** với các pill giá (`350k`, `250k`, `450k`) + card preview `Bản đồ tương tác` + nút `Mở rộng bản đồ`.
Pagination `1 2 3 … 12`. Footer `CTMS · © 2024 Hệ thống quản lý và điều hành cắm trại an toàn` + `Quy định an toàn · Trung tâm trợ giúp · Chính sách bảo mật`.

### 22. Chuyến đi của tôi
H1 + subtitle `Quản lý các chuyến cắm trại và trekking của bạn` + nút `Khám phá chuyến đi mới` (primary).
KPI 5: `CHUYẾN SẮP TỚI 02` · `ĐANG HOẠT ĐỘNG 01` · `ĐÃ HOÀN THÀNH 14` · `TỔNG QUÃNG ĐƯỜNG 248 km` · `CAMPSITE ĐÃ ĐI 09`.
Tabs `Tất cả (17) · Sắp diễn ra (2) · Đang hoạt động (1) · Đã hoàn thành (14) · Đã hủy (0)` + `Bộ lọc` + `Mới nhất`.
**Trip hero card**: ảnh nền lớn + badge `SẮP DIỄN RA` + tên chuyến + `📍 Đà Nẵng, Việt Nam` + đồng hồ đếm ngược `Bắt đầu trong 03 Ngày` (góc phải). Thân card: 4 ô `Thời gian / Thành viên / Độ khó / Trạng thái`; `Tiến độ chuẩn bị (75%)` = 4 item checklist 2 cột (`Danh sách thành viên — Xong`, `Dụng cụ cá nhân — Xong`, `Thiết bị cắm trại — Đang soạn`, `Dữ liệu ngoại tuyến — Chưa tải`); avatar stack `+1`; nút `Chi tiết tuyến` (outline) + `Tiếp tục chuẩn bị` (primary).
Card chuyến đang hoạt động: tên + badge + progress `85%` + link `Xem hành trình` + 3 ô `VỪA ĐI QUA / SẮP TỚI / THỜI TIẾT VÙNG` (ô cuối màu cảnh báo).
Rail phải: `Lịch sử chuyến đi` (item: ảnh nhỏ + tên + ngày + chip `100km` `3 Ngày` + rating sao + nhãn `4.0 (Trải nghiệm tốt)`); card đỏ `✳ Hỗ trợ Khẩn cấp` + nút trắng `NHẤN GIỮ (SOS)`; card `Mẹo chuẩn bị` + link `ĐỌC THÊM CẨM NANG ›`.

### 23. Tổng quan — Camper Hub
Hero banner ảnh: `Thứ Sáu, 24/07/2026` + `Chào buổi sáng, Minh!` + mô tả + nút `Khám phá địa điểm` (primary) + `Xem chuyến đi` (outline trắng).
`Thông báo quan trọng` (rail phải, link `Tất cả`): 3 dòng có màu (`Cập nhật hồ sơ`, `Số liệu ngoại tuyến`, `Danh sách vật dụng`).
Card `Chuyến đi sắp tới` + badge `Đã xác nhận`: tên chuyến, ngày + số ngày, lưới 4 ô `Thành viên / Độ khó / Porter phụ trách / Rủi ro thời tiết`, nút `Xem chi tiết chuyến đi` (primary).
Card `Chuẩn bị trước chuyến đi 68%` + progress + 5 dòng checklist với trạng thái bên phải (`Xong` / `Đã tải` / `Chưa tải` đỏ / `Chưa xác nhận` xám).
4 **quick action** card icon: `Trung tâm cẩm nang`, `Xem chuyến đi`, `Hỗ trợ AI`, `Cập nhật hồ sơ`.
Card `Rủi ro thời tiết` badge `Cần chú ý`: 4 chỉ số (`Khả năng mưa 45%`, `Sức gió 12 km/h`, `Nhiệt độ 24-26°C`, `Tầm nhìn 10 km`) + callout in nghiêng + nút `Xem chi tiết`.
Bảng `Giao dịch gần đây` (`Mã đơn | Địa điểm | Ngày lưu trú | Khách | Tổng tiền | Trạng thái`) + link `Xem tất cả ›`.
Section `Gợi ý dành cho bạn`: 3 card ảnh + badge góc (`Còn 4 chỗ` / `Sắp kín chỗ` / `Còn 12 chỗ`) + tên + `📍` + giá `/ người` + nhãn trạng thái.

### 24. Trợ lý sinh tồn AI
3 cột. **Trái**: nút `+ Cuộc trò chuyện mới` (primary full-width), search `Tìm lịch sử...`, nhóm `HÔM NAY` / `7 NGÀY QUA` với các item (item active = nền `brand.light` + gạch trái).
**Giữa**: breadcrumb + H1 `Trợ lý sinh tồn AI` + badge `● Đang trực tuyến`. Hội thoại: bubble user xanh đậm canh phải; bubble AI trắng canh trái có avatar; nội dung AI = danh sách đánh số **1/2/3** với tiêu đề in đậm. Quick actions: `🗺 Mở bản đồ` · `📞 Liên hệ khẩn cấp` (outline) · `SOS Gửi SOS` (danger solid). Hàng icon copy/👍/👎 + `⚠ Báo cáo`. Composer + disclaimer `AI có thể mắc sai lầm. Luôn ưu tiên thiết bị cứu hộ chuyên dụng.`
**Phải** `Chủ đề liên quan`: 3 card icon (`Sơ cứu cơ bản`, `Sinh tồn rừng sâu`, `Thời tiết cực đoan`); callout amber `⚠ Cảnh báo y tế` (chữ in nghiêng); mini map `Vị trí hiện tại — Hoàng Liên Sơn, Việt Nam`.

### 25. Hồ sơ & Cài đặt
Header phụ: `Quản lý thông tin cá nhân, an toàn, thông báo và tài khoản của bạn để đảm bảo trải nghiệm tham gia tốt nhất.`
Rail phải trên: `Hoàn thiện hồ sơ 80%` + progress + card amber `⚠ Cần hành động: Thêm người liên hệ khẩn cấp / Xác minh số điện thoại`.
**Sub-nav dọc (trái)**: `👤 Hồ sơ cá nhân · ✉ Thông tin liên hệ · ✳ Thông tin khẩn cấp · 🩺 Sức khỏe & thể lực · 🎒 Thiết bị cá nhân · 🔔 Thông báo · 🔒 Quyền riêng tư · 🛡 Bảo mật tài khoản`.
**Nội dung**: card avatar (ảnh 72px + nút camera) + tên + badge `● Thành viên Pro` + `Tham gia từ 2021` + nút `Thay đổi ảnh`.
Card `Thông tin cá nhân` (icon ✏ sửa): `Họ và tên` / `Ngày sinh` / `Giới tính` (select) / `Địa chỉ` / `Giới thiệu ngắn` (textarea).
Card `Kinh nghiệm & Kỹ năng`: `Kinh nghiệm cắm trại`, `Kinh nghiệm trekking`, `Ngôn ngữ` = chip có `×` + nút `+ Thêm ngôn ngữ`.

---

## E. Porter Dashboard (→ Flutter)

Sidebar Porter: `Tổng quan · Chuyến được phân công · Bản đồ · Thành viên đoàn · Sự cố · Cảnh báo · Hồ sơ & cài đặt`. Brand `CTMS Porter / Nhân viên vận chuyển`.

### 26. Lịch phân công
H1 `Lịch phân công` + `Theo dõi và xác nhận các ca trekking được giao cho bạn`.
KPI 4: `Chuyến hôm nay 01 (đang chuẩn bị)` · `Chuyến sắp tới 04 (tuần này)` · `Chờ xác nhận 02 (cần gấp)` · `Đã xác nhận 12 (tất cả)`.
Toolbar: toggle `Lịch` / `Danh sách` + điều hướng tuần `‹ 15 - 21 Tháng 5, 2024 ›` + `Hôm nay` + select `Trạng thái`.
**Calendar tuần**: cột theo ngày (`T3, 15/05` … cột hôm nay được highlight nền `brand.light` + nhãn `(Hôm nay)`). Event card trong ô: giờ `05:30 - 18:00`, tên chuyến, badge góc, dòng meta, nút `Mở Workspace` (primary) hoặc màu viền theo trạng thái (xanh = đã xác nhận, cam = chờ xác nhận, đỏ = cảnh báo).
**DetailDrawer phải**: badge `ĐANG DIỄN RA`, tên chuyến, `Mã chuyến: #TRK-2024-0517`; lưới 2×2 `CAMPSITE / ĐỘ KHÓ / TẬP TRUNG / PORTER TRƯỞNG`; card thời tiết (icon ☀ + `An toàn` + `Xác suất mưa 10% · Gió 12km/h` + câu trích + `28°C`); `Trạng thái chuẩn bị` + progress + `Hoàn thành 6/8` + 4 checkbox; card `Gói ngoại tuyến — Sẵn sàng · 128MB` + nút `Gửi liên kết mở trên ứng dụng di động`; nút `Mở Workspace` (primary full-width) + icon share.

### 27. Tổng quan — Porter
Header: search `Tìm kiếm chuyến đi, nhân sự, bản đồ...` + pill `● Đã kết nối trực tiếp` + icon wifi/mobile/settings.
Breadcrumb + H1 `Tổng quan công việc` + `Chào buổi sáng, Anh Minh. Theo dõi lịch phân công, chuyến đang hoạt động và các cảnh báo cần xử lý.` + `Hôm nay: 24/07/2026` + nút `📅 Xem chuyến hôm nay` (primary).
KPI 6: `Chuyến hôm nay 01` · `Chuyến sắp tới 04` · `Chờ xác nhận 02` (cam) · `Đang hoạt động 01` · `Cảnh báo xử lý 03` (đỏ) · `Sự cố đang mở 00`.
**Card chuyến chính**: icon-box xanh + `Trekking Sơn Trà – Bãi Bắc` + `Mã chuyến: TRK-DA-2026-001`; góc phải `WEATHER RISK ⊘ An toàn` + `DỮ LIỆU OFFLINE ⛁ Sẵn sàng (128MB)`.
Lưới 2×2 có icon: `📍 Địa điểm & Tuyến` (Campsite Bãi Đá Đen / Tuyến chân núi - Đỉnh bản cờ) · `🎫 Vai trò & Quy mô đoàn` (Porter trưởng (Leader) / Đoàn 06 thành viên • Độ khó: Trung bình) · `🕐 Thời gian dự kiến` (Tập trung 05:30, Bắt đầu 06:00) · `✓ Tiến độ chuẩn bị (5/7)` + progress.
Card `CHECKLIST CHUẨN BỊ` — 7 checkbox 2 cột.
3 nút: `Mở workspace` (primary) · `Xem tuyến` · `Xem thành viên` (outline).
**MapPanel** với chip toạ độ `📍 Toạ độ hiện tại: 16.1215° N, 108.2882° E`.
Rail phải: `Lịch sắp tới` + `Tất cả` (3 item: tên + campsite + ngày + badge `ĐÃ XÁC NHẬN` / `CHỜ XÁC NHẬN` / `LÊN LỊCH`); `Thành viên cần chú ý` (avatar + tên + dòng cảnh báo màu); `⚠ Cảnh báo gần đây` (2 mục có icon + mô tả + `10 phút trước`); `Hoạt động gần đây` (timeline chấm màu).

### 28. Quản lý sự cố — Porter
H1 + `Báo cáo và theo dõi các sự cố trong chuyến trekking` + nút `📖 Xem hướng dẫn khẩn cấp` (outline) + `🛡 Báo cáo sự cố` (primary).
KPI 6: `Sự cố đang mở 12` · `Chờ Host xác nhận 04` · `Đang xử lý 05` · `Đã điều hỗ trợ 02` · `Đã giải quyết 28` · `Nghiêm trọng 01` (đỏ, card viền đỏ).
Tabs `Tất cả · Đang mở · Đang xử lý · Đã giải quyết · Đã đóng`.
Filter: `Mã/Tên...` + `Tất cả chuyến` + `Loại sự cố` + `Mức độ` + `Trạng thái` + date picker.
Bảng: `Mã sự cố | Loại sự cố | Chuyến | Thành viên | Vị trí | Mức độ | Trạng thái | Cập nhật | ›`.

### 29. Bản đồ chuyến đi
Header đặc thù: brand `CTMS Trekking / Porter Dashboard` + breadcrumb + **select chuyến** `Trekking Sơn Trà - Bãi Bắc ⌄` + `● Trực tuyến` + `⇄ Đồng bộ 2 phút trước` + nút `📱 Mở trên ứng dụng di động` (primary).
Banner amber `⚠ Cảnh báo lệch tuyến — Trần Cường lệch tuyến 15m - 5 phút trước` + link `Liên hệ` + nút `Xem trên bản đồ` (solid amber).
3 cột: **trái** search `Tìm thành viên, checkpoint...` + card `ĐANG HOẠT ĐỘNG` (tên chuyến, `Tuyến 02 - Đường ven biển`, 2 ô `Thành viên 12 Người` / `Tiến độ 75%`, dòng `Weather Risk — An toàn`, `Cần chú ý — 1 thành viên` đỏ) + `CHUYẾN SẮP TỚI` (2 item).
**Giữa**: map lớn + cụm nút zoom/locate/layers/fullscreen + marker `CP2: Bãi Đá Đen`, pill `Porter Anh Minh`, `Trần Cường ⚠ 20% • Lệch 15m`, vòng `VÙNG SẠT LỞ` + **card ghi chú đáy**: legend `● Porter chính` + 3 ô (`⇄ Đồng bộ: 1 phút trước — 0 GPS logs chờ tải lên`, `⚠ 1 Thành viên ngoại tuyến — Mất kết nối > 10p` đỏ, ghi chú in nghiêng).
**Phải**: `CHI TIẾT THÀNH VIÊN` (avatar lớn có tick xanh, tên, `Trạng thái: Bình thường`, 2 ô `PIN 85%` / `Sync 2p trước`, `Checkpoint cuối`, `Porter phụ trách`, nút `Lịch sử` + `📞 Liên hệ` primary) + `CHECKPOINT: BÃI BẮC` (`Dự kiến tới 10:30`, `Thực tế tới 10:15 AM (-15p)` xanh, `Thành viên tới 5/6` + progress, nút `Xác nhận Checkpoint` primary full-width).

### 30. Thành viên đoàn
H1 + `Theo dõi trạng thái và thông tin cần thiết của các thành viên trong chuyến.` + select chuyến `Trekking Sơn Trà - Bãi Bắc (TRK-DA-2026-001)` + `⤓ Xuất danh sách` + `🗺 Mở bản đồ đoàn` (primary).
KPI 6 (có vạch màu bên trái): `Tổng thành viên 12` · `Bình thường 08` · `Cần chú ý 02` (cam) · `Ngoại tuyến 01` · `Chậm tiến độ 01` (cam) · `SOS 0`.
Search `Tìm theo tên hoặc số điện thoại...` + 5 nút filter phải (`Chuyến`, `Trạng thái`, `Checkpoint`, `Kết nối`, `Pin`).
Chip filter: `Tất cả · Bình thường · Cần chú ý · Ngoại tuyến · Chậm · Lệch tuyến · Khẩn cấp`.
Bảng có checkbox: `Thành viên (avatar + tên + SĐT) | Vai trò | Checkpoint cuối | Last seen | Pin (icon + %, đỏ nếu thấp) | Kết nối | Trạng thái (badge) | Lưu ý (text màu) | Hành động (Chi tiết)`.
**BulkActionBar** đáy: `2 Đã chọn 2 thành viên` + `✳ Gửi thông báo` · `✓ Xác nhận tới checkpoint` · `⤓ Xuất danh sách` · `×`.

### 31. Trung tâm cảnh báo
H1 + `Theo dõi các cảnh báo về chuyến đi, thời tiết, thành viên và hệ thống` + `✓✓ Đánh dấu tất cả đã đọc` (outline) + `⚙ Cài đặt thông báo` (primary).
KPI 6: `CHƯA ĐỌC 12` · `CẦN XÁC NHẬN 05` · `NGUY HIỂM 02` · `WEATHER RISK 03` · `C.BÁO THÀNH VIÊN 04` · `C.BÁO HỆ THỐNG 01` (mỗi card có icon riêng góc phải).
Tabs có badge: `Tất cả 11 · Chuyến đi 2 · Thời tiết 3 · Thành viên 4 · Khẩn cấp 1 · Hệ thống 1`.
Bộ lọc: `Tất cả các chuyến` / `Mức độ: Tất cả` / `Trạng thái: Chưa đọc` + `⤬ Xóa lọc`.
**Danh sách AlertBanner** (border trái theo mức độ, icon tròn, badge loại, chấm chưa đọc, timestamp `14:20 • Hôm nay`):
- `Weather Risk (Nguy hiểm)` badge `WEATHER` — nút `Xác nhận` (primary) + `Xem chi tiết`.
- `Emergency Broadcast (Khẩn cấp)` badge `SOS`, tiêu đề đỏ — nút `Xác nhận & Phản hồi` (danger) + `Liên hệ Host`.
- `Cảnh báo thành viên (Quan trọng)` badge `THÀNH VIÊN` — nút `Xem bản đồ` (primary) + `Liên hệ thành viên`.
- `Cảnh báo hệ thống (Thông tin)` badge `HỆ THỐNG` — nút `Cập nhật ngay` (outline).
