## Parent Story
- External Story ID: `CTMS-43`
- Story title: Thanh toán booking
- Epic: `ctms-epic-06`
- Sprint: `Sprint 3`

## Requirement
- Implement API/service logic, persistence contract and authorization checks.
- Acceptance Criteria: Tạo payment transaction với idempotency_key duy nhất; payments.status sử dụng pending, succeeded hoặc failed. Khi thành công, bookings.payment_status = paid và bookings.status = confirmed; giao dịch trùng không được ghi nhận hai lần.

## Implementation Checklist
- [ ] Confirm roles/permissions and request/response contract.
- [ ] Implement the smallest usable vertical feature slice.
- [ ] Persist/read data using the database-aligned CTMS model.
- [ ] Handle success, validation, authorization and dependency failure paths.

## Unit Test Checklist
- [ ] Valid input succeeds and returns/persists expected state.
- [ ] Invalid, duplicate, unauthorized or out-of-range input is rejected safely.
- [ ] Database/status enum values match reviewed CTMS schema.
- [ ] Edge cases from acceptance criteria are covered.

## E2E Test Checklist
- [ ] User can complete happy path from UI/API entry to persisted result.
- [ ] Negative path displays actionable error and does not corrupt state.
- [ ] Refresh/reload still shows persisted result correctly.

## Linked Items
- Blocked by: `None`
- Story dependency: `CTMS-40`

## Definition of Done
- [ ] Implementation complete.
- [ ] Unit tests pass.
- [ ] E2E checklist passes or evidence is attached.
- [ ] Story acceptance criteria verified.
