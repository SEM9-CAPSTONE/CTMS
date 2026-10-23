# Mentor review follow-up — 2026-10-22

## Source and Git discipline

- Read repository rules, Git guide, project guide, architecture/design documents, current cancellation implementation contract, and active Booking/Refund/Equipment/Route/Porter/Notification specs under `file/spec`.
- Older planning CSVs contain different story numbering; they did not override active specs. The generic E-Hub skills describe a different Prisma/i18next application. CTMS's existing TypeORM, typed API, shared UI and Vietnamese-content conventions were retained without installing a second framework.
- Base: updated `origin/develop` / `develop`, commit `4d165c2a`. Branch: `fix/CTMS-174-mentor-booking-review`; project branch validator passes.
- The original draft was stashed before switching/pulling. The new branch was created directly from updated develop and only that working diff was applied. No old feature branch was merged or cherry-picked. `origin/develop...HEAD` is 0/0 before any commit.
- The stash remains as a backup. No commit, push, PR, or deployment was performed. No dependency manifest, lockfile, mobile code or unrelated feature implementation was changed.

## Implemented behavior

| Mentor feedback | Result |
| --- | --- |
| Homepage wording | Smart camping/trekking management tagline; removed unsupported international-standard wording on login. |
| Hold duration | Configured default 120 minutes for new paid Bookings. Existing deadlines are preserved. |
| Cancellation policy | >=72h: 100%; >=48h and <72h: 30%; <48h: 0%, strictly before departure. Booking snapshots remain authoritative. |
| Cancellation reason | Required nonblank reason, trimmed, max 255, validated in UI and API. Data is preserved on conflicts. |
| Cancellation with rental equipment | Under the mentor amendment and cut CTMS-041 scope, application allocations may be released before both live and snapshotted departure, while the live Trip remains published. Booking/seats/rentals/refund/audit/inbox commit atomically. Physical handover/return remains outside the application. |
| Refund cap | Cancellation entitlement is fixed at cancellation time across refund entry points. A second request cannot claim the retained 70%. Host/System cancellation retains its separate origin. |
| Host/Admin notices | Persisted recipient inbox, required reason, valid Trip reference, unread/read state, unique (Booking, recipient), own-recipient access, idempotent first read timestamp. UI is included on dashboards and role layouts and polls every 30 seconds. No global WebSocket broadcast, email or push is added. |
| Rebooking | Cancelled Booking links to a fresh booking flow; dismissal requires a matching server-confirmed cancelled Booking. Current backend capacity/eligibility and a fresh booking key still apply. |
| Route selection | Per subsequent UI feedback, automatic endpoint suggestions are deferred for team research. Host selects an existing approved route and sets a meeting point on one map; saved checkpoints/hazards are available in a collapsed list. |
| Porter documentation | Porter/Admin pages explain activity-specific evidence, internal review vs legal eligibility, and official source links. Existing manual verification gate and route qualification checks remain. |

## Data and API changes

- `1792627200000-AddBookingCancellationNotices`: recipient-scoped transactional inbox with read timestamp and deduplication constraint.
- `1792627200001-UpdateDefaultCancellationPolicy`: updates only exact previous built-in rules on future draft/pending-approval/published Trips. Existing Booking snapshots, custom policies, unknown legacy policies and existing holds remain untouched. Backups permit rollback without overwriting a subsequently edited policy.
- `PATCH /api/bookings/:bookingId/cancel` now requires `{ reason: string }`.
- `GET /api/booking-cancellation-notices`: own recipient's newest 50 rows, Host/Admin roles only.
- `PATCH /api/booking-cancellation-notices/:id/read`: own recipient only; replay preserves the first timestamp; foreign ID returns 404.
- API configuration runs pending migrations at startup (`migrationsRun: true`). All automated data tests here used `_test` databases; E2E and baseline comparisons use distinct databases.

## Validation evidence

