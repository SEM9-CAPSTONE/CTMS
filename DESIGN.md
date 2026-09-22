# CTMS Web Design System — Lấy `/dashboard` làm Gốc (Single Source of Truth)

Tài liệu này ghi nhận và chuẩn hóa toàn bộ quy chuẩn thiết kế giao diện (UI/UX) của ứng dụng web CTMS (`apps/web`), lấy trang **Dashboard (`/dashboard`)** làm gốc. Mọi trang chức năng trong hệ thống (bao gồm `/trips`, `/trips/:id`, `/profile`, v.v.) bắt buộc phải tuân theo các quy tắc cấu trúc khối, màu nền, thẻ tag và phân cấp thị giác được định nghĩa dưới đây.

---

## 1. Phân tích Hiện trạng: So sánh `/dashboard` và `/trips`

| Đặc điểm | Chuẩn gốc trên `/dashboard` | Khác biệt trước đây trên `/trips` | Hướng chuẩn hóa cho `/trips` |
|---|---|---|---|
| **Màu nền toàn trang** | `bg-[#f4f7f2]` (màu xanh rêu sáng tự nhiên, ấm áp) | Từng dùng `bg-[#f8f9fa]` hoặc dính header trắng 100% | Sử dụng đồng nhất `bg-[#f4f7f2]` cho toàn bộ khung trang. |
| **Cấu trúc Khối (Panels)** | Phân thành các khối panel trắng lớn độc lập: `rounded-[28px] border border-[#dfe8df] bg-white p-6 shadow-sm` nổi bật trên nền `#f4f7f2`. | Header thanh dính tràn viền (sticky 100vw), ô search thả nổi bên ngoài, không thành khối panel thống nhất. | Toàn bộ nội dung đưa vào các khối panel `rounded-[28px] border border-[#dfe8df] bg-white p-6 shadow-sm` đặt trong `max-w-[1440px]`. |
| **Phân loại thẻ Tag (Category / Status Tabs)** | Các pill bo góc `rounded-xl px-3 py-1.5 text-xs font-bold`: <br>- Inactive: `bg-[#f4f7f2] text-[#55685a] hover:bg-[#e7eee7]`<br>- Active: `bg-[#164027] text-white shadow-sm`<br>- Badge số đếm đi kèm: `rounded-full px-1.5 py-0.2 text-[10px]` | Từng dùng pill viền xám trôi nổi hoặc select box truyền thống. | Chuẩn hóa hệ thống Category Tags ở đầu trang dạng khối thẻ tag chuẩn `/dashboard`, có badge đếm số lượng chuyến đi. |
| **Độ rộng khung chứa** | `max-w-[1440px] mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6` | Layout bị loãng do header tách biệt khỏi main content | Main container chuẩn `max-w-[1440px]` với khoảng cách `gap-6` giữa các khối panel. |
| **Thẻ con bên trong (Cards)** | Card bo góc `rounded-2xl border border-[#dfe8df] bg-white`, phân cấp chữ rõ ràng. | Dùng viền xám stone và thiếu sự gắn kết màu sắc thương hiệu. | Đồng bộ thẻ chuyến đi với viền `#dfe8df`, màu chữ `#10221b`, giá nhấn `#164027`. |

---

## 2. Hệ Thống Design Tokens Chuẩn (Từ `/dashboard`)

### 2.1 Màu sắc nền tảng (Color Palette)

- **Page Background (Màu nền trang)**: `#f4f7f2`
  - Class: `bg-[#f4f7f2]`
  - Giúp các khối panel màu trắng `#ffffff` nổi bật rõ nét, tạo cảm giác thư thái của thiên nhiên.
- **Panel Surface (Màu mặt khối)**: `#ffffff`
  - Class: `bg-white`
- **Border chuẩn (Đường viền khối & card)**: `#dfe8df`
  - Class: `border-[#dfe8df]`
- **Subtle Border (Đường phân cách nội bộ)**: `#edf3ed`
  - Class: `border-[#edf3ed]`
- **Văn bản & Tiêu đề**:
  - Tiêu đề chính / Heading: `#10221b` (`text-[#10221b]`)
  - Tiêu đề phụ / Subtitle: `#627769` hoặc `#667a6d` (`text-[#667a6d]`)
  - Kicker / Eyebrow (chữ hoa nhỏ): `#7b8c82` (`text-[#7b8c82]`)
  - Placeholder / Muted: `#8fa096` (`text-[#8fa096]`)
- **Brand Accent (Màu thương hiệu chủ đạo)**:
  - Xanh rừng đậm: `#164027` (`text-[#164027]`, `bg-[#164027]`)
  - Xanh đậm hover: `#0f2e1c` (`hover:bg-[#0f2e1c]`)
  - Xanh nền nhạt (accent tint): `#164027/5` hoặc `#164027/10`

---

## 3. Quy Chuẩn Khối Layout (Container & Panels)

