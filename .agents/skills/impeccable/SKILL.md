---
name: impeccable
description: >
  Applies the Impeccable design framework to audit, refine, and elevate UI/UX across
  the React frontend (ehub-reactjs-fe). Eliminates AI UI slop (nested card abuse, decorative
  icon clutter, harsh gradients, mismatched tokens) and enforces high-end typographic rhythm,
  whitespace balance, minimalist data density, and design consistency.
---

# Impeccable UI Design Skill

## Purpose

Enforce high-end, human-crafted design quality across all React components and pages in the CTMS project.
Act as an autonomous "Design Director & Aesthetic Refinement Engine" that eradicates generic "AI slop"
and produces polished, production-grade interfaces following clean typography, consistent spacing, and minimalist elegance.

## When to Trigger This Skill

Trigger this skill whenever:
- User asks to "polish UI", "refine UI", "make it look cleaner/better/more professional".
- User runs or mentions `/impeccable`, `distill`, `quieter`, `polish`, `audit`, or `bolder`.
- Creating or refactoring UI components, pages, dashboard metrics, data tables, or modals.
- Reviewing frontend pull requests or checking UI compliance with project standards.

---

## Core Directing Vocabulary

When instructed or executing UI refinements, apply these specialized design modes:

| Directive | Focus | Actions Taken |
|---|---|---|
| **`/impeccable distill`** (hoặc **`quieter`**) | Giảm rác thị giác, thanh lọc giao diện | Loại bỏ Card lồng Card, gỡ bỏ viền/border thừa, xóa các icon trang trí bên cạnh nhãn số, thay thế các khối hộp ngột ngạt bằng khoảng trống whitespace tinh tế. |
| **`/impeccable polish`** | Đánh bóng chi tiết vi mô (Micro-refinement) | Chuẩn hóa border thanh mảnh (`border-border/60`), đổ bóng siêu nhẹ (`shadow-xs`), bo góc đồng bộ (`rounded-lg`), chuyển động hover êm ái (`transition-colors duration-150`). |
| **`/impeccable audit`** (hoặc **`critique`**) | Kiểm định chất lượng toàn diện | Soát xét tỷ lệ tương phản chữ (WCAG AA), phân cấp font, nhịp thở padding/gap, độ nhất quán bảng màu thương hiệu (`#164027`), copywriting thuần Việt. |
| **`/impeccable bolder`** | Tăng lực nhấn thị giác (Visual punch) | Đẩy mạnh độ tương phản cho số liệu chính (KPIs lớn, đậm), làm rõ nút hành động chính (Primary CTA), tạo điểm neo mắt rõ ràng cho người dùng. |

---

## 7 Nguyên tắc Vàng của Impeccable trong CTMS

### 1. Visual Hygiene — Chống AI Slop & Nested Card Abuse
- **Tuyệt đối không lồng Card trong Card**: Khi nội dung đã nằm trong một Section hoặc Page Card, chia nhỏ các phân khu bằng divider thanh mảnh (`border-b border-border/40`) hoặc khoảng cách (`space-y-4` / `gap-4`). Tuyệt đối không bọc thêm các hộp `Card` viền dày bên trong.
- **Không lạm dụng bóng đổ & viền gân**: Chỉ dùng `shadow-xs` hoặc `shadow-sm`. Không dùng `shadow-md`, `shadow-lg`, hay border dày 2px cộm mắt.
- **Không dùng gradient tùy tiện**: Cấm các dải gradient tím/xanh ngẫu nhiên (`from-blue-500 to-indigo-600`). Chỉ sử dụng màu nền chuyển tiếp êm dịu theo đúng tone xanh rêu / camping (`#164027`) của thương hiệu.

### 2. Icon Minimalism — Không gắn icon rác
- **Không icon hóa nhãn chữ**: Tuyệt đối không gắn icon trang trí nhỏ cạnh tiêu đề các thẻ chỉ số (không gắn icon lịch cạnh "Đơn đặt chỗ", la bàn cạnh "Chuyến đi", % cạnh "Hoa hồng").
- **Icon chỉ dùng khi có mục đích thao tác (Affordance)**: Icon chỉ dùng ở nút hành động (như `Eye` để xem chi tiết, `Search` trong ô tìm kiếm, mũi tên phân trang `ChevronRight`).