| Check | Result |
| --- | --- |
| Project branch validator and Git whitespace check | Passed. |
| `pnpm build:all` | Passed for Web and API; existing Vite chunk-size/dynamic-import warnings. |
| `pnpm lint:all` | Passed; existing lint warnings are retained. |
| Web TypeScript after final request typing | Passed. |
| Full API unit suite | 119 suites / 1,405 tests passed. |
| Focused final Web suite | 29 files / 217 tests passed; covers Booking cancellation, endpoint suggestions, Trip detail/rebooking, role pages and Porter verification. |
| Cancellation suite after required request-type alignment | 7 files / 45 tests passed. |
| Real PostgreSQL integration, full run | 39 suites passed, 2 failed; 411 tests passed, 3 failed. Both failing suites and all 3 failures were reproduced on clean develop using a separate baseline database. All changed cancellation/refund/hold/notification/policy-migration flows passed. |
| Web regression excluding the documented pre-existing hanging equipment module | 193 files passed, 5 failed; 1,275 tests passed, 10 failed. All 10 failures in the same 5 files were reproduced on clean develop. Final added/changed UI paths were also checked by focused tests. |
| Chromium E2E, real API/PostgreSQL | 2 tests passed: required cancellation reason, rebooking, Host/Admin notices and persisted read state; paid 120-minute hold and policy snapshot/display. External HTTPS media was blocked to avoid dependence on remote images; application APIs were real. |
| Policy migration rollback | Real PostgreSQL test passed: previous built-in policy upgrades, custom policies/snapshots are preserved, rollback restores backed-up policy. |

## Existing failures kept out of this branch

Web baseline failures (10 tests):

- `AvailablePortersPanel.test.tsx`: 3 stale UI/request assertions.
- `TripDetailView.test.tsx`: 1 missing payment-panel expectation.
- `BookingPanel.test.tsx`: 4 removed payment-status expectations.
- `RefundStateBadge.test.tsx`: 1 pending-label expectation.
- `EquipmentCatalogList.test.tsx`: 1 rendered-field/status expectation.

`TripRentableEquipment.test.tsx` prevents an unrestricted full Web run from finishing. The same module on clean develop exceeded a 20-second process limit and only that baseline test process tree was stopped. Its component defaults `selectedEquipment` to a fresh array and synchronizes it into state in an effect; the source is unchanged in this branch. The regression command explicitly excluded this module; it is not reported as passed.

API baseline failures (3 tests):

- `trips.porter-requests.integration-spec.ts`: expects only one accepted Porter invitation, receives two accepted responses.
- `trips.available-porters.integration-spec.ts`: expects an older field set without avatarUrl, and expects a 409 after an assignment where current develop returns 200.

An initial broad integration run overlapped an earlier E2E run on the shared test database, causing OTP cleanup-count assertions. E2E was moved to `ctms_mentor_e2e_test`, baseline comparison to `ctms_mentor_baseline_test`, and the complete integration suite was rerun without those OTP failures. Packing-list concurrency also passed on the final run and on clean baseline. No unrelated implementation was changed to hide these results.

The complete repository test suite is therefore not green. This report distinguishes verified mentor fixes from existing baseline defects; no unrelated test was weakened or silently marked skipped.

## Remaining practical limits

- Unknown legacy policy shapes still fail closed; the migration does not guess contractual refund terms.
- Automatic endpoint suggestions are deferred. Live routing-provider integration and external water/hazard discovery are not implemented or claimed.
- Porter guidance links the Ministry's [guide eligibility explanation](https://bvhttdl.gov.vn/Pages/chi-tiet.aspx?url=/quy-dinh-moi-ve-huong-dan-vien-trong-luat-du-lich-2017-619207.htm) and [2025 climbing training program](https://bvhttdl.gov.vn/trien-khai-chuong-trinh-tap-huan-chuyen-mon-the-thao-doi-voi-nguoi-huong-dan-tap-luyen-mon-leo-nui-the-thao-20250607105842503.htm). Admin approval is an internal workflow, not a state-issued legal credential.
- No in-app physical equipment pickup/return tracking was introduced. The release's off-platform handover policy is explicitly recorded in the cancellation amendment.


## UI feedback follow-up (22/10/2026)

Supersedes the endpoint matching prototype described above: the team will research automatic route/checkpoint suggestions separately. Trip creation now only selects an existing approved route and sets the meeting point on one map. Saved safety checkpoints remain available in a collapsed list; duplicate geometry preview and endpoint picker were removed, together with the unused matching utility and editor extensions.

Homepage title shortened to “Quản lý hành trình thông minh.” Cancellation inbox opens through a bell beside Host/Admin branding; no full-width banner. Admin menu scrolls independently with a fixed footer containing logout. Camper map uses OpenStreetMap tiles and stored meeting/waypoint coordinates for the earliest confirmed active/upcoming booking; no simulated live position, automatic hazard discovery, or invented route geometry. No eligible booking displays an empty state; errors offer retry.

