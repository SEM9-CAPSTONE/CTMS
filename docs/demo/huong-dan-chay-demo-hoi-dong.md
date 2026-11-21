# Hướng dẫn chạy demo trước hội đồng (máy bất kỳ)

> Dành cho người chạy máy demo. Làm lần lượt từ trên xuống. Tổng thời gian chuẩn bị khoảng 20–30 phút.

## 1. Lấy code mới nhất

```powershell
cd <thư mục CTMS>
git checkout develop
git pull
npx pnpm install
cd apps/mobile; flutter pub get; cd ../..      # chỉ cần nếu demo app mobile
```

## 2. Bật database

Mở Docker Desktop, chờ biểu tượng chuyển xanh, rồi:

```powershell
docker compose up -d postgres redis
```

## 3. Cấu hình `services/api/.env`

Mở file `services/api/.env` (không có thì copy từ `.env.example` ở thư mục gốc). **Thêm hoặc sửa** các dòng sau, giữ nguyên các dòng khác:

```env
# Giữ dự báo thời tiết của dữ liệu mẫu suốt buổi demo (không để thời tiết thật ghi đè)
WEATHER_FORECAST_REUSE_MINUTES=240
TRIP_WEATHER_MONITOR_WORKER_ENABLED=false
TRIP_WEATHER_DECISION_WORKER_ENABLED=false

# Đăng nhập bằng Google (Client ID công khai, không phải mật khẩu)
GOOGLE_CLIENT_IDS=757690970182-jcbc2a06sjm2hjnbvfuv9ni60nvc9782.apps.googleusercontent.com
```

Gửi mã OTP qua email cần thêm 6 biến `SMTP_*`. Xin Huy hoặc leader, **không gửi qua nhóm chat chung**.

## 4. Cấu hình web `apps/web/.env`

Tạo file `apps/web/.env` với nội dung:

```env
VITE_GOOGLE_CLIENT_ID=757690970182-jcbc2a06sjm2hjnbvfuv9ni60nvc9782.apps.googleusercontent.com
```

> Đăng nhập Google chỉ chạy ở địa chỉ `http://localhost:5173` và chỉ với Gmail nằm trong danh sách Test users trên Google Cloud.

## 5. Nạp dữ liệu mẫu (khoảng 9:30–10:00, trước giờ demo)

> ⚠️ Lệnh này **xoá sạch** database trên máy rồi tạo lại. Các mốc thời gian thời tiết ("còn 10 giờ", "còn 6,5 giờ") tính từ lúc chạy lệnh, nên **chạy sát giờ demo**.

```powershell
npx pnpm seed
```

Chạy xong, cuối log phải có các dòng `[seed:weather-demo] Weather and penalty demo ready` và `Phát hiện điểm nóng: … mới từ … lần lệch tuyến`.

## 6. Chạy hệ thống

Mở 2 cửa sổ terminal:

```powershell
# Cửa sổ 1 – API (Swagger: http://localhost:3000/api/docs)
cd services/api; npx pnpm start:dev

# Cửa sổ 2 – Web
cd apps/web; npx pnpm dev
```

Mở **http://localhost:5173**. Nếu trang hiện một dự án khác, máy đang có web khác chiếm cổng 5173: tắt nó đi rồi chạy lại web.

## 7. Tài khoản

| Vai trò | Email | Mật khẩu | Tên hiển thị |
|---|---|---|---|
| Admin | `admin@ctms.local` | `Admin@123` | Lê Minh Tuấn |
| Host | `host@ctms.local` | `Host@123` | Nguyễn Thị Ban Mai |
| Camper | `camper@ctms.local` | `Camper@123` | |
| Porter | `porter@ctms.local` | `Porter@123` | |
| Host bị khoá tạo chuyến (phạt lần 2) | `host.blocked@ctms.local` | `Host@123` | Phan Văn Lộc |
| Host bị đình chỉ (phạt lần 3) | `host.suspended@ctms.local` | `Host@123` | Đỗ Thị Hạnh |

