# Database seeds

`main.seed.ts` contains the application seed data, including financial adjustments,
legacy financial host consolidation, revenue analytics and safety hotspots. The full
seed keeps their existing execution order: accounts and trips before financial
records; performance reports before revenue analytics; safety hotspots after completed
trips and participants exist. Fixed record IDs and existing financial workflows are
preserved by the consolidation.

Run commands from the repository root:

| Command | Behavior |
| --- | --- |
| `pnpm seed` / `pnpm seed:all` / `pnpm seed:fresh` | Rebuild the development dataset; these existing commands pass `--fresh` and clear the database. |
| `pnpm --filter @ctms/api exec ts-node src/seeds/main.seed.ts` | Run the full seed without the explicit database wipe. Individual scenarios may refresh their own data. |
| `pnpm --filter @ctms/api seed:financial-adjustments` | Financial adjustments using the existing admin, host and camper accounts. |
| `pnpm --filter @ctms/api seed:revenue-analytics` | Revenue history and trip area snapshots. |
| `pnpm --filter @ctms/api seed:safety-hotspots` | Safety hotspots using existing trips and participants. |
| `pnpm --filter @ctms/api seed:danger-zone-reports` | Porter danger-zone reports (pending with photos, approved, rejected) on Trips assigned to `porter@ctms.local`; never resets data. |
| `pnpm --filter @ctms/api seed:performance-reports` | Booking and trip performance reports. |
| `pnpm --filter @ctms/api seed:bank-accounts` | Host and camper bank accounts. |
| `pnpm --filter @ctms/api seed:group-bookings` | Group bookings and equipment. |
| `pnpm --filter @ctms/api seed:health-profile` | Fill missing health and activity facts for the existing camper@ctms.local account through the master seed, retaining entered notes and activity values. |
| `pnpm --filter @ctms/api seed:da-nang` | Repair recognized seed names, descriptions and route coordinates around Đà Nẵng. Preserves existing IDs, relations, statuses, bookings, photos and money. |

All CLI seed commands use the master entry point, reject production and close the
database connection on success or failure. Partial commands require their prerequisite
accounts and trips to exist.

The safety hotspot section in `main.seed.ts` uses the existing Sơn Trà trips and
participants to run the real detector. New hotspots enter `UNDER_REVIEW`, where an
Admin can confirm or dismiss them directly. Open `/admin/safety-hotspots` and select
**Đang xem xét**. Confirmed fixtures use `HotspotReviewService`, including decision
history and audit entries. Existing `DETECTED` records remain actionable as legacy data.
Re-running the seed preserves existing Admin decisions, comments and corrective actions.

Use `seed:da-nang` to update an existing development database without rebuilding its
dataset. Legacy place names remain only as exact lookup metadata in the master
seed. The repair replaces known seed text while preserving appended notes, keeps
route and trip IDs in place, and never creates accounts or runs migrations.

`test/helpers/db-helper.ts` and `test/helpers/content-reports-e2e.ts` are E2E tools,
not application seeds. Test runners call them explicitly; the master seed never
runs their account creation or cleanup actions. Web E2E tests and the mobile OTP
verification script reference their new locations.

## Porter bắt đầu và kết thúc chuyến đi

Chạy `pnpm --filter @ctms/api seed:porter-lifecycle` sau migration. Lệnh này chỉ bổ sung
dữ liệu qua `main.seed.ts`, không xóa hay khởi tạo lại database. Dùng các tài khoản
`host@ctms.local`, `camper@ctms.local` và `porter@ctms.local` đã có.

Mở mobile bằng `porter@ctms.local` / `Porter@123`, vào tab **Chuyến đi** và chọn chuyến. Nút bắt đầu/kết thúc cùng bản đồ, vị trí thành viên và trạng thái lệch tuyến nằm trong trang này:

- **Đi bộ ven rừng Sơn Trà**: chờ khởi hành, đã đến giờ, đủ khách xác nhận; kiểm tra bắt đầu rồi kết thúc.
- **Ngắm biển từ đỉnh Bàn Cờ**: đang diễn ra, đã qua giờ kết thúc dự kiến; kiểm tra vẫn chờ Porter kết thúc.
- **Đón bình minh trên bán đảo Sơn Trà**: ngày hôm sau; nút bắt đầu bị khóa và giải thích chưa đến giờ.

Đây là chuyến đi cộng đồng không thu phí, không phát sinh giao dịch tiền. Seed không tạo tài khoản mới.
Mỗi ngày bổ sung một bộ chuyến; chạy lại trong ngày giữ nguyên trạng thái, giờ thực tế,
phân công, ghi chú và dữ liệu tài chính. Chuyến đã kết thúc không được đặt lại để chạy thử lần nữa.
Xác nhận bắt đầu/kết thúc cần mạng; đồng bộ điểm kiểm tra ngoại tuyến giữ luồng hiện có.

## Camper xem vị trí đoàn

Chạy `pnpm --filter @ctms/api seed:member-locations` để bổ sung vị trí mới nhất cho
`camper@ctms.local` và `porter@ctms.local` trong chuyến **Ngắm biển từ đỉnh Bàn Cờ**
của bộ dữ liệu vận hành hôm nay. Chuyến phải đang diễn ra và khách đã vào đoàn;
seed không đặt lại trạng thái nếu người dùng đã kết thúc chuyến.

Mở mobile bằng `camper@ctms.local`, vào chi tiết chuyến → **Lộ trình & GPS** →
**Vị trí các thành viên**. Khách đang ở ngoài tuyến khoảng 100 m; người dẫn đoàn
ở trên tuyến và chưa có sự kiện trạng thái tuyến. Chọn người để đưa vị trí đó vào giữa sơ đồ.
Vị trí chuyển thành cũ theo thời gian; chạy lại lệnh trên để thêm lượt đồng bộ mới.
Lịch sử đã có, tài khoản, thông tin chuyến và toàn bộ số tiền được giữ nguyên.
