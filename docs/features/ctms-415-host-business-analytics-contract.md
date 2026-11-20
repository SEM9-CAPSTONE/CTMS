# CTMS-415 — Host Business Analytics & Trip Suggestions API Contract (Backend)

## 1. Endpoints (`@Roles(HOST)`, `Cache-Control: no-store`)
Mọi endpoint tự động khóa phạm vi theo `hostId = @CurrentUser().userId` và bỏ qua mọi `hostId` từ client.

### `GET /api/host/analytics?from&to&areaCode`
- **Query**:
  - `from`, `to` (ISO 8601, tùy chọn; phải truyền cả 2 hoặc không truyền; mặc định 12 tháng gần nhất).
  - `areaCode` (mã khu vực trong `geo_areas`, tối đa 32 ký tự; không tồn tại → `422`).
- **Response (`200 OK`)**:
  - `financial`: lấy nguyên vẹn từ CTMS-110 (`RevenueAnalyticsService.getRevenueAnalytics`), giữ nguyên `payout: null`, `pendingPayout: null` khi lọc `areaCode`.
  - `operations`: tính trên chuyến **`completed`** có `trips.starts_at` trong `[from, to]`:
    - `fillRate = SUM(seats_taken) / SUM(capacity_max) * 100` (`null` nếu không có chuyến đủ điều kiện).
    - `totalGuests = SUM(bookings.num_people)` của booking `confirmed | completed` (tách riêng với `seats_taken`).
    - `cancellationRate = cancelledBookings / totalBookingsOnCompletedTrips * 100` (`null` nếu mẫu số = 0).
    - `excludedTrips`: chuyến `completed` thiếu `capacity_max` (`missing_capacity_max`) hoặc có booking thiếu `num_people` (`missing_num_people`).
    - `cancelledTrips`: `{ count, tripCancellationRate, bookingsOnCancelledTrips }`.
    - Breakdowns: `byTrip`, `byRoute`, `byArea`, `byDepartureMonth` (theo `Asia/Ho_Chi_Minh`).
  - `upcoming`: chuyến `published` (`starts_at >= now()`) + `ongoing`, **không phụ thuộc `from`/`to`**, chỉ lọc theo `areaCode`, tối đa 20 chuyến, kèm `includesHeldSeats: true`.
  - `leadTime`: `trip_starts_at_snapshot - bookings.created_at` (ngày), `averageDays`, `medianDays`, `sampleSize`.
  - `seasonality`: tính trên **toàn bộ lịch sử** chuyến `completed` (`basis: "all_history"`), bỏ qua `from`/`to`:
    - `status: "ok"` khi khoảng cách từ tháng chuyến đầu tiên đến tháng chuyến gần nhất `>= 12` tháng; ngược lại `"insufficient_history"`.
    - Các tháng không có chuyến điền `tripCount: 0, totalGuests: 0, fillRate: null`.
    - `highestMonths`, `lowestMonths` (`null` khi `insufficient_history`).
  - `externalSeason`: cố định `{ "status": "not_available" }`.
  - `profit`: `null`, `profitStatus`: `"insufficient_data"`.
  - `smallSample`: `true` khi `< 5` chuyến hoàn thành hoặc `< 20` booking trong phạm vi.
  - `dataBasis`: ghi rõ múi giờ `Asia/Ho_Chi_Minh`, mốc thời gian từng khối, `formulaVersion: "host-analytics-v1"`.

### `POST /api/host/analytics/suggestions`
- **Body**: `{ from?, to?, areaCode? }`.
- **Responses**:
  - `200 OK`: tái dùng job `succeeded` cùng `source_hash` (không trừ hạn mức).
  - `202 Accepted`: tạo job `queued` mới hoặc trả job active có cùng `(periodFrom, periodTo, areaCode)`.
  - `409 Conflict` (`active_job_different_params`): đang có job active với tham số khác (kèm `activeJob`).
  - `422 Unprocessable Entity` (`no_eligible_candidates` hoặc `INVALID_AREA_CODE`).
  - `429 Too Many Requests` (`cooldown_active` hoặc `daily_quota_exceeded`, kèm header `Retry-After`).
- **Hoàn hạn mức ngày**: Nếu job kết thúc `failed` với `error_code = 'analysis_unavailable'`, worker tự động giảm `daily_count` đi 1 cho ngày tạo job theo giờ Việt Nam.

### `GET /api/host/analytics/suggestions/latest` & `GET /api/host/analytics/suggestions/:id`
- Trả job của Host hiện tại kèm `stale: boolean` (`currentSourceHash !== job.sourceHash`) và danh sách `suggestions` (kèm `rationaleLabels` tiếng Việt tĩnh, `suggestedPricePerPerson` số nguyên bội số 10.000 VND hoặc `null`, `suggestedCapacityMin` số nguyên `>= 1` hoặc `null`). Gợi ý `stale: true` vẫn trả về bình thường. `404` nếu không tồn tại hoặc thuộc Host khác.

### `GET /api/host/analytics/suggestions/:id/quick-create-context`
- Chỉ đọc, kiểm tra lại trực tiếp trên DB: tuyến thuộc Host (`route_not_owned` → `409`), `status = 'active'` (`route_not_active` → `409`), và `areaCode` còn active trong `geo_areas` (`area_inactive` → `409`).
- Trả `{ valid: true, prefill: { routeId, areaCode, tripType, pricePerPerson, capacityMin, suggestedMonth } }`. Không điền ngày cụ thể; trường `null` không được điền sẵn.

## 2. Ghi chú bàn giao cho nhánh FE (CTMS-416)
1. **Hiển thị trạng thái**:
   - Luôn tôn trọng `profit === null` (`profitStatus: "insufficient_data"`), `financial.kpis.payout === null` khi lọc khu vực, `externalSeason.status === "not_available"`, `smallSample === true`, và `stale === true`.
   - Hiển thị rõ nhãn `upcoming` có `includesHeldSeats: true` (bao gồm chỗ đang giữ chờ thanh toán) và `seasonality` mang `basis: "all_history"`.
   - Xử lý `409 active_job_different_params` (hiển thị thông báo đang có job khác tham số đang chạy) và `429` đọc header `Retry-After`.
2. **Tạo chuyến nhanh (`CreateTripPage`)**:
   - `POST /api/trips` hiện **chưa có cơ chế chống tạo trùng (idempotency)** → FE cần disable nút gửi khi đang submit.
   - `CreateTripPage` hiện **chưa hỗ trợ pre-fill** từ query params / `history.state` và có cơ chế **autosave draft** (`useTripDraftSession` / `useTripFormAutosave` + `reset(draft)`). Nhánh FE cần ưu tiên dữ liệu pre-fill từ `quick-create-context` (không để bản nháp cũ ghi đè), bỏ qua các trường `null`, và để trống ngày khởi hành để Host tự chọn.
3. **Thay đổi ngoài module mới**:
   - Chỉ thêm duy nhất 1 dòng `exports: [RevenueAnalyticsService]` tại `services/api/src/modules/revenue-analytics/revenue-analytics.module.ts` (đã tách commit riêng để dễ review).
   - Seed `seedHostAnalyticsHistoryScenarios` bổ sung 8 tháng lịch sử trước `08/2026` (`12/2025–07/2026`) cho `host@ctms.local` nên tổng preset `12m` và `all` trên trang "Ví & Doanh thu" sẽ tăng tương ứng (preset `30d`, `90d` giữ nguyên).
