# Quy định thời tiết theo ngày đi và quyết định giữ / dời / huỷ Trip

> Trạng thái: **đề xuất để leader chốt.** Các con số (mốc giờ, mức phạt) cấu hình được, không viết cứng trong code.
> Liên quan: CTMS-025/026/028 (rủi ro tuyến), CTMS-100 (dự báo theo lịch Trip), CTMS-112 (quyết toán doanh thu).

## 1. Nguyên tắc

1. Trip được đánh giá theo **dự báo cho đúng ngày đi**, không theo thời tiết hôm nay. Ví dụ: Trip ngày 17/11 dùng dự báo của 17/11.
2. Dự báo cho cùng một ngày sẽ thay đổi theo thời gian. **Bản mới nhất là bản có giá trị.**
3. Hệ thống không tự huỷ Trip chỉ vì một dự báo ở xa. Quyết định cuối thuộc về **Host**. **Admin** chỉ duyệt Trip lúc mở bán (kèm dự báo Host gửi lên); sau đó Host chịu trách nhiệm vận hành. Admin **chỉ can thiệp khi còn ≤ 3 ngày** tới giờ đi (mục 5.3).
4. Mọi quyết định đều phải ghi lại: ai quyết định, lúc nào, dựa trên bản dự báo nào, với lý do gì.

## 2. Độ tin cậy theo khoảng cách tới ngày đi

| Còn lại tới giờ đi | Độ tin cậy | Ý nghĩa với người dùng |
| --- | --- | --- |
| Trên 15 ngày | Chưa có dự báo | Hiện "Chưa có dự báo ngày đi (còn xa)" |
| 8–15 ngày | Thấp | Chỉ để tham khảo |
| 4–7 ngày | Trung bình | Cảnh báo sớm |
| ≤ 3 ngày | Cao | Căn cứ để ra quyết định |

## 3. Đặt chỗ mới

| Tình huống | Kết quả |
| --- | --- |
| Còn ≤ 3 ngày, dự báo **Đỏ** | **Chặn** đặt chỗ mới |
| Còn > 3 ngày, dự báo Đỏ | Cho đặt, hiện cảnh báo: "Dự báo xấu, có thể thay đổi; Host sẽ quyết định trước ngày đi" |
| Còn > 15 ngày | Cho đặt. Không dùng thời tiết hôm nay để thay thế |
| Không lấy được dự báo (dịch vụ lỗi) | Áp dụng quy tắc cũ theo rủi ro tuyến |

## 4. Theo dõi sau khi đặt

- Một job cập nhật dự báo cho các Trip đang mở bán hoặc đang diễn ra có ngày đi trong 15 ngày tới:
  - còn trên 3 ngày: chạy **1 lần mỗi ngày**;
  - còn ≤ 3 ngày: chạy **mỗi 6 giờ**.
- **Chỉ ghi lịch sử khi kết quả thay đổi** (mức rủi ro hoặc số liệu giờ xấu nhất). Nếu kết quả không đổi thì chỉ cập nhật thời điểm kiểm tra.
- Chỉ lưu dữ liệu thô từ nhà cung cấp cho bản Host gửi lúc xin duyệt.
- **Lưu trữ:** Trip kết thúc quá 30 ngày thì xoá bớt lịch sử, chỉ giữ bản lúc gửi duyệt, bản ở mốc chốt và bản dùng để ra quyết định.

### Ai xem được và ai nhận thông báo

| Vai trò | Xem lịch sử | Nhận thông báo |
| --- | --- | --- |
| Camper | Trip mình đã đặt hoặc đang xem | Khi **mức rủi ro đổi** (Xanh/Vàng/Đỏ), với Trip đã đặt (booking đã xác nhận hoặc đang chờ thanh toán) |
| Host | Trip của mình | Khi mức rủi ro đổi, và khi tới các mốc ở mục 5 |
| Admin | Tất cả Trip | **Chỉ khi cần can thiệp** (mục 5.3) |

Khi số liệu thay đổi nhưng mức rủi ro giữ nguyên, hệ thống chỉ ghi lịch sử, không gửi thông báo.

## 5. Quy trình quyết định gần giờ đi

Các mốc dưới đây tính theo giờ khởi hành (T).

### 5.1 Mốc T-48h: nhắc Host
Nếu dự báo đang **Đỏ**, hệ thống gửi Host (web, email, thông báo trong app): "Trip X đang có dự báo Đỏ. Vui lòng quyết định Giữ / Dời / Huỷ trước T-24h."