Mẹo: mở 1 cửa sổ thường và 1 cửa sổ ẩn danh để đăng nhập Host và Admin cùng lúc.

## 8. Kịch bản demo theo chức năng

### 8.1 Thời tiết – Host quyết định
Host → danh sách chuyến → **"Bà Nà – Khám phá rừng nguyên sinh"** → thẻ **Quyết định thời tiết** (mức Đỏ, hạn chót T-24h, giờ tự huỷ T-6h) → **Dời lịch** + lý do → **Gửi quyết định** → **Nhật ký quyết định**.
Thêm: **"Ngũ Hành Sơn – Hành trình qua các hang động"** → **Giữ** + lý do.

### 8.2 Thời tiết – Admin can thiệp
Admin → **Quản lý thời tiết** → tab **Cần xử lý**:
- **"Sơn Trà – Ngắm biển từ sườn phía tây"**: nhãn **Khẩn** (còn khoảng 10 giờ);
- **"Núi Chúa – Khám phá đường rừng Hòa Vang"**: hiện giờ hệ thống sẽ tự huỷ (còn khoảng 6,5 giờ);
- **"Hải Vân – Dọc sườn núi ven biển"**: Host chưa trả lời → Admin **Tạm dừng** hoặc **Huỷ vì thời tiết** + lý do.

**"Tiên Sa – Nghỉ dưỡng và dã ngoại ven biển"**: đã bị **Hệ thống tự huỷ ở T-6h**, Camper được hoàn tiền 100%, Host bị phạt lần 1.

### 8.3 Phạt Host
Xem mục riêng ở file `docs/demo/kich-ban-phat-host.md`.

### 8.4 AI kiểm tra lại và cấu hình ngưỡng
Admin → Quản lý thời tiết → tab **Cần xem lại ngưỡng** (ngưỡng và AI chấm khác nhau) → tab **Cấu hình ngưỡng** (nhập gió Đỏ = 500 → bị chặn).

### 8.5 Camper trả lời dời lịch (web hoặc mobile)
Camper → **Đơn đặt chỗ** → **"Bà Nà – Hành trình qua suối và rừng"** (trạng thái *Chờ xác nhận lại*) → **Giữ chỗ ở lịch mới** hoặc **Huỷ và hoàn 100%**. Mỗi đơn chỉ trả lời được 1 lần.

### 8.6 Điểm nóng an toàn (Sprint 5)
Admin → **Hệ thống → Điểm nóng an toàn** → mở một điểm: bằng chứng là các lần lệch tuyến, xa nhất bao nhiêu mét, từ bao nhiêu chuyến. Swagger (đăng nhập Admin, bấm Authorize): `POST /api/admin/safety-hotspots/detect` → `candidatesCreated: 0`, `skipped.ALREADY_COVERED` (không tạo trùng).

### 8.7 Đánh giá hệ thống (Sprint 5, Swagger, tài khoản Admin)
- `POST /api/evaluations/weather-risk/run` body `{}` → `INVALID`, tỉ lệ khớp, bỏ sót Đỏ.
- `POST /api/evaluations/realtime/run` body `{}` → `PASSED`, SOS P95, thông báo P95/P99.
- Token Swagger chỉ dùng được **15 phút**. Gặp lỗi 401 thì đăng nhập lại và Authorize lại.

### 8.8 Đăng nhập bằng Google
Trang đăng nhập → **Đăng nhập bằng Google** → chọn Gmail trong danh sách Test users. Gmail chưa có tài khoản sẽ tự tạo tài khoản Camper.

## 9. Nếu có sự cố
- Thẻ quyết định không hiện, hoặc dự báo chuyển Xanh → kiểm tra bước 3 (`WEATHER_FORECAST_REUSE_MINUTES=240`), khởi động lại API, chạy lại `npx pnpm seed`.
- Trang trắng → kiểm tra cửa sổ API còn chạy (`http://localhost:3000/api/docs` mở được).
- Swagger báo 401 → token hết hạn, đăng nhập lại.
