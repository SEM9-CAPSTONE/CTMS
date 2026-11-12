# Impeccable Design Heuristics & Audit Checklist

Tài liệu hướng dẫn kiểm tra và tinh chỉnh giao diện Frontend React theo tiêu chuẩn thẩm mỹ cao cấp Impeccable cho dự án CTMS.

---

## 1. Bảng đối chiếu Heuristics (Checklist)

| Mục kiểm tra | Vi phạm (AI Slop) ❌ | Đạt chuẩn Impeccable ✅ |
|---|---|---|
| **Cấu trúc Thẻ (Card)** | `<Card><Card>...</Card></Card>` (Lồng nhau nhiều lớp viền) | Một `<Card>` ngoài duy nhất, bên trong phân cách bằng spacing hoặc divider mỏng. |
| **Biểu tượng (Icons)** | Gắn icon trang trí cạnh mọi nhãn text (📅 Đơn, 🧭 Chuyến, % Tỷ lệ) | Bỏ icon ở nhãn chữ; chỉ giữ icon ở nút thao tác (👁️ Xem, 🔍 Tìm, ➕ Thêm). |
| **Thẻ chỉ số (Metric Cards)** | Con số nhỏ, nhãn chữ to, kèm đoạn văn giải thích dài dòng | Nhãn trên nhỏ gọn (`text-xs`), con số to nổi bật (`text-2xl font-bold`), thông số phụ ngắn gọn. |
| **Màu sắc & Gradient** | Gradient xanh-tím tùy tiện (`from-indigo-500 to-pink-500`) | Tone màu camping đồng nhất: xanh rêu `#164027`, nền trung tính, border mờ. |
| **Bóng đổ (Elevation)** | `shadow-lg`, `shadow-xl` tạo cảm giác nặng nề | `shadow-xs` hoặc `shadow-sm`, viền mờ `border-border/60`. |
| **Bảng dữ liệu (DataTable)** | Cột nhồi nhét quá nhiều chi tiết, thao tác cồng kềnh | Dữ liệu trên dòng súc tích; xem chi tiết qua `DetailModal` khi bấm `Eye`. |
| **Ngôn ngữ hiển thị** | Tiếng Anh lẫn lộn: "Trạng thái (Status)", "Lịch sử (Audit Log)" | 100% tiếng Việt tự nhiên: "Trạng thái", "Lịch sử", "Ghi chú". |
| **Tái sử dụng Component** | Tự code thẻ `<table>`, `<div>` giả nút bấm, `<span>` giả huy hiệu | Dùng component chuẩn: `DataTable`, `Pagination`, `Button`, `StatusBadge`, `Card`. |

---

## 2. Quy tắc Typography chi tiết

```tsx
// ❌ TRÁNH: Không có nhịp điệu phân cấp, icon trang trí thừa
<div className="p-4 border rounded-xl shadow-lg bg-gradient-to-r from-blue-50 to-indigo-50">
  <div className="flex items-center gap-2">
    <CalendarIcon className="size-4 text-blue-500" />
    <span className="text-base font-semibold">Tổng số đơn đặt chỗ trong hệ thống</span>
  </div>
  <p className="text-xl font-bold text-blue-900 mt-2">1.250</p>
  <p className="text-sm text-gray-500 mt-1">Bao gồm toàn bộ đơn đã hoàn thành và đang xử lý trên toàn sàn</p>
</div>

// ✅ CHUẨN IMPECCABLE: Tinh gọn, thanh lịch, typography phân cấp rõ nét
<Card className="p-5 border-border/70 shadow-xs">
  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
    Đơn đặt chỗ
  </p>
  <p className="text-3xl font-bold text-foreground mt-2 tracking-tight">
    1.250
  </p>
  <p className="text-xs text-muted-foreground/80 mt-1.5">
    94.2% hoàn thành thành công
  </p>
</Card>
```

---

## 3. Quy tắc Bảng dữ liệu & Pop-up (Data Table & Detail Pattern)

1. **Bảng dữ liệu chỉ là nơi quét thông tin (Scanner)**:
   - Giữ độ rộng các cột cân đối.
   - Tránh nhồi nhét các đoạn mô tả dài hoặc lịch sử thao tác vào từng cell của bảng.
2. **Chi tiết sâu đưa vào `DetailModal`**:
   - Khi bấm xem chi tiết (`Eye` button), hiển thị modal tập trung với thông tin đầy đủ.
   - Các nút phê duyệt, từ chối, giải quyết sự cố, xuất hóa đơn đặt tại action footer của modal.
3. **Thanh lọc (FilterBar)**:
   - Dùng pill-tab nền trong suốt hoặc xám nhạt; khi active dùng màu xanh `#164027` chữ trắng.
   - Ô tìm kiếm có icon kính lúp mờ bên trái, có nút xóa nhanh khi có text.

---

## 4. Các lệnh hỗ trợ nhanh

- Khi yêu cầu Agent tinh chỉnh giao diện:
  - `distill`: Ra lệnh gỡ bỏ tất cả các wrapper, viền, icon thừa thãi.
  - `polish`: Ra lệnh căn chỉnh pixel, bo góc, bóng đổ và hiệu ứng hover.
  - `audit`: Ra lệnh chấm điểm toàn bộ component theo 8 tiêu chí trong bảng đối chiếu.
