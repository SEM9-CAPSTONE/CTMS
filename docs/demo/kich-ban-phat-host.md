# Kịch bản demo – Phạt Host vì không quyết định thời tiết

> Dữ liệu có sẵn sau `npx pnpm seed`. Web: http://localhost:5173. Mật khẩu các Host: `Host@123`, Admin: `Admin@123`.

## Quy tắc (để giải thích với hội đồng)

- Dự báo ngày đi chuyển **Đỏ** thì Host phải quyết định **Giữ / Dời lịch / Huỷ** trước giờ đi **24 tiếng** (T-24h).
- Quá T-24h mà Host im lặng, **quyết định đầu tiên của Admin** (giữ, dời, tạm dừng hoặc huỷ) sẽ tạo **một khoản phạt** cho Host. Đến **T-6h** vẫn chưa ai quyết, **hệ thống tự huỷ**, hoàn tiền 100% cho Camper, và Host cũng bị phạt.
- Bậc phạt, đếm trong **90 ngày**, khoản đã được miễn thì không tính:

| Lần | Mức trừ | Trần | Hậu quả thêm |
|---|---|---|---|
| 1 | 5% giá trị đơn | 2.000.000 đ | — |
| 2 | 10% | 5.000.000 đ | **Khoá tạo / gửi chuyến 14 ngày** |
| 3 | 15% | 10.000.000 đ | **Đình chỉ** tạo chuyến |

- Tiền phạt được trừ khi **quyết toán** chuyến (ví Host). Host có quyền **xin miễn phạt** (bất khả kháng) trong hạn, Admin **duyệt** (hoàn tiền phạt, gỡ khoá) hoặc **từ chối** (có lý do).

## Dữ liệu có sẵn

| Host | Khoản phạt | Trạng thái |
|---|---|---|
| **Nguyễn Thị Ban Mai** (`host@ctms.local`) | "Hòa Bắc – Khám phá bản làng Cơ Tu" – lần 1 | **Đã được miễn** (Admin duyệt) |
| | "Tiên Sa – Nghỉ dưỡng và dã ngoại ven biển" – lần 1 | **Đang áp dụng**, còn hạn xin miễn (hệ thống tự huỷ ở T-6h) |
| **Phan Văn Lộc** (`host.blocked@ctms.local`) | "Nam Ô – Đi bộ ven rạn đá" – lần 1 | Xin miễn **bị từ chối** |
| | "Bà Nà – Cắm trại giữa rừng xanh" – lần 2 | **Đang khoá 14 ngày**, xin miễn **chờ Admin duyệt** |
| **Đỗ Thị Hạnh** (`host.suspended@ctms.local`) | "Hồ Hòa Trung – Dã ngoại bên hồ" – lần 1 | Đang áp dụng |
| | "Sông Cu Đê – Hành trình qua thung lũng" – lần 2 | Đang áp dụng |
| | "Núi Thần Tài – Nghỉ chân bên suối" – lần 3 | **Đình chỉ**, xin miễn **quá hạn chưa xem** |

## Các bước demo (khoảng 5 phút)

**1. Host thấy khoản phạt và xin miễn** (cửa sổ thường)
1. Đăng nhập `host@ctms.local` → menu **Ví**.
2. Thẻ **Phạt thời tiết**: khoản "Tiên Sa" (lần 1, đã trừ vào ví), khoản "Hòa Bắc" (đã miễn, đã hoàn tiền).
3. Bấm **Xin miễn phạt** ở khoản "Tiên Sa" → nhập lý do, ví dụ *"Đêm trước chuyến đi tôi nhập viện cấp cứu nên không thể vào hệ thống quyết định"* → gửi.
   → Khoản phạt chuyển sang **Chờ duyệt miễn**.

**2. Admin duyệt / từ chối** (cửa sổ ẩn danh)
1. Đăng nhập `admin@ctms.local` → **Quản lý thời tiết** → tab **Phạt Host** (có số đếm yêu cầu chờ duyệt).
2. Lọc **Chờ duyệt miễn**:
   - "Tiên Sa" (vừa gửi) → **Duyệt** → tiền phạt được hoàn vào ví Host, khoản phạt thành **Đã miễn**.
   - "Bà Nà – Cắm trại giữa rừng xanh" (Phan Văn Lộc, lần 2) → **Từ chối** + lý do, hoặc **Duyệt** để gỡ khoá 14 ngày.
   - "Núi Thần Tài" có nhãn **Quá hạn xem**, cho thấy Admin cần xử lý trong 5 ngày làm việc.
3. Quay lại cửa sổ Host → **Ví**: khoản "Tiên Sa" hiện **Đã miễn** kèm dòng **hoàn phạt**.

**3. Hậu quả khoá / đình chỉ**
1. Đăng xuất, đăng nhập `host.blocked@ctms.local` → **Tạo chuyến** (hoặc gửi duyệt) → bị chặn: *đang bị khoá đến ngày …*.
2. Đăng nhập `host.suspended@ctms.local` → **Tạo chuyến** → bị chặn vì **đình chỉ**.

## ⚠️ Lưu ý thứ tự khi demo
- Khi Admin **can thiệp** một chuyến Đỏ mà Host chưa trả lời ("Hải Vân – Dọc sườn núi ven biển", "Sơn Trà – Ngắm biển từ sườn phía tây"), hệ thống **tạo phạt cho `host@`**.
  - Nếu khoản "Tiên Sa" **chưa được miễn**, đó là **lần 2**, nên `host@` bị **khoá tạo chuyến 14 ngày**.
  - Vì vậy: **demo phần Phạt Host (bước 1–2, duyệt miễn "Tiên Sa") trước**, rồi mới demo Admin can thiệp. Hoặc demo can thiệp ở cuối buổi.
- Muốn làm lại từ đầu: chạy lại `npx pnpm seed`. Lệnh này xoá dữ liệu, nhớ khởi động lại API sau đó.