Validation for UI follow-up: TypeScript build and ESLint pass (one pre-existing Sidebar suppression warning). Focused Vitest: 6 files, 34 tests pass. Dedicated mocked-API Chromium suite: 4/4 pass, covering inbox open/close, logout visibility at 1280x600, actual geographic tiles and saved markers, and one-map trip creation. Screenshots inspected. These UI browser tests do not claim to re-test backend transactions. The API is unchanged in this follow-up.

Production Web bundle also passes after the UI follow-up (existing Vite chunk-size/import warnings remain).


## Route-map and demo cancellation follow-up

- Replaces the intermediate Leaflet/OSM Camper map with the project's existing MapLibre hybrid/satellite RouteCheckpointMap. Camper and Porter now show persisted route geometry, checkpoints and danger zones in a wider card. Porter loads actual assignments rather than the Camper booking hook, prioritizes ongoing/upcoming assignments and can switch trips.
- Added GET `/api/trips/:tripId/route-map` for the owning Camper of an eligible booking only; private/no-store; 404 for foreign or cancelled bookings. It returns a minimal map projection, reusing the exact route projection used by Porter operations. General Trip details still hide private route IDs.
- Root cause of the reported cancellation for booking `d50bbcc5-ab50-4d7c-ba28-4ef7a308ce7e`: synthetic seed row marked confirmed/paid, null policy snapshot, no Payment rows, no API idempotency key/fingerprint. This is not a transaction failure on an API-created booking.
- Added a non-production seed-only repair guarded by a fixed demo account allowlist, `[CTMS-024]` title prefix and absence of API idempotency/fingerprint. It fills only missing policy evidence and creates explicitly simulated charge evidence only when no Payment rows exist, with audit and idempotence. Applied once to the exact reported local demo booking; it remains confirmed for the user to cancel. No real money was charged/refunded. Ordinary cancellation still rejects incomplete or ambiguous real records rather than inventing evidence.
- Updated roster/group seed generation to retain policy evidence; the roster seed also creates missing simulated paid evidence. API errors now explain missing policy or missing payment evidence through a fixed message allowlist, without exposing unknown internal messages.
- Validation: Web/API TypeScript pass; 53 API unit tests, 35 real-PostgreSQL integration tests, 54 focused Web tests pass. Integration covers route-map ownership/revocation, demo repair/refusal/idempotence and ordinary cancellation after repair. Chromium: 5 UI tests pass using the actual MapLibre renderer with a deterministic style fixture; external tile delivery is not claimed by these tests because MapTiler/network availability failed in the test environment. Real API/PostgreSQL booking Chromium suite: 2/2 pass, including required reason, cancellation, notices/read-state persistence, rebooking, 120-minute hold and new policy. The reload assertion was updated to reopen the new inbox dialog.


## Lượt sửa bổ sung theo evidence

- Trang chủ: “Trekking nhẹ nhàng, an toàn trọn vẹn.” và mô tả lựa chọn tour theo yêu cầu.
- Bản đồ công khai trạng thái render sau MapLibre idle, style và toàn bộ tile trong khung nhìn đã tải; ảnh evidence đợi trạng thái này thay vì chỉ đợi sự kiện load.
- Khắc phục vòng lặp cập nhật state do giá trị mặc định mảng rỗng mới mỗi render ở TripRentableEquipment và RentableEquipmentModal.
- Khôi phục trạng thái thanh toán trong kết quả đặt chỗ và trạng thái chờ/hạn phản hồi lời mời Porter.
- Theo ma trận CTMS-046, hai Porter nhận lời cùng Trip chỉ một người được phân công: kiểm tra schedule-holding assignment sau khóa Trip, giữ nguyên replay idempotent; chặn tìm/gửi lời mời khi Trip đã có Porter hoạt động.
- Đồng bộ assertion nhãn UI đã dịch, fixture tổng tiền và trường avatarUrl với contract hiện tại. Không bỏ test hoặc loại suite khỏi lượt regression cuối.
- Log các lần chạy cũ được giữ để truy vết; kết quả cuối nằm trong bộ evidence cập nhật.