### 3. Typographic Hierarchy — Phân cấp nhịp điệu thông tin
- **Ba tầng thông tin sắc nét**:
  1. *Primary Metric / Value*: `text-2xl` hoặc `text-3xl font-bold tracking-tight text-foreground`. Con số phải lớn, đanh, dễ đọc.
  2. *Label / Section Name*: `text-xs font-medium text-muted-foreground tracking-wide`. Nhỏ, gọn gàng, nằm phía trên con số.
  3. *Context / Supporting Meta*: `text-xs text-muted-foreground/80`. Thông tin giải thích phụ ngắn nằm phía dưới.
- Không để các đoạn văn bản hiển nhiên dài dòng làm loãng dashboard.

### 4. Spacing Rhythm — Nhịp thở không gian 4px
- Luôn tuân thủ thang spacing chuẩn: `gap-2` (8px), `gap-3` (12px), `gap-4` (16px), `gap-6` (24px).
- Padding trong card: `p-4` đến `p-6` đồng đều 4 phía. Không dùng padding lệch (ví dụ `pt-8 pb-2`).
- Tạo khoảng thở thoáng đãng giữa các khối chức năng (`space-y-6`).

### 5. Color Tokens & Semantic Tone
- Luôn sử dụng Semantic Tokens của hệ thống: `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`.
- Giữ vững tone thương hiệu Camping: Xanh rêu đậm `#164027`, xanh bổ trợ `#2d6a4f`, viền sáng `#dfe8df`.
- **StatusBadge**: Sử dụng màu pastel dịu mắt (`bg-emerald-50 text-emerald-700 border-emerald-200`), tuyệt đối không dùng màu neon chói lóa.

### 6. Data-Dense Tables & Pop-up Patterns
- Danh sách quản lý luôn dùng `DataTable` + `Pagination` + `FilterBar`.
- Hàng trong bảng thông thoáng, chỉ hiển thị dữ liệu cốt lõi ngắn gọn.
- Mọi chi tiết phức tạp xem qua pop-up (`DetailModal`) khi bấm icon `Eye`.
- Không lặp lại 2 lần thông tin tổng tiền / số lượng trong cùng một view/modal.

### 7. Pure Vietnamese UX Copywriting
- Giao diện súc tích, trực diện, thuần Việt 100%.
- Không chèn tiếng Anh đan xen hoặc trong ngoặc đơn (cấm `(User ID)`, `(Audit History)`, `Status`, `Action`).
- Dùng từ ngữ tự nhiên: `"Lịch sử"`, `"Ghi chú"`, `"Chuyến đi"`, `"Quyết toán"`.

---

## Quy trình Thực hiện Refactor UI với Impeccable

1. **Scan**: Quét toàn bộ component đang xét, tìm kiếm:
   - Các thẻ `Card` lồng nhau.
   - Các icon trang trí bên cạnh nhãn text.
   - Các mã màu hardcoded hoặc gradient lạ.
   - Chữ tiếng Anh lọt vào UI.
2. **Distill (Thanh lọc)**:
   - Tháo bỏ các wrapper `div` hoặc `Card` thừa.
   - Gỡ bỏ icon trang trí vô bổ.
   - Thu gọn các dòng mô tả hiển nhiên.
3. **Harmonize (Chuẩn hóa)**:
   - Áp dụng phân cấp Typography chuẩn (Label nhỏ + Con số lớn + Phụ chú).
   - Căn chỉnh padding, gap theo nhịp 4px.
   - Kết nối với shared components (`Card`, `StatusBadge`, `DataTable`, `Button`).
4. **Polish (Đánh bóng)**:
   - Bổ sung hover states (`hover:bg-muted/50 transition-colors`).
   - Đảm bảo empty state, loading skeleton và error state đều đạt độ hoàn thiện cao.