### 3.1 Khung bao trang ngoài (Page Shell)
```tsx
<div className="min-h-screen bg-[#f4f7f2] font-sans text-[#10221b] antialiased">
    <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-6">
            {/* Các khối section panel độc lập */}
        </div>
    </main>
</div>
```

### 3.2 Khối Section Panel Chuẩn
Mỗi phần thông tin chính trên trang phải là một **Panel độc lập**:
```tsx
<section className="rounded-[28px] border border-[#dfe8df] bg-white p-6 shadow-sm">
    {/* Header khối */}
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#7b8c82]">
                EYEBROW / KICKER
            </p>
            <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-[#10221b] sm:text-3xl">
                Tiêu đề Panel
            </h1>
            <p className="mt-1 text-sm font-medium text-[#627769]">
                Mô tả chi tiết nội dung khối.
            </p>
        </div>
    </div>
    
    {/* Nội dung khối */}
</section>
```

---

## 4. Quy Chuẩn Khối Phân Ra Các Tag (Segmented Filter / Category Tags)

Quy chuẩn thẻ Tag phân loại (lấy từ `HostMyTripsPanel` trên `/dashboard`):

### 4.1 Cấu trúc Thanh Tag
```tsx
<div className="flex flex-wrap items-center gap-2 border-t border-[#edf3ed] pt-4">
    <span className="text-xs font-bold text-[#7b8c82] mr-1">Phân loại:</span>
    {tabs.map((tab) => (
        <button
            key={tab.key}
            type="button"
            onClick={() => onSelectTab(tab.key)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                isActive
                    ? "bg-[#164027] text-white shadow-sm shadow-[#164027]/20"
                    : "bg-[#f4f7f2] text-[#55685a] hover:bg-[#e7eee7] hover:text-[#164027]"
            }`}
        >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
                <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
                        isActive ? "bg-white/20 text-white" : "bg-[#dfe8df] text-[#4a5e51]"
                    }`}
                >
                    {tab.count}
                </span>
            )}
        </button>
    ))}
</div>
```

### 4.2 Hành vi tương tác
- **Trạng thái Active**: Nền xanh đậm `#164027`, chữ trắng, badge số mờ `bg-white/20`, đổ bóng nhẹ `shadow-sm shadow-[#164027]/20`.
- **Trạng thái Inactive**: Nền xanh rêu nhạt `#f4f7f2`, chữ xanh xám `#55685a`, badge số `#dfe8df`. Hover chuyển sang `#e7eee7`.

---

## 5. Quy Chuẩn Thẻ Con (Trip Cards) & Lưới 4 Cột

- **Grid container**: `grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4` (chuẩn 4 thẻ trên hàng desktop).
- **Thẻ Card**:
  - Bao ngoài: `rounded-2xl border border-[#dfe8df] bg-white shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-[#164027]/40 hover:shadow-md cursor-pointer`.
  - Ảnh 16:10 sắc nét, bo góc trên.
  - Tag loại chuyến góc trên: kính đen mờ `bg-black/60 backdrop-blur-md text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-full`.
  - Tag độ khó góc phải: `bg-white/90 text-[#10221b] border border-[#dfe8df] px-2.5 py-0.5 rounded-full text-[11px] font-semibold`.
  - Dòng thông tin súc tích: `Ngày • Còn X chỗ • Thời tiết`.
  - Giá vé: `text-base font-extrabold text-[#164027]` đi kèm chữ `/ khách`.

---

## 6. Lộ Trình Áp Dụng Cho `/trips` (SearchTripsPage)

1. **Khối 1: Header & Category Tags Panel**:
   - Chuyển thành panel trắng `rounded-[28px] border border-[#dfe8df] bg-white p-6 shadow-sm`.
   - Có Eyebrow: `TRUNG TÂM KHÁM PHÁ`.
   - Tiêu đề: `Khám phá chuyến đi`.
   - Mô tả: `Tìm kiếm hành trình trekking & dã ngoại kết nối những tâm hồn yêu thiên nhiên.`
   - Hàng Tag phân loại chuẩn Dashboard (`Tất cả`, `Trong ngày`, `Qua đêm`, `Dễ & Thư giãn`, `Thử thách`) với nền `bg-[#f4f7f2]` và badge đếm số.
2. **Khối 2: Bộ Lọc & Tìm Kiếm Panel**:
   - Đặt trong panel trắng đồng bộ `rounded-[28px] border border-[#dfe8df] bg-white p-5 shadow-sm`.
   - Chứa ô tìm kiếm, bộ lọc nâng cao, thanh kéo giá tiền 2 đầu theo VNĐ.
3. **Khối 3: Danh Sách Chuyến Đi Panel**:
   - Panel chứa lưới 4 cột thẻ chuyến đi và thanh phân trang.
   - Khi đang tải (skeleton) hoặc khi rỗng (empty state) đều nằm gọn gàng bên trong khối panel.
