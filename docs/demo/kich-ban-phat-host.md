# Kịch bản demo – Phạt Host vì không quyết định thời tiết

> Dữ liệu có sẵn sau `npx pnpm seed`. Web: http://localhost:5173. Mật khẩu các Host: `Host@123`, Admin: `Admin@123`.

## Quy tắc (để giải thích với hội đồng)

- Dự báo ngày đi chuyển **Đỏ** thì Host phải quyết định **Giữ / Dời lịch / Huỷ** trước giờ đi **24 tiếng** (T-24h).
- Quá T-24h mà Host im lặng, **quyết định đầu tiên của Admin** (giữ, dời, tạm dừng hoặc huỷ) sẽ tạo **một khoản phạt** cho Host. Đến **T-6h** vẫn chưa ai quyết, **hệ thống tự huỷ**, hoàn tiền 100% cho Camper, và Host cũng bị phạt.
- **Cơ sở tính phạt = doanh thu Host của chuyến**: tổng tiền Camper đã thanh toán trừ 5% phí nền tảng (Host nhận 95%). Số tiền được **chốt ngay lúc vi phạm**, trước khi huỷ chuyến và hoàn tiền Camper.
- Bậc phạt, đếm trong **90 ngày**, khoản đã được miễn thì không tính:

| Lần | Mức trừ | Trần | Hậu quả thêm |
|---|---|---|---|
| 1 | 5% doanh thu Host | 2.000.000 đ | — |
| 2 | 10% | 5.000.000 đ | **Khoá tạo / gửi chuyến 14 ngày** |
| 3 | 15% | 10.000.000 đ | **Đình chỉ** tạo chuyến |

Ví dụ: Camper trả 1.500.000 đ → doanh thu Host 1.425.000 đ → phạt lần 1 là **71.250 đ**.

- **Thu tiền phạt:**
  1. Tự **trừ vào ví Host khi quyết toán** các chuyến sau. Ví không bao giờ âm.
  2. Phần chưa trừ được (chuyến bị huỷ nên không có doanh thu), Host **chuyển khoản nộp trong 7 ngày** vào tài khoản Admin cấu hình ở **Tài chính › Tài khoản nhận tiền phạt**. Admin bấm **Xác nhận đã nhận tiền** kèm mã giao dịch.
  3. **Quá 7 ngày còn nợ** thì Host **không tạo / gửi duyệt chuyến mới** được cho tới khi nộp đủ.
- Host có quyền **xin miễn phạt** (bất khả kháng) trong hạn. Admin **duyệt** (hoàn vào ví số đã trừ và đã nộp, gỡ khoá) hoặc **từ chối** (có lý do).

## Dữ liệu có sẵn

| Host | Khoản phạt | Trạng thái |
|---|---|---|
| **Nguyễn Thị Ban Mai** (`host@ctms.local`) | "Hòa Bắc – Khám phá bản làng Cơ Tu" – lần 1 | **Đã được miễn** (Admin duyệt) |
| | "Tiên Sa – Nghỉ dưỡng và dã ngoại ven biển" – lần 1, 71.250 đ | **Chưa nộp**: chuyến bị hệ thống tự huỷ nên không có doanh thu để trừ; còn hạn nộp 7 ngày và còn hạn xin miễn |
| **Phan Văn Lộc** (`host.blocked@ctms.local`) | "Nam Ô – Đi bộ ven rạn đá" – lần 1 | Xin miễn **bị từ chối**, đã trừ đủ |
| | "Bà Nà – Cắm trại giữa rừng xanh" – lần 2 | **Đang khoá 14 ngày**, đã trừ một phần, xin miễn **chờ Admin duyệt** |
| **Đỗ Thị Hạnh** (`host.suspended@ctms.local`) | "Hồ Hòa Trung – Dã ngoại bên hồ" – lần 1 | Đã trừ đủ |
| | "Sông Cu Đê – Hành trình qua thung lũng" – lần 2 | Đã trừ đủ |
| | "Núi Thần Tài – Nghỉ chân bên suối" – lần 3 | **Đình chỉ**, **quá hạn nộp**, xin miễn **quá hạn chưa xem** |

## Các bước demo (khoảng 6 phút)