### 5.2 Mốc T-24h: hạn chót của Host
Host phải chọn một trong ba quyết định, **bắt buộc kèm lý do**:

| Quyết định của Host | Hệ quả |
| --- | --- |
| **Huỷ vì thời tiết** | Camper được hoàn **100%**. Host không bị phạt. Nền tảng không thu phí của Trip này |
| **Dời lịch** | Camper chọn nhận ngày mới hoặc hoàn **100%** |
| **Giữ** khi đang Đỏ | Bắt buộc ghi lý do và phương án an toàn. Hệ thống báo Admin (mục 5.3) |

Nếu dự báo không còn Đỏ ở mốc T-24h thì Host không cần quyết định.

### 5.3 Admin can thiệp
Admin **chỉ can thiệp khi còn ≤ 3 ngày** tới giờ đi. Ngoài khoảng này, mọi quyết định thuộc về Host.

Admin xem được nhật ký quyết định của từng Trip: bản dự báo lúc đó, Host đã chọn gì, lý do và phương án an toàn.

Ngoài Giữ / Dời / Huỷ, Admin có quyền **tạm dừng** Trip nếu thấy nguy hiểm:
- Trip đang tạm dừng thì **chặn đặt chỗ mới** và **không tự chuyển sang "đang diễn ra"** khi tới giờ đi.
- Admin bắt buộc ghi lý do. Sau đó Admin **mở lại**, **dời** hoặc **huỷ** Trip.
- Admin được mở lại Trip kể cả khi dự báo không còn Đỏ.

Hệ thống cảnh báo Admin khi dự báo vẫn **Đỏ** và rơi vào một trong hai trường hợp:
- **Host không phản hồi.** Admin được quyền **tự quyết Giữ / Dời / Huỷ** thay Host, bắt buộc ghi lý do. Hệ thống ghi lại đây là quyết định của Admin, và Host bị phạt theo mục 6.
- **Host chọn Giữ.** Hệ thống báo Admin ngay khi Host chọn. Admin xem lý do và có thể **giữ nguyên**, **tạm dừng** hoặc **huỷ thay Host** nếu thấy nguy hiểm.

Khi Admin đã quyết định cho lịch hiện tại của Trip, Host không quyết định thêm nữa. Host quyết định sau mốc T-24h vẫn được nhận nhưng được ghi là **trễ hạn** (căn cứ cho mục 6).

### 5.4 Admin quyết định, hệ thống tự huỷ ở T-6h nếu vẫn chưa ai quyết định
Nếu sau T-24h dự báo vẫn Đỏ mà chưa có quyết định, hệ thống **nhắc Admin lặp lại với mức khẩn tăng dần**:

| Mốc | Thông báo cho Admin |
| --- | --- |
| T-24h | Cảnh báo: "Trip X dự báo Đỏ, Host chưa phản hồi. Cần Admin quyết định." |
| T-12h | Nhắc lại, đánh dấu **khẩn** |
| T-6h | Nhắc lại, **khẩn cấp**, hiện ở đầu dashboard Admin cho đến khi được xử lý |

**Tự huỷ ở T-6h** (leader chốt ngày 12/11/2026, thay cho quy định cũ "hệ thống không bao giờ tự huỷ"):
- Hệ thống tự huỷ Trip khi **đủ cả bốn điều kiện**: Trip đang mở bán; còn ≤ 6 giờ tới giờ đi; dự báo mới nhất **Đỏ theo ngưỡng** (ý kiến AI không tính); chưa ai chốt **Giữ / Dời / Huỷ / Mở lại** cho lịch hiện tại. Trip chỉ đang **Tạm dừng** vẫn bị huỷ.
- Camper được **hoàn 100%** như huỷ vì thời tiết (mục 5.2). Khoản hoàn được tạo ở trạng thái chờ trong hàng đợi hoàn tiền của Admin, hệ thống không tự chuyển tiền.
- Host bị phạt theo mục 6 nếu chưa phản hồi trước T-24h. Lịch đã bị phạt khi Admin can thiệp (ví dụ tạm dừng) thì không bị phạt thêm.
- Nhật ký ghi người quyết định là **"Hệ thống"**. Host và mọi Admin nhận thông báo "Trip đã bị hệ thống tự huỷ".
- Thẻ quyết định của Host và danh sách "Cần xử lý" của Admin báo trước giờ tự huỷ.
- Tắt được bằng biến môi trường `TRIP_WEATHER_AUTO_CANCEL_ENABLED=false`.

