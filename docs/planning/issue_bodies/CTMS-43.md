## User Story
Là Camper, tôi muốn thanh toán booking để xác nhận suất tham gia Trip.

## Metadata
- External ID: `CTMS-43`
- Epic: `ctms-epic-06` / Booking and Payment
- Priority: `Must Have`
- Story points: `8`
- Sprint: `Sprint 3`
- Scope: `committed`

## Use Case
Thanh toán booking

## Acceptance Criteria
Tạo payment transaction với idempotency_key duy nhất; payments.status sử dụng pending, succeeded hoặc failed. Khi thành công, bookings.payment_status = paid và bookings.status = confirmed; giao dịch trùng không được ghi nhận hai lần.

## Child Task Checklist
- [ ] `CTMS-43-T01` Thanh toán booking - backend/API and domain rules
- [ ] `CTMS-43-T02` Thanh toán booking - UI flow
- [ ] `CTMS-43-T03` Thanh toán booking - validation and edge cases
- [ ] `CTMS-43-T04` Thanh toán booking - integration and acceptance evidence

## Blocked By
- `CTMS-40`

## Definition of Done
- [ ] All child task checklists are completed.
- [ ] Unit test checklist in each task is verified.
- [ ] E2E checklist in each task is verified or evidence is attached.
- [ ] Linked blockers are resolved or explicitly waived.
