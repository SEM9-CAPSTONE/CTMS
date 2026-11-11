# CTMS — Design System (trích xuất từ Figma `CTMS`)

> Nguồn: Figma file `ZVcXE1A5CplWlTVjrg8Hlv` — 31 frame, Page 1.
> Đây là **single source of truth** cho cả `apps/web` (React + Tailwind v4) và `apps/mobile` (Flutter).
> Mọi màu/spacing/component mới phải tham chiếu file này, không hardcode.

---

## 1. Design tokens

### 1.1 Màu thương hiệu

| Token | Hex | Dùng cho |
|---|---|---|
| `brand.primary` | `#164027` | Nút chính, sidebar active text, tiêu đề nhấn, logo |
| `brand.secondary` | `#2D5A27` | Hover nút chính, viền nhấn |
| `brand.accent` | `#276143` | Link, icon nhấn, badge outline |
| `brand.light` | `#EEF7F0` | Nền item sidebar active, nền badge success nhạt, nền icon box |
| `brand.bg` | `#F4F7F2` | Nền trang (page background) |
| `brand.dark` | `#10221B` | Text chính |

> ⚠️ **Cần sửa:** `apps/mobile/lib/core/theme/app_colors.dart` đang dùng `trailGreen = #2F6D4F`.
> Giá trị này **không khớp** Figma và không khớp `apps/web/src/index.css`. Phải đổi về `#164027`.

### 1.2 Màu trạng thái

| Token | Hex | Ngữ nghĩa trong CTMS |
|---|---|---|
| `status.success` | `#16A34A` | An toàn, Hoạt động, Đã xác nhận, Đã thanh toán, Trực tuyến |
| `status.warning` | `#D97706` | Cần chú ý, Chờ xác nhận, Chờ duyệt, Chậm tiến độ, Rủi ro TB |
| `status.danger`  | `#DC2626` | Nguy hiểm, Khẩn cấp, SOS, Tạm dừng, Mất kết nối, Tranh chấp |
| `status.info`    | `#0284C7` | Đang xử lý, Đang sử dụng, Thông tin hệ thống |
| `status.neutral` | `#64748B` | Đã đóng, Đã hủy, N/A |

### 1.3 Màu trung tính

| Token | Hex |
|---|---|
| `surface` | `#FFFFFF` |
| `surface.muted` | `#F8FAF8` |
| `border` | `#E5EAE6` |
| `border.strong` | `#CBD5E1` |
| `text.primary` | `#10221B` |
| `text.secondary` | `#4B5563` |
| `text.muted` | `#9CA3AF` |

### 1.4 Màu theo vai trò (role accent)

Sidebar/branding đổi nhẹ theo persona (giữ `brand.primary` làm nền tảng):

| Vai trò | Tên hiển thị trong Figma | Accent |
|---|---|---|
| Admin | `CTMS — HỆ THỐNG QUẢN LÝ` | `#164027` |
| Host | `CTMS — HỆ THỐNG QUẢN LÝ` | `#164027` |
| Porter | `CTMS Porter — Nhân viên vận chuyển` | `#A85F28` (trail clay, dùng cho icon/nhấn phụ) |
| Camper | `CAMPER HUB — HỆ THỐNG KHÁM PHÁ` | `#2C6E8E` (alpine lake, dùng cho icon/nhấn phụ) |

### 1.5 Typography

Font: system sans (`Inter` / `SF Pro` / `Roboto`). Không dùng serif.

| Style | Size / Weight / Line-height | Dùng cho |
|---|---|---|
| `display` | 32 / 700 / 40 | Số liệu KPI lớn |
| `h1` | 28 / 700 / 36 | Tiêu đề trang ("Quản lý sự cố") |
| `h2` | 20 / 600 / 28 | Tiêu đề section, tên chuyến |
| `h3` | 16 / 600 / 24 | Tiêu đề card |
| `body` | 14 / 400 / 20 | Nội dung chính |
| `body-strong` | 14 / 600 / 20 | Giá trị trong bảng, tên người |
| `caption` | 12 / 400 / 16 | Mô tả phụ, timestamp |
| `label` | 11 / 600 / 16, `letter-spacing: 0.06em`, UPPERCASE | Nhãn KPI, header bảng |

### 1.6 Spacing & bo góc

- Grid 4pt; bước chuẩn: `4, 8, 12, 16, 20, 24, 32, 40`
- Padding card: `20–24`
- Gap giữa card: `16`
- Radius: `card = 12`, `input/button = 10`, `badge/pill = 999`, `avatar = 999`, `icon-box = 10`
- Shadow card: `0 1px 2px rgba(16,34,27,0.04)`; hover: `0 12px 24px -6px rgba(22,64,39,0.08)`

---

## 2. Component library (quan sát từ Figma)