- Thông báo gửi qua web (realtime), email và hiện trong danh sách "Cần xử lý" của Admin.
- Khi Admin hoặc Host đã quyết định thì hệ thống ngừng nhắc và không tự huỷ.
- Mọi quyết định của Admin đều phải ghi lý do và được lưu lại. Host bị phạt theo mục 6, vì Admin đã phải can thiệp.

```
Dự báo Đỏ ──T-48h──► Nhắc Host ──T-24h──► Host quyết định?
                                            ├─ Huỷ/Dời ──► Hoàn tiền / dời lịch (không phạt)
                                            ├─ Giữ ──────► Báo Admin ──► Admin giữ nguyên / huỷ
                                            └─ Không phản hồi ──► Báo Admin (T-24h, T-12h, T-6h…)
                                                                   ├─ Admin quyết định Giữ / Dời / Huỷ + phạt Host
                                                                   └─ Vẫn chưa ai quyết định ở T-6h ──► Hệ thống tự huỷ + hoàn 100% + phạt Host
```

## 6. Phạt Host không phản hồi

- **Áp dụng khi:** tới T-24h dự báo Đỏ, Host không có quyết định và Admin phải can thiệp.
- **Không áp dụng khi:** Host đã chọn Huỷ, Dời hoặc Giữ có lý do đúng hạn.
- **Giá trị booking của Trip** = tổng tiền các booking đã thanh toán. Khoản phạt được **trừ vào doanh thu quyết toán** (CTMS-112). Nếu doanh thu không đủ thì ghi thành công nợ của Host.
- **Đếm số lần vi phạm** trong **90 ngày gần nhất**.

| Lần vi phạm | Mức phạt (đề xuất) | Biện pháp kèm theo |
| --- | --- | --- |
| Lần 1 | Cảnh cáo + **5%** giá trị booking của Trip, tối đa **2.000.000đ** | Trừ điểm uy tín Host |
| Lần 2 | **10%**, tối đa **5.000.000đ** | Tạm khoá tạo Trip mới **14 ngày** |
| Lần 3 trở đi | **15%**, tối đa **10.000.000đ** | Đình chỉ Host. Admin xem xét khoá tài khoản |

### Miễn phạt vì bất khả kháng (Host ốm, tai nạn…)
- Trong **72 giờ** sau mốc T-24h, Host gửi yêu cầu miễn phạt kèm bằng chứng (giấy của cơ sở y tế, biên bản…).
- Admin xem xét trong **5 ngày làm việc**:
  - Nếu chấp nhận: hoàn lại khoản phạt và không tính lần vi phạm.
  - Nếu từ chối: giữ nguyên, ghi rõ lý do.
- **Quyền lợi của Camper không phụ thuộc** vào việc Host có được miễn phạt hay không (vẫn hoàn 100% nếu Trip bị huỷ).

## 7. Ghi nhận và kiểm tra

- **Mỗi quyết định ghi vào `audit_logs`:** người quyết định (Host, Admin hoặc hệ thống), vai trò, thời điểm, bản dự báo đã dùng (ID và mức rủi ro), lý do.
- **Mỗi khoản phạt lưu thành bản ghi riêng:** Trip, Host, lần vi phạm thứ mấy, số tiền, trạng thái (áp dụng / miễn), ai duyệt miễn.
- Thông báo gửi đi phải chống trùng: mỗi lần đổi mức chỉ gửi một lần cho mỗi người nhận.

## 8. Cần leader chốt

1. Ngưỡng "gần ngày đi" là **3 ngày**.
2. Các mốc **T-48h** (nhắc Host), **T-24h** (hạn của Host), **T-12h / T-6h** (nhắc Admin).
3. Mức phạt **5% / 10% / 15%**, các mức trần, và chu kỳ đếm **90 ngày**.
4. Thời hạn miễn phạt **72 giờ** gửi yêu cầu, **5 ngày làm việc** để Admin xem xét.
5. Tách thành các task Jira:
   - (a) chặn đặt chỗ theo ngưỡng 3 ngày;
   - (b) job theo dõi và thông báo;
   - (c) quy trình quyết định và Admin can thiệp;
   - (d) phạt và miễn phạt.