**1. Host thấy khoản phạt** (cửa sổ thường)
1. Đăng nhập `host@ctms.local` → menu **Ví**.
2. Thẻ **Phạt thời tiết**: khung **Thông tin chuyển khoản nộp phạt** (Vietcombank · 1028374659 · CONG TY TNHH CTMS VIET NAM, có nút sao chép số tài khoản). Khoản "Tiên Sa" hiện **Doanh thu Host của chuyến 1.425.000 đ**, **Tiền phạt 71.250 đ**, **Còn phải nộp 71.250 đ**, **Hạn nộp** sau 7 ngày và nội dung chuyển khoản.

**1b. Admin cấu hình tài khoản nhận tiền** (cửa sổ ẩn danh)
1. Đăng nhập `admin@ctms.local` → **Tài chính › Tài khoản nhận tiền phạt**: thấy tài khoản đang dùng, ai cập nhật lúc nào.
2. Bấm **Đổi tài khoản** → chọn ngân hàng khác, sửa số tài khoản → **Lưu tài khoản** → **Lưu**.
3. Quay lại cửa sổ Host, tải lại **Ví**: khung chuyển khoản đổi theo ngay.

**2. Admin xác nhận Host đã chuyển khoản** (cửa sổ ẩn danh)
1. Admin → **Quản lý thời tiết** → tab **Phạt Host** → lọc **Chưa nộp đủ**.
2. Mở "Tiên Sa" → phần **Host chuyển khoản nộp phạt** (ghi rõ tài khoản cần đối chiếu sao kê) → nhập mã giao dịch, ví dụ `FT2611230045` → **Xác nhận đã nhận tiền** → **Xác nhận**.
3. Quay lại cửa sổ Host → **Ví**: "Tiên Sa" hiện **Đã nộp 71.250 đ … (mã giao dịch FT2611230045)**, **Còn phải nộp 0 đ**.
4. "Núi Thần Tài" (Đỗ Thị Hạnh) có nhãn **Quá hạn nộp**: đây là trường hợp Host bị chặn tạo chuyến vì nợ quá hạn.

**3. Host xin miễn và Admin duyệt / từ chối**
1. Ở cửa sổ Host, khoản "Tiên Sa" → **Xin miễn phạt** → lý do, ví dụ *"Đêm trước chuyến đi tôi nhập viện cấp cứu nên không thể vào hệ thống quyết định"* → đính kèm file → gửi.
2. Admin → lọc **Chờ duyệt miễn**:
   - "Tiên Sa" → **Duyệt** → 71.250 đ Host đã nộp được **hoàn vào ví Host**, khoản phạt thành **Đã miễn**.
   - "Bà Nà – Cắm trại giữa rừng xanh" (Phan Văn Lộc, lần 2) → **Từ chối** + lý do, hoặc **Duyệt** để gỡ khoá 14 ngày.
   - "Núi Thần Tài" có nhãn **Quá hạn xem**, cho thấy Admin cần xử lý trong 5 ngày làm việc.

**4. Hậu quả khoá / đình chỉ**
1. Đăng xuất, đăng nhập `host.blocked@ctms.local` → **Tạo chuyến** (hoặc gửi duyệt) → bị chặn: *đang bị khoá đến ngày …*.
2. Đăng nhập `host.suspended@ctms.local` → **Tạo chuyến** → bị chặn vì **đình chỉ**. Thẻ phạt trong **Ví** hiện thêm số tiền **quá hạn nộp**.

## ⚠️ Lưu ý thứ tự khi demo
- Khi Admin **can thiệp** một chuyến Đỏ mà Host chưa trả lời ("Hải Vân – Dọc sườn núi ven biển", "Sơn Trà – Ngắm biển từ sườn phía tây"), hệ thống **tạo phạt cho `host@`**.
  - Nếu khoản "Tiên Sa" **chưa được miễn**, đó là **lần 2**, nên `host@` bị **khoá tạo chuyến 14 ngày**.
  - Vì vậy: **demo phần Phạt Host (bước 1–3, duyệt miễn "Tiên Sa") trước**, rồi mới demo Admin can thiệp. Hoặc demo can thiệp ở cuối buổi.
- Muốn làm lại từ đầu: chạy lại `npx pnpm seed`. Lệnh này xoá dữ liệu, nhớ khởi động lại API sau đó.
