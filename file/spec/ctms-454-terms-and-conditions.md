# CTMS-454 — Điều khoản và Điều kiện sử dụng CTMS (Web & Mobile)

- **Jira Story**: [CTMS-454](https://thuha140105.atlassian.net/browse/CTMS-454)
- **Trạng thái**: Đặc tả kỹ thuật & thiết kế triển khai
- **Nhánh đồng bộ nguồn**: `feat/CTMS-454-terms-and-conditions` (tạo từ `origin/develop` tại commit `30d8edd4`)
- **Lưu ý phiên bản và ngày hiệu lực**: Các giá trị `v1.0` và `27/11/2026` trong bản triển khai và ảnh tham chiếu là giá trị khởi tạo minh họa phục vụ phát triển/kiểm thử. Nội dung pháp lý chính thức, số phiên bản phát hành và ngày hiệu lực thực tế cần được chủ sở hữu sản phẩm/pháp chế xác nhận trước khi phát hành chính thức.

---

## 1. User Story

**Là** người dùng CTMS (Khách vãng lai, Camper, Host, Porter, Admin) trên Web và Mobile,  
**Tôi muốn** đọc đầy đủ 12 mục Điều khoản và Điều kiện sử dụng theo từng phiên bản, chủ động xác nhận đồng ý trước khi hoàn tất đăng ký tài khoản, và xem lại/chấp thuận khi điều khoản có cập nhật quan trọng,  
**Để** nắm rõ quyền lợi, trách nhiệm, giới hạn an toàn cũng như cách hệ thống vận hành, đồng thời đảm bảo trạng thái chấp thuận được lưu vết minh bạch và đồng bộ giữa Web và Mobile.

---

## 2. Phạm vi triển khai

1. **Backend (`services/api`)**:
   - Quản lý phiên bản điều khoản (`terms_versions`) làm nguồn nội dung duy nhất cho cả Web và Mobile (12 mục cấu trúc thống nhất).
   - Lưu lịch sử chấp thuận điều khoản theo từng tài khoản và từng phiên bản (`user_terms_acceptances`), không ghi đè lịch sử cũ khi có phiên bản mới.
   - API công khai (không cần đăng nhập) đọc phiên bản hiện hành, danh sách lịch sử phiên bản và nội dung chi tiết từng phiên bản.
   - API có xác thực để kiểm tra trạng thái chấp thuận của tài khoản hiện tại và ghi nhận chấp thuận lại khi có phiên bản mới.
   - Bắt buộc gửi và đối khớp `acceptedTermsVersion` với phiên bản hiện hành trong `POST /api/auth/register`. Giữ tùy chọn chia sẻ Hồ sơ sức khỏe (`healthProfileConsent`) tách biệt và không bắt buộc.
   - Tích hợp khởi tạo phiên bản mặc định `v1.0` qua TypeORM migration và `services/api/src/seeds/main.seed.ts` (không tạo file seed riêng lẻ theo `AGENTS.md`).
2. **Web (`apps/web`)**:
   - Trang công khai `/terms` truy cập được khi chưa đăng nhập và khi đã đăng nhập, dùng layout công khai CTMS (`HeaderNav`, `Footer`), mục lục điều hướng tới đủ 12 mục, hiển thị phiên bản hiện hành, ngày hiệu lực và hộp thoại tra cứu lịch sử phiên bản.
   - Luồng đăng ký (`/register`): ô xác nhận điều khoản mặc định bỏ chọn, mở `/terms?from=register` rồi quay lại vẫn giữ nguyên dữ liệu đã nhập, giữ riêng tùy chọn chia sẻ Hồ sơ sức khỏe (không bắt buộc, cho Camper), chặn hoàn tất khi chưa đồng ý và xử lý trường hợp phiên bản đổi trong lúc đăng ký.
   - Luồng cập nhật điều khoản cho tài khoản đã đăng nhập: hộp thoại thông báo phiên bản mới có 2 lựa chọn **"Để sau"** (giữ nguyên bản ghi chấp thuận cũ) và **"Xem và đồng ý"** (mở đầy đủ nội dung phiên bản mới để người dùng đọc trước khi xác nhận), màn hình xác nhận sau khi lưu thành công (hiển thị phiên bản + ngày chấp thuận) và đồng bộ qua API với Mobile.
3. **Mobile (`apps/mobile`)**:
   - Màn hình đọc Điều khoản (`/terms`) hiển thị phiên bản hiện hành, ngày hiệu lực, tra cứu lịch sử phiên bản và đủ 12 mục dạng mở/thu gọn (accordion).
   - Luồng đăng ký (`RegisterVerificationStep`): giữ nguyên dữ liệu đã nhập khi mở `/terms` rồi quay lại (qua navigation stack), 3 ô kiểm riêng biệt (xác nhận thông tin chính xác, đồng ý Điều khoản bắt buộc, chia sẻ Hồ sơ sức khỏe không bắt buộc), mặc định bỏ chọn.
   - Luồng cập nhật điều khoản trên shell đã đăng nhập (`CamperShellScreen`, `PorterShellScreen`) và điểm vào xem điều khoản tại Hồ sơ Camper & Cài đặt Porter.

---

## 3. Điểm vào và đồng bộ giao diện với CTMS hiện có

### 3.1. Đối chiếu màn hình tham chiếu & thành phần tái sử dụng

| Nền tảng | Màn hình tham chiếu CTMS | Thành phần tái sử dụng (đường dẫn thực tế) | Điểm vào cho CTMS-454 |
| --- | --- | --- | --- |
| **Web (Public)** | `LandingPage` (`apps/web/src/features/landing/pages/LandingPage.tsx`) | `HeaderNav` (`apps/web/src/features/landing/components/HeaderNav.tsx`), `Footer` (`apps/web/src/features/landing/components/Footer.tsx`), `Button`, `Card`, `StatusBadge`, `Modal`, `PageSkeleton`, `useToast` (`apps/web/src/shared/components/`) | Đường dẫn công khai `/terms`, liên kết `"Điều khoản"` trong `Footer`, liên kết trên `RegisterPage` |
| **Web (Auth)** | `RegisterPage` (`apps/web/src/features/auth/pages/RegisterPage.tsx`) | `useRegisterForm` (`apps/web/src/features/auth/hooks/useRegisterForm.ts`), `CamperRegisterForm`, `HostRegisterForm`, `PorterRegisterForm`, `AuthBrandPanel` | Bước 2 biểu mẫu đăng ký (khối đồng ý điều khoản + tùy chọn chia sẻ hồ sơ sức khỏe riêng biệt) |
| **Web (Authenticated)** | `AppRoutes` (`apps/web/src/routes/AppRoutes.tsx`) | `Modal`, `Button`, `StatusBadge`, `useToast` (`apps/web/src/shared/components/`) | `TermsReconsentGate` gắn cùng cấp với `EmergencyBroadcastAlerts` trong `AppRoutes.tsx` |
| **Mobile (Read)** | `CamperProfileScreen`, `PorterSettingsScreen` | `CtmsScaffold`, `CtmsSectionCard`, `CtmsButton`, `CtmsStatusBadge`, `CtmsLoadingState`, `CtmsEmptyState`, `CtmsAlertBanner`, `AppColors`, `AppSpacing`, `AppRadius`, `AppTypography` (`apps/mobile/lib/core/`) | Route `/terms` trong `app_router.dart` (truy cập được cả khi chưa đăng nhập và đã đăng nhập); mục `"Điều khoản và Điều kiện sử dụng"` trong `CamperProfileScreen` và `PorterSettingsScreen` |
| **Mobile (Auth)** | `RegisterScreen` (`apps/mobile/lib/features/auth/presentation/register_screen.dart`) | `RegisterVerificationStep`, `RegisterController`, `CtmsButton`, `AppColors` | Bước 2 (`Xác nhận`) của wizard đăng ký, chạm liên kết `"Điều khoản và Điều kiện sử dụng"` để `context.push('/terms')` và quay lại giữ nguyên dữ liệu |
| **Mobile (Authenticated)** | `CamperShellScreen`, `PorterShellScreen` | `Dialog` / `ModalBottomSheet` sử dụng `AppColors`, `CtmsButton`, `CtmsStatusBadge`, `ScaffoldMessenger` | `TermsReconsentListener` gắn trong `CamperShellScreen` & `PorterShellScreen` |

### 3.2. Nguyên tắc đồng bộ thiết kế (CTMS Design System vs ảnh tham chiếu)

- Sử dụng hệ màu thương hiệu CTMS (`#164027`, `#22613b`, `#f4f7f2`, `#dfe8df`, `#10221b`, `#667a6d`) và hệ chữ, khoảng cách thang 4px hiện hành thay cho các chi tiết khác biệt trong ảnh minh họa.
- Ngôn ngữ giao diện 100% tiếng Việt tự nhiên, **không** chèn thuật ngữ tiếng Anh trong ngoặc đơn (ví dụ dùng **"Trợ lý sinh tồn AI"** thay vì `"AI Survival Assistant"`, **"Điều khoản và Điều kiện sử dụng CTMS"** thay vì tiêu đề tiếng Anh `"Terms & Conditions"`).
- Không lồng Card trong Card, không gắn icon trang trí thừa bên cạnh nhãn thống kê, thông báo kết quả thao tác trên Web dùng `shared/components/Toast` (`useToast`).

---

## 4. Luồng nghiệp vụ chi tiết

### 4.1. Luồng đọc điều khoản công khai & tra cứu lịch sử phiên bản
1. Người dùng mở `/terms` (Web, không cần đăng nhập) hoặc màn hình Điều khoản (Mobile).
2. Ứng dụng gọi `GET /api/terms/current` để tải phiên bản hiện hành cùng đầy đủ 12 mục.
3. Hiển thị số phiên bản hiện hành (nhãn `v1.0 (hiện tại)`), ngày hiệu lực (`27/11/2026`), và nút **"Lịch sử phiên bản"**.
4. Trên Web: mục lục cố định bên trái liệt kê đủ 12 mục, bấm từng mục cuộn mượt tới đúng mục tương ứng và làm nổi bật mục đang đọc; trên màn hình nhỏ có thanh chọn/mục lục gọn.
5. Trên Mobile: đủ 12 mục hiển thị dạng mở/thu gọn (accordion), mặc định mở mục 1 để người dùng đọc ngay, có thể mở/thu gọn từng mục độc lập.
6. Khi bấm **"Lịch sử phiên bản"**, ứng dụng gọi `GET /api/terms/versions` để hiển thị danh sách tất cả phiên bản (gắn trạng thái `hiện tại` / `cũ`) và cho phép chọn xem toàn văn bất kỳ phiên bản nào qua `GET /api/terms/versions/:version`. Khi đang xem bản cũ, hiển thị rõ cảnh báo đang xem phiên bản lịch sử và nút quay về phiên bản hiện hành.

### 4.2. Luồng đăng ký tài khoản (Web & Mobile)
1. Khi vào bước đăng ký, ứng dụng tải phiên bản điều khoản hiện hành từ `GET /api/terms/current`.
2. Khối xác nhận hiển thị:
   - Ô chọn bắt buộc: **"Tôi đã đọc và đồng ý với Điều khoản và Điều kiện sử dụng của CTMS."** kèm liên kết mở trang Điều khoản và nhãn phiên bản đang hiển thị (ví dụ `Phiên bản v1.0`). Mặc định **bỏ chọn**.
   - Trên Mobile giữ thêm ô xác nhận thông tin đăng ký chính xác (mặc định bỏ chọn) theo bố cục wizard hiện tại.
   - Tùy chọn riêng cho Camper (không bắt buộc, mặc định bỏ chọn): **"Tôi đồng ý chia sẻ Hồ sơ sức khỏe để nhận hỗ trợ an toàn tốt hơn (không bắt buộc)."**
3. Người dùng mở liên kết điều khoản từ màn hình đăng ký:
   - **Web**: lưu tạm bản nháp form đăng ký vào bộ nhớ trong phiên SPA (không ghi mật khẩu vào `localStorage`/`sessionStorage`) rồi điều hướng tới `/terms?from=register`. Nút **"Quay lại đăng ký"** đưa về `/register` ở đúng bước 2 với toàn bộ dữ liệu đã nhập (họ tên, email, số điện thoại, mật khẩu, vai trò, thông tin theo vai trò và trạng thái các ô chọn) được giữ nguyên.
   - **Mobile**: dùng `context.push('/terms')` giữ nguyên `RegisterScreen` trong navigation stack nên khi bấm quay lại toàn bộ `TextEditingController` và trạng thái `RegisterController` được bảo toàn 100%.
4. Người dùng không thể hoàn tất đăng ký nếu chưa chọn ô đồng ý Điều khoản hoặc chưa tải được phiên bản hiện hành (nút/validation chặn phía giao diện).
5. Khi gửi `POST /api/auth/register`, client truyền `acceptedTermsVersion` (phiên bản đang hiển thị), `termsPlatform` (`"web"` | `"mobile"`) và `healthProfileConsent` (tùy chọn boolean, mặc định `false`).
6. Backend xác thực trong cùng transaction:
   - Nếu thiếu `acceptedTermsVersion` → `422 Unprocessable Entity`.
   - Nếu `acceptedTermsVersion` không khớp phiên bản đang hiệu lực → `409 Conflict` kèm mã `TERMS_VERSION_OUTDATED` và `currentVersion` mới nhất. Giao diện tự động tải lại phiên bản mới, bỏ chọn ô đồng ý và thông báo tiếng Việt để người dùng xem lại trước khi đăng ký tiếp.
   - Nếu hợp lệ → tạo `User`, lưu bản ghi `UserTermsAcceptance` (`source: "registration"`), tạo `HealthProfile` với `isConsentGranted: true` nếu Camper chủ động chọn chia sẻ sức khỏe, và ghi `AuditLog`.

### 4.3. Luồng cập nhật điều khoản & chấp thuận lại (Re-consent)
1. Khi người dùng đã đăng nhập (tài khoản cũ chưa có bản ghi chấp thuận hoặc đã đồng ý phiên bản cũ hơn phiên bản đang hiệu lực có `requiresReconsent = true`), ứng dụng gọi `GET /api/terms/my-status`.
2. Nếu `needsReconsent === true` và người dùng chưa chọn **"Để sau"** trong phiên hiện tại, hiển thị hộp thoại **"Cập nhật Điều khoản sử dụng"** thông báo phiên bản mới (`vX.Y (mới)`) với 2 nút:
   - **"Để sau"**: đóng hộp thoại trong phiên hiện tại, **không** ghi nhận chấp thuận, giữ nguyên lịch sử chấp thuận cũ.
   - **"Xem và đồng ý"**: chuyển sang bước đọc toàn văn 12 mục của phiên bản mới ngay trong hộp thoại (hoặc chế độ xem đầy đủ) với nút xác nhận **"Tôi đồng ý với phiên bản mới"**.
3. Khi người dùng xác nhận, ứng dụng gọi `POST /api/terms/accept` với `{ version, platform }`.
   - Nếu gửi lặp lại cho cùng `(userId, termsVersionId)`: backend xử lý idempotent (trả về bản ghi đã có với `alreadyAccepted: true`, không tạo bản trùng, không lỗi).
   - Nếu phiên bản vừa thay đổi trong lúc người dùng đang đọc: backend trả `409 Conflict` (`TERMS_VERSION_OUTDATED` + `currentVersion`), giao diện tải lại phiên bản mới nhất để người dùng đọc và xác nhận lại.
4. Khi lưu thành công:
   - Hiển thị trạng thái xác nhận **"Đã đồng ý điều khoản"** nêu rõ số phiên bản và ngày chấp thuận (ví dụ: *"Bạn đã chấp thuận Điều khoản và Điều kiện sử dụng CTMS (phiên bản v1.0) vào 27/11/2026."*) kèm nút **"Tiếp tục sử dụng"** (và toast thành công trên Web).
   - Cập nhật cache trạng thái chấp thuận. Vì trạng thái lưu theo tài khoản trên máy chủ, đăng nhập bằng cùng tài khoản trên nền tảng còn lại (Web ↔ Mobile) sẽ thấy `needsReconsent = false` và không bị hỏi lại cho cùng phiên bản.

---

## 5. Quy tắc phiên bản & Mô hình dữ liệu / API

### 5.1. Quy tắc phiên bản
- Mỗi phiên bản điều khoản có mã `version` duy nhất (ví dụ `"1.0"`, `"1.1"`), ngày hiệu lực `effectiveDate`, trạng thái `isActive` và cờ `requiresReconsent`.
- Ràng buộc partial unique index trên PostgreSQL (`WHERE is_active = true`) đảm bảo tại mọi thời điểm chỉ có tối đa **01** phiên bản đang hiệu lực.
- Lịch sử phiên bản không bị xóa khi phát hành phiên bản mới; mọi bản ghi `user_terms_acceptances` gắn khóa ngoại `terms_version_id` tới đúng phiên bản người dùng đã đồng ý.

### 5.2. Lược đồ cơ sở dữ liệu
1. Bảng `terms_versions`:
   - `id` (`uuid`, PK)
   - `version` (`varchar(32)`, UNIQUE, NOT NULL)
   - `title` (`varchar(200)`, NOT NULL)
   - `summary` (`text`, NULL)
   - `effective_date` (`date`, NOT NULL)
   - `sections` (`jsonb`, NOT NULL) — mảng 12 mục `{ number, slug, title, subsections: [{ code, title, body }], callout?: string }`
   - `is_active` (`boolean`, NOT NULL, default `false`)
   - `requires_reconsent` (`boolean`, NOT NULL, default `true`)
   - `published_at` (`timestamptz`, NOT NULL)
   - `created_at`, `updated_at` (`timestamptz`)
2. Bảng `user_terms_acceptances`:
   - `id` (`uuid`, PK)
   - `user_id` (`uuid`, FK → `users.id` ON DELETE CASCADE)
   - `terms_version_id` (`uuid`, FK → `terms_versions.id` ON DELETE RESTRICT)
   - `version` (`varchar(32)`, NOT NULL)
   - `accepted_at` (`timestamptz`, NOT NULL)
   - `source` (`varchar(32)`, NOT NULL — `'registration' | 'reconsent'`)
   - `platform` (`varchar(16)`, NOT NULL — `'web' | 'mobile' | 'api'`)
   - `UNIQUE (user_id, terms_version_id)`

### 5.3. Hợp đồng API (`/api/terms` & `/api/auth/register`)

| Method & Path | Xác thực | Mô tả | Trả về / Mã lỗi chính |
| --- | --- | --- | --- |
| `GET /api/terms/current` | Công khai | Lấy phiên bản điều khoản đang hiệu lực cùng 12 mục | `200` `TermsVersionDto`; `404` nếu chưa có phiên bản hiệu lực |
| `GET /api/terms/versions` | Công khai | Danh sách các phiên bản (mới nhất trước) | `200` `TermsVersionSummaryDto[]` |
| `GET /api/terms/versions/:version` | Công khai | Xem chi tiết toàn văn một phiên bản theo mã phiên bản | `200` `TermsVersionDto`; `404` nếu không tồn tại |
| `GET /api/terms/my-status` | Bearer JWT | Trạng thái chấp thuận của tài khoản hiện tại + lịch sử chấp thuận | `200` `{ currentVersion, currentEffectiveDate, requiresReconsent, acceptedCurrentVersion, needsReconsent, latestAcceptance, acceptanceHistory }` |
| `POST /api/terms/accept` | Bearer JWT | Xác nhận chấp thuận phiên bản đang hiệu lực | Body `{ version, platform? }` → `200` `{ accepted, version, effectiveDate, acceptedAt, alreadyAccepted }`; `409` (`TERMS_VERSION_OUTDATED`) nếu phiên bản đã đổi |
| `POST /api/auth/register` | Công khai | Đăng ký tài khoản mới | Bổ sung `acceptedTermsVersion` (bắt buộc), `healthProfileConsent` (tùy chọn), `termsPlatform` (tùy chọn). Trả `422` nếu thiếu điều khoản, `409` (`TERMS_VERSION_OUTDATED`) nếu phiên bản cũ |

---

## 6. Bảng truy vết 12 mục điều khoản

| Mục | Nguồn trong repo | Hành vi CTMS hiện có | Mâu thuẫn tài liệu/code & cách xử lý | Điểm cần xác nhận trước khi phát hành |
| --- | --- | --- | --- | --- |
| **1. Quy định chung** | `README.md`, `apps/web/src/routes/routes.config.ts`, `apps/mobile/lib/core/router/app_router.dart` | CTMS là nền tảng quản lý điểm cắm trại và chuyến đi trekking trên Web và Mobile, kết nối Camper, Host, Porter và Admin. | Không có mâu thuẫn. | Tên pháp nhân vận hành chính thức, địa chỉ trụ sở và kênh liên hệ hỗ trợ chính thức. |
| **2. Tài khoản và vai trò** | `services/api/src/modules/auth/auth.service.ts`, `dto/register.dto.ts`, `users/entities/user.entity.ts`, `file/spec/ctms-01-register-with-email-or-phone-number.md` | Đăng ký yêu cầu cả email và số điện thoại Việt Nam hợp lệ, xác thực OTP (`PENDING_VERIFICATION → ACTIVE`), hỗ trợ đăng nhập Google; hỗ trợ 4 vai trò (`camper`, `host`, `porter`, `admin`), tài khoản đa vai trò (`user_roles`). | `ctms-01` bản cũ mô tả chọn email *hoặc* SĐT, nhưng code thực tế yêu cầu **cả email và SĐT** (ghi chú business flow update trong `register.dto.ts`). Nội dung điều khoản bám theo code hiện hành. | Độ tuổi tối thiểu được phép đăng ký và sử dụng dịch vụ. |
| **3. Đặt chỗ và thanh toán** | `services/api/src/modules/bookings/bookings.service.ts`, `platform-commission.ts`, `settlements.service.ts`, `payments` | Hỗ trợ chuyến đi miễn phí và có phí. Chuyến có phí giữ chỗ tạm thời chờ thanh toán; lưu ảnh chụp lịch trình, giá cơ bản và chính sách hủy tại thời điểm đặt chỗ. Doanh thu Host được quyết toán sau chu kỳ giữ tiền (`HOLD_PERIOD_HOURS = 72` giờ sau khi hoàn thành chuyến đi) theo tỷ lệ phí nền tảng cấu hình hiện tại (mặc định 5% trong `platform-commission.ts`). | Không có mâu thuẫn. Không cam kết cố định mức phí nền tảng vĩnh viễn trong điều khoản; nêu rõ áp dụng theo chính sách/tỷ lệ hiển thị tại thời điểm giao dịch. | Xác nhận phương thức thanh toán chính thức trên production, quy định xuất hóa đơn và biểu phí dịch vụ chính thức. |
| **4. Hủy chuyến** | `services/api/src/modules/bookings/cancellation-policy.ts`, `refunds.service.ts`, `settlements.service.ts`, `AGENTS.md` | Phân tách rõ **2 luồng độc lập**: (1) **Hủy đặt chỗ trước chuyến đi**: áp dụng theo ảnh chụp chính sách hủy của chuyến đi (chính sách mặc định của hệ thống hiện có các mốc thời gian trước giờ khởi hành: từ 72 giờ trở lên, từ 48 đến dưới 72 giờ, dưới 48 giờ; không hỗ trợ tự hủy khi chuyến đã bắt đầu); (2) **Yêu cầu hoàn tiền sau chuyến đi**: khiếu nại thông thường trong vòng 24 giờ sau kết thúc chuyến đi (`COMPLAINT_WINDOW_HOURS = 24`); nếu gửi muộn sau khi chuyến đã quyết toán chỉ được tiếp nhận để quản trị viên xem xét ngoại lệ. Mọi khoản hoàn tiền đi qua **bước xét duyệt** (chấp thuận/từ chối) tách biệt với **bước xác nhận chuyển tiền thực tế** — việc duyệt yêu cầu không đồng nghĩa tiền đã chuyển ngay. | Code và `AGENTS.md` nhất quán tuyệt đối. Nội dung điều khoản phản ánh đúng ranh giới 2 luồng và tách biệt bước xét duyệt với bước chuyển tiền; tránh trộn thành một nút chung hay dùng thuật ngữ quyết toán nội bộ của Host trong giải thích dành cho Camper. | Xác nhận thời hạn xử lý chuyển khoản hoàn tiền cam kết (số ngày làm việc) và chính sách hủy do thời tiết cực đoan từ phía Host/Admin. |
| **5. Hoạt động trekking** | `services/api/src/modules/trips/`, `trip-incidents/`, `profiles/entities/health-profile.entity.ts` | Hoạt động trekking tiềm ẩn rủi ro địa hình, thời tiết và thể lực. Camper tự chuẩn bị sức khỏe, trang bị phù hợp, tuân thủ hướng dẫn của Host/Porter và quy định tại điểm đến; có thể khai báo Hồ sơ sức khỏe và liên hệ khẩn cấp để hỗ trợ an toàn. | Không có mâu thuẫn. | Yêu cầu miễn trừ trách nhiệm pháp lý cụ thể (waiver), bảo hiểm du lịch bắt buộc hay khuyến nghị. |
| **6. Host và Porter** | `services/api/src/modules/profiles/utils/guide-card-check.ts`, `docs/features/ctms-138-porter-level-review.md`, `trips/`, `porter-assignments/` | Host chịu trách nhiệm tạo, công bố, cập nhật thông tin chuyến đi, tuyến đường, điều phối Porter và vận hành thực tế. Porter phải cung cấp thông tin/chứng chỉ phù hợp (thẻ hướng dẫn viên nội địa/quốc tế theo quy định xác minh, không chấp nhận thẻ tại điểm cho hồ sơ dẫn tuyến) và được quản trị viên xét duyệt cấp độ thủ công. | Không có mâu thuẫn. Điều khoản nêu đúng vai trò vận hành thực tế của Host và quy trình xét duyệt hồ sơ/cấp độ Porter của CTMS, không thay thế nghĩa vụ pháp lý/giấy phép kinh doanh lữ hành bên ngoài. | Quy định chi tiết về giấy phép kinh doanh lữ hành của Host và danh mục chứng chỉ Porter được công nhận chính thức. |
| **7. Bản đồ và dữ liệu thời tiết** | `services/api/src/modules/weather/`, `routes/`, `offline-packages/`, `sync/` | CTMS cung cấp tuyến đường, điểm dừng (checkpoint), vùng cảnh báo nguy hiểm, gói bản đồ ngoại tuyến và đánh giá rủi ro thời tiết (mức Xanh/Vàng/Đỏ) dựa trên nguồn dữ liệu khí tượng tích hợp và cập nhật vận hành. Chuyến đi có rủi ro thời tiết mức Đỏ hoặc thiếu dữ liệu hợp lệ có thể bị tạm khóa đặt chỗ. | Không có mâu thuẫn. Nêu rõ dữ liệu bản đồ/thời tiết mang tính tham khảo hỗ trợ quyết định, có thể có độ trễ hoặc sai lệch so với điều kiện thực địa. | Nguồn dữ liệu khí tượng/bản đồ chính thức công bố cho người dùng và điều khoản miễn trừ sai số GPS/bản đồ. |
| **8. Trợ lý sinh tồn AI** | `docs/features/CTMS-075-Implementation.md`, `services/api/src/modules/rag/`, `apps/mobile/lib/features/rag/` | Trợ lý sinh tồn AI tra cứu tài liệu hướng dẫn sinh tồn và đưa ra gợi ý tham khảo dựa trên ngữ cảnh chuyến đi, hỗ trợ phát hiện câu hỏi khẩn cấp. Hệ thống không phải bác sĩ hay đơn vị y tế/cứu hộ và không thay thế đánh giá chuyên môn trực tiếp. | Không có mâu thuẫn. Nhấn mạnh rõ tính chất tham khảo và yêu cầu ưu tiên an toàn thực tế / hỗ trợ y tế chuyên môn. | Tuyên bố giới hạn trách nhiệm pháp lý chính thức đối với nội dung do AI tạo ra. |
| **9. SOS và tình huống khẩn cấp** | `services/api/src/modules/sos/`, `emergency-broadcasts/`, `apps/mobile/lib/features/sos/` | Tính năng SOS cho phép gửi tín hiệu cảnh báo khẩn cấp kèm tọa độ gần nhất (có bước xác nhận, hủy, tiếp nhận và đóng cảnh báo) tới người phụ trách chuyến đi và kênh vận hành; hoạt động phụ thuộc vào tín hiệu mạng/GPS, pin thiết bị và điều kiện địa hình. | Không có mâu thuẫn. **Không** cam kết thời gian phản hồi hay bảo đảm cứu hộ thành công; nhắc người dùng chủ động liên hệ cơ quan cứu hộ/y tế địa phương khi có thể. | Quy trình phối hợp chính thức với lực lượng cứu hộ địa phương (nếu có) và số hotline khẩn cấp vận hành 24/7 (nếu có). |
| **10. Dữ liệu người dùng** | `services/api/src/modules/profiles/entities/health-profile.entity.ts`, `auth/entities/audit-log.entity.ts`, `sync/`, `device-tokens/` | Hệ thống thu thập thông tin tài khoản (email, SĐT, họ tên), hồ sơ vai trò, thông tin đặt chỗ/thanh toán, nhật ký vị trí/đồng bộ ngoại tuyến khi tham gia chuyến đi và nhật ký kiểm toán thao tác quan trọng. Hồ sơ sức khỏe được kiểm soát bằng quyền đồng ý chia sẻ riêng (`isConsentGranted`, mặc định `false`, có thể bật hoặc thu hồi bất cứ lúc nào). | Không có mâu thuẫn. **Không** tự đặt thời hạn lưu trữ dữ liệu cụ thể vì chưa có chính sách lưu trữ chính thức trong code. | Thời hạn lưu trữ từng loại dữ liệu, quy trình yêu cầu xóa/xuất dữ liệu cá nhân theo Nghị định 13/2023/NĐ-CP và liên kết Chính sách Bảo mật riêng. |
| **11. Vi phạm và xử lý tài khoản** | `services/api/src/modules/users/users.service.ts` (`lockUser`, `unlockUser`), `content-reports/`, `weather-penalties/` | Người dùng không được giả mạo hồ sơ/chứng chỉ, gây mất an toàn, gian lận đặt chỗ/khiếu nại hoặc đăng tải nội dung vi phạm. Quản trị viên có quyền tiếp nhận báo cáo vi phạm, tạm khóa tài khoản (`ACTIVE → SUSPENDED`, tự động thu hồi phiên đăng nhập và ghi nhật ký kiểm toán) hoặc mở khóa sau khi xem xét. | Không có mâu thuẫn. | Danh mục mức độ vi phạm chi tiết, thời hạn khóa và quy trình khiếu nại mở khóa tài khoản. |
| **12. Thay đổi điều khoản** | Module `terms` (CTMS-454): `terms_versions`, `user_terms_acceptances` | CTMS có thể cập nhật Điều khoản theo từng phiên bản mới với ngày hiệu lực cụ thể và lưu giữ lịch sử phiên bản để người dùng tra cứu. Khi có thay đổi quan trọng yêu cầu chấp thuận lại, hệ thống sẽ thông báo trên Web và Mobile để người dùng đọc và xác nhận trước khi ghi nhận chấp thuận phiên bản mới; người dùng có thể chọn "Để sau" nếu chưa sẵn sàng xác nhận ngay. | Không có mâu thuẫn. | Thời gian báo trước tối thiểu trước khi phiên bản mới có hiệu lực và phạm vi tính năng bị hạn chế (nếu có) khi người dùng chọn "Để sau" quá thời hạn. |

---

## 7. Nội dung đầy đủ 12 mục điều khoản (Phiên bản khởi tạo `v1.0`)

> **Ghi chú biên tập**: Nội dung dưới đây phản ánh đúng hành vi hiện tại của CTMS, được lưu thống nhất tại `services/api/src/modules/terms/terms-content.ts` làm nguồn dùng chung cho Web, Mobile, Migration và Main Seed. Không tự đặt thêm mức phí cố định, tỷ lệ hoàn tiền ngoài cấu hình mặc định của chuyến đi, thời hạn lưu dữ liệu, cam kết cứu hộ hay nghĩa vụ pháp lý chưa được xác nhận.

### 1. Quy định chung
- **1.1. Phạm vi áp dụng**: Điều khoản và Điều kiện sử dụng này áp dụng cho tất cả cá nhân, tổ chức khi truy cập, đăng ký tài khoản hoặc sử dụng website, ứng dụng di động và các dịch vụ thuộc hệ thống quản lý điểm cắm trại và chuyến đi trekking CTMS.
- **1.2. Chấp thuận điều khoản**: Khi tạo tài khoản hoặc xác nhận đồng ý phiên bản điều khoản đang hiệu lực trên CTMS, bạn xác nhận đã đọc, hiểu và đồng ý tuân thủ toàn bộ nội dung của Điều khoản này.
- *Lưu ý nổi bật*: Điều khoản này có thể được cập nhật theo từng phiên bản. Khi có thay đổi quan trọng, CTMS sẽ thông báo và có thể yêu cầu bạn xem lại và chấp thuận phiên bản mới.

### 2. Tài khoản và vai trò
- **2.1. Đăng ký và xác thực tài khoản**: Để tạo tài khoản trên CTMS, bạn cần cung cấp thông tin chính xác bao gồm địa chỉ email và số điện thoại hợp lệ, sau đó hoàn tất bước xác thực mã OTP (hoặc đăng nhập bằng phương thức được hệ thống hỗ trợ). Bạn chịu trách nhiệm bảo mật mật khẩu và mọi hoạt động phát sinh từ tài khoản của mình.
- **2.2. Các vai trò trên hệ thống**: CTMS hỗ trợ các vai trò gồm Camper (người tham gia chuyến đi), Host (đơn vị/cá nhân tổ chức chuyến đi), Porter (người dẫn đường và hỗ trợ đoàn) và Quản trị viên hệ thống. Mỗi vai trò chỉ được sử dụng các chức năng phù hợp với quyền hạn được cấp và trạng thái xác minh tương ứng.

### 3. Đặt chỗ và thanh toán
- **3.1. Đặt chỗ chuyến đi**: Khi đặt chỗ cho một chuyến đi đang mở trên CTMS, hệ thống ghi nhận số lượng khách, thông tin thành viên và lưu lại bản sao lịch trình, mức giá cơ bản cùng chính sách hủy áp dụng tại thời điểm đặt chỗ. Các thay đổi sau đó đối với mô tả chuyến đi không tự động làm thay đổi thông tin đã ghi nhận của đơn đặt chỗ hợp lệ.
- **3.2. Thanh toán và phí dịch vụ**: Đối với chuyến đi miễn phí, đơn đặt chỗ có thể được xác nhận ngay theo trạng thái hệ thống. Đối với chuyến đi có phí, đơn đặt chỗ có thời hạn giữ chỗ chờ thanh toán; nếu quá hạn chưa thanh toán, hệ thống có thể hủy giữ chỗ. Các khoản phí dịch vụ nền tảng và quy trình quyết toán với Host được áp dụng theo chính sách và tỷ lệ hiển thị trên hệ thống tại thời điểm giao dịch.

### 4. Hủy chuyến
- **4.1. Hủy đặt chỗ trước chuyến đi**: Khi chuyến đi chưa bắt đầu, người tham gia có thể gửi yêu cầu hủy đặt chỗ trực tiếp trên đơn đặt chỗ. Mức hoàn tiền (nếu có) được tính căn cứ theo chính sách hủy đã gắn với chuyến đi tại thời điểm đặt chỗ (ví dụ các mốc thời gian trước giờ khởi hành hiển thị trên chi tiết chuyến đi và đơn đặt chỗ). Sau khi chuyến đi đã bắt đầu, thao tác tự hủy đặt chỗ trước chuyến đi không còn khả dụng.
- **4.2. Yêu cầu hoàn tiền sau chuyến đi**: Sau khi chuyến đi kết thúc, nếu phát sinh sự cố hoặc khiếu nại liên quan đến dịch vụ, người tham gia có thể gửi yêu cầu hoàn tiền sau chuyến đi kèm lý do và bằng chứng. Khiếu nại thông thường cần được gửi trong vòng 24 giờ sau khi chuyến đi hoàn tất.
- **4.3. Xét duyệt và xác nhận chuyển tiền**: Mọi yêu cầu hoàn tiền đều trải qua bước tiếp nhận và xét duyệt (chấp thuận hoặc từ chối) tách biệt với bước chuyển tiền. Thông báo đã chấp thuận yêu cầu chỉ xác nhận kết quả xét duyệt, không đồng nghĩa tiền đã được chuyển ngay vào tài khoản ngân hàng của bạn; việc chuyển tiền được theo dõi và xác nhận ở bước xử lý riêng trên hệ thống.

### 5. Hoạt động trekking
- **5.1. Rủi ro đặc thù ngoài trời**: Hoạt động cắm trại và trekking diễn ra ở khu vực địa hình tự nhiên, có thể tiềm ẩn rủi ro về thời tiết, địa hình, động thực vật và sức khỏe cá nhân. Khi tham gia chuyến đi, bạn cần tự đánh giá thể lực phù hợp với mức độ tuyến đường và chuẩn bị trang bị cần thiết.
- **5.2. Trách nhiệm an toàn khi tham gia**: Người tham gia có trách nhiệm tuân thủ lịch trình, hướng dẫn an toàn của Host và Porter, không tự ý tách đoàn và tuân thủ quy định bảo vệ môi trường, phòng cháy chữa cháy tại khu vực cắm trại/trekking.

### 6. Host và Porter
- **6.1. Trách nhiệm của Host**: Host chịu trách nhiệm về tính chính xác của thông tin chuyến đi, tuyến đường, điểm dừng, mức giá, chính sách hủy và việc tổ chức vận hành chuyến đi an toàn, đúng nội dung đã công bố cũng như tuân thủ các quy định pháp luật liên quan tại địa phương.
- **6.2. Xác minh và vai trò của Porter**: Porter hỗ trợ dẫn đường, điểm danh, theo dõi an toàn và ghi nhận sự cố trên hành trình theo phân công. Hồ sơ năng lực, chứng chỉ và cấp độ của Porter trên CTMS phải trải qua bước kiểm tra và xét duyệt của quản trị viên; Porter chịu trách nhiệm hoàn toàn về tính trung thực của mọi giấy tờ đã nộp.

### 7. Bản đồ và dữ liệu thời tiết
- **7.1. Dữ liệu tuyến đường và bản đồ ngoại tuyến**: Bản đồ tuyến đường, điểm dừng, vùng cảnh báo nguy hiểm và gói dữ liệu ngoại tuyến trên CTMS được cung cấp nhằm hỗ trợ định hướng và chuẩn bị hành trình. Dữ liệu định vị GPS và bản đồ có thể chịu ảnh hưởng bởi địa hình, thiết bị hoặc thay đổi thực địa chưa kịp cập nhật.
- **7.2. Cảnh báo rủi ro thời tiết**: Thông tin dự báo và đánh giá mức độ rủi ro thời tiết trên CTMS dựa trên nguồn dữ liệu khí tượng tích hợp và cập nhật vận hành để hỗ trợ ra quyết định. Trong trường hợp rủi ro thời tiết ở mức nguy hiểm hoặc thiếu dữ liệu đánh giá hợp lệ, hệ thống có thể tạm khóa đặt chỗ hoặc phát thông báo điều chỉnh/hủy chuyến vì lý do an toàn.

### 8. Trợ lý sinh tồn AI
- **8.1. Tính chất tham khảo**: Trợ lý sinh tồn AI trên CTMS cung cấp gợi ý và tra cứu kiến thức sinh tồn dựa trên tài liệu được nạp trong hệ thống và ngữ cảnh chuyến đi. Nội dung phản hồi chỉ mang tính tham khảo hỗ trợ chuẩn bị và xử lý tình huống cơ bản.
- **8.2. Giới hạn chuyên môn**: Trợ lý sinh tồn AI không phải bác sĩ, nhân viên y tế hay đơn vị cứu hộ chuyên nghiệp và không thay thế chẩn đoán y khoa, chỉ dẫn của người dẫn đường có kinh nghiệm hoặc cơ quan chức năng trong tình huống nguy hiểm.

### 9. SOS và tình huống khẩn cấp
- **9.1. Cơ chế gửi cảnh báo SOS**: Tính năng SOS cho phép người dùng phát tín hiệu cảnh báo khẩn cấp kèm vị trí gần nhất ghi nhận từ thiết bị tới người phụ trách chuyến đi và bộ phận theo dõi vận hành trên CTMS. Người dùng chỉ sử dụng SOS cho tình huống khẩn cấp thực sự và thực hiện xác nhận đúng hướng dẫn trên màn hình.
- **9.2. Giới hạn kết nối và không bảo đảm cứu hộ**: Việc truyền tín hiệu SOS phụ thuộc vào vùng phủ sóng di động, kết nối internet, độ chính xác GPS, pin thiết bị và điều kiện hiện trường. CTMS là công cụ hỗ trợ cảnh báo và điều phối thông tin, không thay thế dịch vụ cứu hộ/cấp cứu công lập và không cam kết thời gian hay kết quả cứu hộ thực tế. Khi có nguy hiểm đe dọa tính mạng, hãy ưu tiên liên hệ trực tiếp cơ quan cứu hộ, công an hoặc y tế địa phương ngay khi có thể.

### 10. Dữ liệu người dùng
- **10.1. Phạm vi dữ liệu xử lý**: CTMS xử lý các dữ liệu cần thiết để cung cấp dịch vụ gồm thông tin tài khoản, hồ sơ vai trò, lịch sử đặt chỗ và giao dịch, dữ liệu vị trí/đồng bộ ngoại tuyến trong thời gian tham gia chuyến đi, phản hồi đánh giá và nhật ký kiểm toán các thao tác quan trọng.
- **10.2. Hồ sơ sức khỏe và quyền chia sẻ riêng**: Hồ sơ sức khỏe là thông tin nhạy cảm, hoàn toàn tự nguyện và tách biệt với việc chấp thuận Điều khoản này. Khi xác nhận đặt chỗ cho một chuyến đi cụ thể, người tham gia có thể chủ động lựa chọn chia sẻ Hồ sơ sức khỏe để đơn vị tổ chức và người dẫn đường nắm thông tin hỗ trợ an toàn phù hợp. Bạn không bắt buộc phải chia sẻ và có thể bật hoặc thu hồi quyền chia sẻ bất kỳ lúc nào trong phần Hồ sơ cá nhân.

### 11. Vi phạm và xử lý tài khoản
- **11.1. Hành vi không được phép**: Người dùng không được cung cấp thông tin hoặc chứng chỉ giả mạo, thực hiện gian lận đặt chỗ/thanh toán/khiếu nại, gây rối hoặc đe dọa an toàn của người khác, phát cảnh báo SOS giả, hoặc can thiệp trái phép vào hệ thống.
- **11.2. Biện pháp xử lý**: Khi phát hiện dấu hiệu vi phạm hoặc nhận báo cáo hợp lệ, quản trị viên CTMS có thể xem xét, cảnh báo, gỡ bỏ nội dung vi phạm hoặc tạm khóa tài khoản (đồng thời chấm dứt các phiên đăng nhập hiện hành và ghi nhận nhật ký kiểm toán). Tài khoản chỉ được mở lại sau khi hoàn tất quá trình xem xét theo quy định vận hành.

### 12. Thay đổi điều khoản
- **12.1. Cập nhật phiên bản điều khoản**: CTMS có thể điều chỉnh, bổ sung Điều khoản này khi có thay đổi về tính năng, quy trình vận hành hoặc yêu cầu pháp lý. Mỗi bản cập nhật được gắn số phiên bản, ngày hiệu lực rõ ràng và lưu giữ trong Lịch sử phiên bản để người dùng tra cứu bất cứ lúc nào.
- **12.2. Thông báo và chấp thuận lại**: Với các thay đổi quan trọng yêu cầu xác nhận lại, hệ thống sẽ hiển thị thông báo trên Web và ứng dụng di động để bạn đọc nội dung phiên bản mới trước khi xác nhận đồng ý. Bạn có thể chọn "Để sau" nếu cần thêm thời gian xem xét (bản ghi chấp thuận trước đó vẫn được giữ nguyên), và sau khi đồng ý trên một nền tảng, trạng thái chấp thuận sẽ tự động đồng bộ sang nền tảng còn lại cho cùng tài khoản.

---

## 8. Trạng thái giao diện & Xử lý ngoại lệ

- **Trạng thái tải (Loading)**: Dùng `PageSkeleton` (Web) / `CtmsLoadingState` (Mobile) khi tải điều khoản hoặc lịch sử phiên bản.
- **Trạng thái lỗi tải (Load Error)**: Hiển thị thông báo tiếng Việt thân thiện kèm nút **"Thử lại"** (không hiển thị lỗi tiếng Anh thô từ API).
- **Trạng thái gửi lặp (Double Submit)**: Khóa nút xác nhận khi đang gửi (`isPending`/`isSubmitting`), đồng thời backend xử lý idempotent với unique constraint `(user_id, terms_version_id)`.
- **Thay đổi phiên bản khi đang đọc / đang đăng ký**: Backend trả `409 Conflict` kèm `code: "TERMS_VERSION_OUTDATED"` và `currentVersion`. Client tự động làm mới điều khoản hiện hành, đặt lại trạng thái xác nhận và hiển thị thông báo tiếng Việt yêu cầu xem lại phiên bản mới.
- **Tài khoản đã tồn tại (trước CTMS-454)**: Không có bản ghi `user_terms_acceptances` → `GET /api/terms/my-status` trả `needsReconsent: true` → hộp thoại cập nhật hiển thị **"Để sau"** và **"Xem và đồng ý"** mà không khóa cứng màn hình đăng nhập.

---

## 9. Tiêu chí nghiệm thu (Acceptance Criteria)

1. Web có trang công khai `/terms` đọc được khi chưa đăng nhập và khi đã đăng nhập, có mục lục điều hướng tới đủ 12 mục, hiển thị phiên bản hiện hành, ngày hiệu lực và tra cứu được lịch sử phiên bản.
2. Mobile có màn hình đọc Điều khoản hiển thị cùng phiên bản, ngày hiệu lực, lịch sử phiên bản và đủ 12 mục mở/thu gọn được.
3. Cả Web và Mobile dùng cùng nguồn nội dung theo phiên bản từ `services/api`.
4. Đăng ký trên Web và Mobile: ô đồng ý Điều khoản mặc định bỏ chọn; mở điều khoản rồi quay lại vẫn giữ nguyên toàn bộ dữ liệu đã nhập; không thể hoàn tất đăng ký khi chưa đồng ý (chặn cả FE và BE); tùy chọn chia sẻ Hồ sơ sức khỏe giữ riêng và không bắt buộc.
5. Cập nhật điều khoản: hiển thị **"Để sau"** (giữ nguyên bản ghi chấp thuận cũ) và **"Xem và đồng ý"** (mở phiên bản mới để đọc trước khi xác nhận); sau khi lưu hiển thị phiên bản và ngày chấp thuận; đồng bộ giữa Web và Mobile cho cùng tài khoản.
6. Khi có phiên bản mới, lịch sử chấp thuận các phiên bản cũ vẫn được giữ nguyên; lỗi tải/lưu, gửi lặp và đổi phiên bản trong lúc đọc/đăng ký được xử lý bằng tiếng Việt chuẩn.

---

## 10. Các nội dung chính sách cần xác nhận trước khi phát hành chính thức

1. **Thông tin pháp nhân & liên hệ**: Tên doanh nghiệp vận hành CTMS, mã số doanh nghiệp, địa chỉ liên hệ và email/hotline hỗ trợ chính thức.
2. **Phiên bản & ngày hiệu lực chính thức**: Số phiên bản phát hành đầu tiên và ngày bắt đầu có hiệu lực thực tế (hiện dùng `v1.0` và `27/11/2026` làm giá trị khởi tạo).
3. **Độ tuổi tối thiểu**: Yêu cầu độ tuổi tối thiểu để đăng ký tài khoản hoặc tham gia chuyến đi trekking.
4. **Biểu phí & thời hạn chuyển tiền hoàn**: Tỷ lệ phí dịch vụ nền tảng chính thức trên production, quy định xuất hóa đơn và thời hạn chuyển khoản hoàn tiền cam kết sau khi duyệt.
5. **Chính sách bảo mật & lưu trữ dữ liệu**: Thời hạn lưu trữ từng nhóm dữ liệu cá nhân, quy trình xóa/xuất dữ liệu theo Nghị định 13/2023/NĐ-CP và liên kết Chính sách Bảo mật riêng.
6. **Phạm vi hạn chế khi chọn "Để sau"**: Thời gian ân hạn (nếu có) trước khi yêu cầu bắt buộc chấp thuận phiên bản điều khoản mới để tiếp tục đặt chỗ hoặc tạo chuyến đi.
7. **Khung xử lý vi phạm & khiếu nại**: Danh mục vi phạm cụ thể, thời hạn khóa tài khoản và quy trình gửi khiếu nại mở khóa.
8. **Rà soát pháp lý**: Phê duyệt cuối cùng từ bộ phận pháp chế đối với tuyên bố giới hạn trách nhiệm hoạt động trekking ngoài trời, bản đồ/thời tiết, Trợ lý sinh tồn AI và SOS.
