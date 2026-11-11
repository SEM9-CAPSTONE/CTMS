---
name: sequence-diagram-generator
description: >
  Generates and reviews UML Sequence Diagrams following the BA Standard v2.0 conventions.
  Enforces strict lifeline layering (Actor -> Boundary -> Controller -> Service -> Model -> Database -> External API),
  exact messaging rules (Verb + Object), activation bars, default visual styling (no color distinguishing layers),
  clean labels without stereotypes (<>) on rectangle boxes, undeformed actor with label below, and Draw.io format export.
  Use when designing system workflows, generating sequence diagrams, or reviewing BA technical specifications.
---

# Sequence Diagram Convention (BA Standard v2.0 - Revised)

## 1. Mục đích của Sequence Diagram

Sequence Diagram dùng để mô tả:
- Actor tương tác với hệ thống
- Thứ tự xử lý nghiệp vụ theo thời gian
- Tương tác chuẩn hóa giữa các tầng kiến trúc
- Điều kiện rẽ nhánh và luồng ngoại lệ
- Luồng dữ liệu hai chiều (Request & Response)

**Tuyệt đối không dùng để mô tả:**
- Database Schema / Bảng dữ liệu chi tiết
- Class Design / Chi tiết OOP
- Source Code / Thuật toán chi tiết nội bộ hàm

### 1.1 Nguyên tắc Bám sát Thực tế Mã nguồn (Source Code As Truth Rule)
- Sequence Diagram **bắt buộc phải vẽ đúng 100% theo logic code đang thực hiện trong source code thực tế** (đúng luồng Controller $\rightarrow$ Service $\rightarrow$ Model $\rightarrow$ DB, đúng các bước kiểm tra điều kiện, lock dòng dữ liệu, transaction rollback/commit).
- **Quy tắc đồng bộ logic (Logic Synchronization Rule):** Bất cứ khi nào logic trong source code thay đổi, Sequence Diagram tương ứng của User Story đó **bắt buộc phải được tạo lại / cập nhật lại ngay lập tức** để đảm bảo tài liệu thiết kế và mã nguồn luôn đồng bộ tuyệt đối.

---

## 2. Tiêu đề sơ đồ (Title Naming Rule)

- Tiêu đề của Sequence Diagram **chỉ ghi tên của User Story (US)**.
- **KHÔNG ghi mã tiền tố ticket/dự án** (như `CTMS-45:`, `CTMS-01:`, v.v.).
- Ví dụ:
  - ✅ Đúng: `Cancel Booking by Policy & Process Refund`
  - ✅ Đúng: `Register with Email or Phone Number`
  - ✅ Đúng: `Pay for Booking`
  - ❌ Sai: `CTMS-45: Cancel Booking by Policy & CTMS-46: Process Refund`
  - ❌ Sai: `CTMS-01: Register with Email or Phone Number`

---

## 3. Thành phần và Ký hiệu Lifeline

### 3.1 Actor
- **Ký hiệu:** Hình người UML (`shape=umlActor`).
- **Quy tắc vẽ:**
  - Luôn nằm **ngoài cùng bên trái**.
  - **Tỉ lệ không bị méo:** Đặt kích thước chuẩn `width=30, height=60`.
  - **Chữ nằm dưới hình người:** Sử dụng `verticalLabelPosition=bottom;verticalAlign=top;`.
  - Không sử dụng stereotype.
  - Tên là **Business Role** cụ thể: `Camper`, `Host`, `Porter`, `Admin`...

### 3.2 Khối chữ nhật Lifeline (Boundary, Control, Entity)
- **QUY TẮC BỎ `<>` / STEREOTYPE:**
  - **KHÔNG ghi `<>` hay `<<boundary>>`, `<<control>>`, `<<entity>>` vào các cục chữ nhật.**
  - Chỉ ghi tên thuần túy của component / layer.
  - Vị trí từ trái sang phải tự xác định bản chất của tầng:
    - **Boundary:** `Cancel Booking Modal`, `Booking Detail Screen`, `Login Page`
    - **Controller:** `Booking Controller`, `AuthController`
    - **Service:** `Booking Service`, `Payment Service`
    - **Model:** `Booking Model`, `Trip Model`, `User Model`
    - **Database:** `PostgreSQL Database`, `MongoDB Database`
    - **External API:** `Payment Gateway API`, `Lark API` (đặt bên phải cùng)

---

## 4. Thứ tự Lifeline (Bắt buộc)

Thứ tự xuất hiện từ trái qua phải luôn là:
```text
Actor  ──>  Boundary  ──>  Controller  ──>  Service  ──>  Model  ──>  Database  [──>  External API]
```

**Quy tắc phân tầng nghiêm ngặt (Strict Layering):**
- ❌ **Không được:** Actor gọi trực tiếp Service (`Actor ──> Service`).
- ❌ **Không được:** Actor gọi trực tiếp Model (`Actor ──> Model`).
- ❌ **Không được:** Boundary gọi trực tiếp Model (`Boundary ──> Model`).
- ❌ **Không được:** Service gọi trực tiếp Database (`Service ──> Database`).
- ❌ **Không được:** Controller gọi trực tiếp Database (`Controller ──> Database`).
- ✅ **Luôn đi tuần tự:**
  - **Request:** `Actor ──> Boundary ──> Controller ──> Service ──> Model ──> Database`
  - **Response:** `Database ──> Model ──> Service ──> Controller ──> Boundary ──> Actor`

---

## 5. Quy tắc đặt tên Message (Verb + Object)