### 2.1 AppSidebar
- Rộng `240px`, nền trắng, border phải `1px #E5EAE6`, full height.
- Đầu: logo chữ `CTMS` (`h2`, `brand.primary`) + dòng phụ uppercase `label` màu `text.muted`.
- Nav item: cao `40px`, icon 18px (lucide) + label `body`.
  - Mặc định: text `text.secondary`, không nền.
  - **Active**: nền `brand.light`, text + icon `brand.primary`, weight 600, thanh nhấn 3px `brand.primary` ở cạnh phải (Admin) hoặc cạnh trái (Porter/Camper).
- Đáy: `Hỗ trợ`, `Đăng xuất` (đỏ `status.danger`), rồi khối user: avatar 32px + tên (`body-strong`) + vai trò (`caption`, uppercase).

### 2.2 AppHeader
Một hàng, cao `56px`, nền trắng, border dưới:
- Trái: breadcrumb `Tổng quan › <Trang>` (`caption`, item cuối màu `brand.primary`) **hoặc** ô search bo tròn.
- Phải: pill trạng thái kết nối (`● Đã kết nối trực tiếp` — chấm `status.success`), icon `wifi`, `bell` (có badge số), `settings`, avatar + tên + ID.

### 2.3 PageHeader
- `h1` + subtitle `body` màu `text.secondary`.
- Bên phải: 1 nút outline + 1 nút filled primary (vd `Xuất danh sách` + `Báo cáo sự cố`).

### 2.4 StatCard (KPI)
- Card trắng, radius 12, padding 16–20, xếp thành hàng ngang `6 cột` (Admin/Porter) hoặc `4–6 cột` (Host).
- Cấu trúc: `label` (uppercase, muted) → giá trị `display` (số 2 chữ số zero-pad: `01`, `04`, `12`) → icon nhỏ hoặc delta (`+12%`).
- Giá trị tô màu theo ngữ nghĩa: bình thường `text.primary`, cảnh báo `status.warning`, nguy hiểm `status.danger`, tích cực `status.success`.
- Card đang được chọn/nhấn: thêm border trên 2px màu trạng thái.

### 2.5 Badge / StatusPill
- Radius full, padding `4px 10px`, `caption` weight 600.
- **Soft** (mặc định): nền = màu trạng thái @10%, text = màu trạng thái. VD `Chờ xác nhận`, `Đã xác nhận`, `Rủi ro thấp`.
- **Solid** (nhấn mạnh): nền đặc, chữ trắng. VD `ĐANG MỞ` (success), `NGUY HIỂM` (danger), `HẠN CHẾ` (warning), `PHÊ DUYỆT` (info).
- Có thể kèm chấm tròn 6px hoặc icon 12px ở đầu.

### 2.6 DataTable
- Header: `label` uppercase, muted, nền trắng, border dưới.
- Row cao `56–64`, border dưới `1px #E5EAE6`, hover nền `surface.muted`.
- Cột đầu thường là mã (`INC-2024-001`, `BK-88219`) màu `brand.primary` weight 600 → clickable.
- Cột người: avatar 32px + tên (`body-strong`) + phụ đề (`caption`).
- Cột cuối: badge trạng thái, rồi `⋮` kebab hoặc `Chi tiết`.
- Có checkbox chọn nhiều → hiện **BulkActionBar** nổi ở đáy: nền `brand.primary`, chữ trắng, hiển thị `N Đã chọn N thành viên` + các nút hành động + nút `×`.
- Footer: `Hiển thị 1–10 của 1,284 …` bên trái + pagination bên phải (nút số, active = nền `brand.primary` chữ trắng).

### 2.7 FilterBar
- Hàng ngang: ô search (icon kính lúp) + các `Select` outline + link `Xóa bộ lọc` (màu `brand.accent`).
- Có thể có hàng **chip filter** phía dưới: pill chọn/bỏ chọn (`Tất cả`, `Bình thường`, `Cần chú ý`, `Ngoại tuyến`…), chip active = nền `brand.primary` chữ trắng.
- Chip "đang lọc theo" có nút `×` để gỡ.

### 2.8 Tabs
- Underline style, tab active: chữ `brand.primary` + gạch chân 2px. Kèm badge số lượng bên cạnh nhãn.

### 2.9 AlertBanner
- Thanh ngang, radius 12, **border trái 4px** màu trạng thái, nền = màu @8%.
- Icon tròn 32px + tiêu đề (`h3`, màu trạng thái) + mô tả (`body`) + timestamp bên phải.
- Nút hành động ở đáy: 1 filled + 1 outline (`Xác nhận` / `Xem chi tiết`).
- Biến thể **Emergency**: nền đặc `status.danger`, chữ trắng, chiếm full width trên cùng nội dung (vd `SOS: 01 YÊU CẦU HỖ TRỢ CHƯA XỬ LÝ`) + nút trắng `XỬ LÝ NGAY`.

