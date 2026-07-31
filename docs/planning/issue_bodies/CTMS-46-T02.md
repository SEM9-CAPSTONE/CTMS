## Parent Story
- External Story ID: `CTMS-46`
- Story title: Xử lý hoàn tiền
- Epic: `ctms-epic-06`
- Sprint: `Sprint 3`

## Requirement
- Implement validation, boundary handling, conflict handling and recoverable error behavior.
- Acceptance Criteria: Tạo giao dịch refund gắn với booking; cập nhật bookings.payment_status = refunded hoặc partially_refunded và payments.status = refunded; không hoàn tiền hai lần; lưu transaction_ref.

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
- Blocked by: `CTMS-46-T01`
- Story dependency: `CTMS-45, CTMS-43`

## Definition of Done
- [ ] Implementation complete.
- [ ] Unit tests pass.
- [ ] E2E checklist passes or evidence is attached.
- [ ] Story acceptance criteria verified.