Mọi message bắt buộc tuân theo quy tắc: **`Verb + Object`**
- ✅ Đúng: `Submit Cancel Booking`, `Send Cancel Request`, `Validate Input Data`, `Find Booking`, `Query Booking Table`, `Return Booking Document`, `Display Success Message`.
- ❌ Sai: `Cancel`, `Validation`, `Success`, `Error`, `Booking Data`.

### Chi tiết tên Request:
- **Service ──> Model:**
  - Read: `Query Booking`, `Find Booking`, `Find Trip`
  - Create: `Create Booking`, `Create Refund Record`
  - Update: `Update Booking`, `Update Refund Status`
  - Delete: `Delete Booking`
- **Model ──> Database:**
  - Read: `Query Booking Table`, `Find Booking Document`
  - Create: `Insert Booking Document`, `Insert Refund Document`
  - Update: `Update Booking Table`, `Update Refund Table`
  - Delete: `Delete Booking Document`

### Chi tiết tên Response:
- **Database ──> Model:** `Return Booking Document`, `Return Query Result`
- **Model ──> Service:** `Return Booking`, `Return Update Success`
- **Service ──> Controller:** `Return Cancellation Data`, `Return Response Data`
- **Controller ──> Boundary:** `Return Success Response`, `Return Error Response`
- **Boundary ──> Actor:** `Display Success Message`, `Show Error Message`

---

## 6. Đánh số thứ tự (Numbering Convention)

- **Main Flow:** Đánh số tự nhiên tuần tự `1.`, `2.`, `3.`, `4.`, `5.`...
- **Alternative / Exception Flow:**
  - Nhánh rẽ 1: `10.1`, `11.1`, `12.1`...
  - Nhánh rẽ 2: `10.2`, `11.2`, `12.2`...

---

## 7. Fragments & Conditions

- **`alt` (Rẽ nhánh điều kiện):**
  - Luôn ghi điều kiện rõ ràng trong ngoặc vuông `[Condition]`.
  - **ĐƯỜNG PHÂN CÁCH NÉT ĐỨT BẮT BUỘC:** Khi khung `alt` có từ 2 luồng trở lên (ví dụ: luồng thành công và luồng thất bại/lỗi), **bắt buộc phải có đường kẻ ngang nét đứt (`shape=line;dashed=1;`)** cắt ngang toàn bộ khung để phân chia ranh giới rõ ràng giữa các luồng.
  - Mỗi nhánh phân cách phải có tiêu đề điều kiện rõ ràng: `[Eligible For Refund]` (thành công) và `[Ineligible Or Over Refund Limit]` (thất bại).
- **`opt` (Tùy chọn):** `[Refund Obligation Exists]`.
- **`loop` (Lặp):** `[For Each Booking Member]`.
- **`par` (Song song):** Xử lý đồng thời.

---

## 8. Quy chuẩn Visual Style & Draw.io Export

1. **Không sử dụng màu để phân biệt layer.** Tất cả participant dùng màu mặc định (`fillColor=#ffffff;strokeColor=#000000;fontColor=#000000`).
2. **Quy tắc mũi tên thẳng tuyệt đối (Straight Arrow Rule):**
   - Mọi mũi tên truyền thông điệp ngang (Request và Response) giữa các Lifeline (đặc biệt là bước 1 từ Actor sang Boundary) **bắt buộc phải là đường thẳng ngang 100%, tuyệt đối không bị gập góc hay cong (`edgeStyle=none;rounded=0;`)**.
   - Tọa độ Y của điểm bắt đầu (Source) và điểm kết thúc (Target) phải bằng nhau chính xác (`y_source == y_target`).
   - Chỉ duy nhất các bước tự xử lý nội bộ (Self-loop) mới có hình gập chữ U.
3. **Không highlight đen che chữ:**
   - Tất cả text/label trên mũi tên, self-loop và frame bắt buộc thiết lập:
     `fillColor=none;labelBackgroundColor=#ffffff;strokeColor=#000000;fontColor=#000000;`
   - Đảm bảo nền nhãn chữ là màu trắng trong suốt, chữ đen rõ ràng, không bị hộp đen che chữ.
4. **Actor không méo:**
   - Khối hình người: `width=30, height=60`, `shape=umlActor`.
   - Nhãn tên Actor: `verticalLabelPosition=bottom;verticalAlign=top;`.
   - Đường lifeline đứt đoạn nối ngay dưới chân Actor.
5. **Activation Bar:** Bắt buộc có trên mọi lifeline trong khoảng thời gian xử lý request.
6. **Quy tắc đặt tên và lưu file (File Naming Rule):**
   - Mỗi file chứa đúng **1 Sequence Diagram tương ứng với 1 US duy nhất**.
   - Thư mục lưu trữ: `docs/sequence-diagrams/`.
   - **Định dạng đặt tên bắt buộc:**
     ```text
     CTMS-<StoryID>-<Story-Title>.drawio
     ```
   - **Ví dụ chuẩn:**
     - `CTMS-35-Process-Refund.drawio`
     - `CTMS-01-Register-Account.drawio`
     - `CTMS-43-Pay-For-Booking.drawio`
     - `CTMS-45-Cancel-Booking-By-Policy.drawio`
   - Chỉ lưu duy nhất file `.drawio` (không tạo file `.xml` thừa đi kèm).
   - File `.drawio` phải được nén Deflate + Base64 chuẩn để mở trực tiếp trên `app.diagrams.net` và extension VS Code không bị lỗi `atob`.