### 2.10 DetailDrawer (panel phải)
- Rộng `320–360px`, nền trắng, bo góc trái, có nút `×`.
- Cấu trúc: badge trạng thái → tiêu đề → mã → lưới thông tin 2 cột (`label` + giá trị) → card phụ (thời tiết / checklist / timeline) → nhóm nút hành động dính đáy (1 primary full-width + 2 outline chia đôi).

### 2.11 ChecklistCard
- Nền `surface.muted`, radius 12.
- Tiêu đề `label` uppercase.
- Item: ô vuông 16px bo 4px — đã xong = nền `status.success` + dấu ✓ trắng; chưa xong = viền `border.strong` rỗng. Text `body`.
- Kèm thanh progress mảnh (4px, radius full, track `#E5EAE6`, fill `brand.primary`) + `Hoàn thành 6/8`.

### 2.12 MapPanel
- Bản đồ Leaflet, radius 12, overlay:
  - Cụm nút zoom `+ / −`, `locate`, `layers`, `fullscreen` xếp dọc góc phải trên (nút trắng 32px, radius 8, shadow).
  - **Legend card** góc dưới trái: nền trắng, liệt kê loại marker.
  - **Marker pill**: nền trắng, radius full, avatar nhỏ + tên porter/thành viên; marker SOS = tròn đỏ đặc.
  - Vòng tròn cảnh báo bán trong suốt cho `VÙNG NGUY HIỂM` / `VÙNG SẠT LỞ`.

### 2.13 TimelineList
- Cột dọc, mỗi mục: chấm tròn 8px màu trạng thái + đường nối dọc + `body-strong` tiêu đề + `caption` mô tả + thời gian.

### 2.14 ChatPanel (Trợ lý sinh tồn AI)
- 3 cột: lịch sử hội thoại (trái) — khung chat (giữa) — chủ đề liên quan (phải).
- Bong bóng user: nền `brand.primary`, chữ trắng, bo góc, canh phải.
- Bong bóng AI: nền trắng viền `border`, canh trái, có avatar tròn `brand.primary`.
- Trả lời AI dùng danh sách đánh số; dưới cùng là **quick action row**: `Mở bản đồ` / `Liên hệ khẩn cấp` (outline) + `SOS Gửi SOS` (solid danger).
- Dưới bong bóng: icon copy / like / dislike + link `Báo cáo`.
- Composer: input bo 12, icon đính kèm + mic + nút gửi tròn `brand.primary`. Disclaimer `caption` bên dưới.

### 2.15 Nút (Button)
| Biến thể | Style |
|---|---|
| `primary` | nền `brand.primary`, chữ trắng, radius 10, cao 40 |
| `secondary` | nền trắng, viền `border.strong`, chữ `text.primary` |
| `ghost` | không nền, chữ `brand.accent` |
| `danger` | nền `status.danger`, chữ trắng |
| `fab` | tròn 48px, nền `brand.primary`, shadow, góc phải dưới (màn Admin) |

---

## 3. Layout shell (desktop)

```
┌────────────┬──────────────────────────────────────────────┐
│            │  AppHeader (breadcrumb / search / actions)   │
│ AppSidebar ├──────────────────────────────────────────────┤
│  240px     │  PageHeader (h1 + subtitle + actions)        │
│            │  StatCard row (4–6 cột)                      │
│            │  [AlertBanner nếu có]                        │
│            │  Tabs + FilterBar                            │
│            │  ┌──────────────────────┬─────────────────┐  │
│            │  │  Nội dung chính      │  Rail phải      │  │
│            │  │  (bảng / map / form) │  (320–360px)    │  │
│            │  └──────────────────────┴─────────────────┘  │
│            │  Footer: © 2024 CTMS CORE · V.2.4.1          │
└────────────┴──────────────────────────────────────────────┘
```

Footer trạng thái hệ thống (màn Admin/Host): `● GPS: ACTIVE  ● SAT-LINK: OPTIMAL  ● DB: SYNCED`.

---

## 4. Quy ước nội dung

- **Ngôn ngữ UI: tiếng Việt.** Giữ nguyên các thuật ngữ tiếng Anh có trong Figma: `Weather Risk`, `Offline Maps`, `Emergency Broadcast`, `SOS`, `Camper`, `Host`, `Porter`, `Checkpoint`, `Basecamp`, `Workspace`.
- Số đếm nhỏ zero-pad 2 chữ số: `01`, `04`, `12`. Số lớn có dấu phẩy: `1,284`.
- Tiền tệ: `2.450.000đ` hoặc `450.000 VNĐ` / `125.4M VND`.
- Ngày: `24/07/2026`, khoảng: `15 - 21 Tháng 5, 2024`, tương đối: `10 phút trước`.
- Mã: `TRK-DA-2026-001`, `INC-2024-001`, `BK-88219`, `#VH-9021`, `SOS-TN02-004`, `KH-9021`.
