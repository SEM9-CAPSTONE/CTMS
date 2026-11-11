# CTMS Mobile UI Generator — Figma plugin

Sinh **13 frame mobile 390×844** (Auth 2 · Camper 5 · Porter 6) trên **một Page mới**
trong file Figma của bạn, dựng đúng theo `docs/design/CTMS-DESIGN-SYSTEM.md`.

---

## ⚠️ Trước khi chạy: bạn cần quyền Edit

File `CTMS` hiện đang mở ở chế độ **View only** (xem thanh công cụ dưới cùng Figma).
Ở chế độ này Figma chặn mọi thao tác tạo/sửa, plugin cũng không ghi được gì.

Chọn một trong hai:

- **Cách A (an toàn nhất, khuyến nghị):** `Menu ▾` → **Duplicate to your drafts**.
  Bạn được một bản sao riêng, chạy plugin trên đó. File gốc chứa preview web
  tuyệt đối không bị đụng tới.
- **Cách B:** nhờ chủ file cấp quyền **can edit**, rồi chạy trực tiếp.

---

## Cài đặt

1. Mở **Figma Desktop app** (plugin development không chạy trên trình duyệt).
2. Mở file CTMS (bản đã có quyền edit).
3. Menu `Figma` → **Plugins** → **Development** → **Import plugin from manifest…**
4. Chọn file `D:\Do_an_tot_nghiep\CTMS\figma-plugin\manifest.json`
5. Chạy: `Plugins` → **Development** → **CTMS Mobile UI Generator**

Xong. Figma sẽ tự nhảy sang page mới `📱 CTMS Mobile — Flutter` và zoom vừa khung.

---

## Cam kết an toàn

Plugin **không đọc, không sửa, không xoá** bất kỳ page hay frame nào đang có.
Toàn bộ vòng đời của nó là:

```
figma.createPage()          → tạo page mới, tên tự tăng (v2, v3…) nếu trùng
figma.setCurrentPageAsync() → chuyển sang page mới
page.appendChild(...)       → vẽ vào page mới
figma.closePlugin()
```

Không có lời gọi nào tới `figma.currentPage.findAll`, `.remove()`, hay
`figma.root.children[i]` để ghi. Chạy lại nhiều lần chỉ tạo thêm page mới,
không ghi đè page cũ. **Các frame preview web hoàn toàn không bị ảnh hưởng.**

---

## Nội dung được sinh

| Nhóm | Frame |
|---|---|
| Auth | 01 Đăng nhập · 02 Đăng ký (Bước 1 · Vai trò) |
| Camper Hub | 03 Tổng quan · 04 Khám phá địa điểm · 05 Chuyến đi của tôi · 06 Trợ lý sinh tồn AI · 07 Hồ sơ & Cài đặt |
| Porter Dashboard | 08 Tổng quan · 09 Lịch phân công · 10 Bản đồ chuyến đi · 11 Thành viên đoàn · 12 Quản lý sự cố · 13 Trung tâm cảnh báo |

Mỗi frame gồm StatusBar → AppBar → Body (auto-layout) → BottomNav, đã chuyển thể
từ layout desktop theo đúng quy tắc trong `docs/design/PROMPT-FLUTTER-UI.md`:
sidebar → bottom nav, KPI 6 cột → grid 2 cột, bảng → list card, rail phải → section
xếp dưới, filter bar → chip row cuộn ngang.

---

## Tuỳ chỉnh

Mọi thứ nằm trong `code.js`:

- **Màu / bo góc**: object `T` và `R` ở đầu file.
- **Icon**: object `ICONS` — path SVG lucide 24×24. Thêm icon mới thì dán path vào đây.
- **Component**: `statCard`, `badge`, `card`, `btn`, `alertBanner`, `bottomNav`, `chipRow`…
- **Màn hình**: các hàm `scLogin()`, `scCamperHome()`, `scPorterAlerts()`… — mỗi màn là
  một cây object khai báo, đọc gần như HTML.
- **Sắp xếp trên canvas**: mảng `GROUPS` ở cuối file.

Sửa xong → trong Figma bấm `Ctrl/Cmd + Alt + P` để chạy lại plugin vừa dùng.

---

## Lỗi thường gặp

| Triệu chứng | Nguyên nhân / cách xử lý |
|---|---|
| `❌ Lỗi: Không tải được font` | Máy thiếu cả Inter lẫn Roboto. Cài Inter, hoặc đổi biến `FONT` sang font có sẵn. |
| Plugin chạy nhưng không thấy gì | File đang **View only**. Duplicate to your drafts rồi chạy lại. |
| Không thấy mục **Development** | Đang dùng Figma bản web. Chuyển sang Figma Desktop app. |
| Chữ Việt bị lỗi dấu | Font đang dùng không đủ glyph tiếng Việt — dùng Inter hoặc Roboto. |
