## Parent Story
- External Story ID: `CTMS-40`
- Story title: Tạo booking cho Trip
- Epic: `ctms-epic-06`
- Sprint: `Sprint 2`

## Requirement
- Implement validation, boundary handling, conflict handling and recoverable error behavior.
- Acceptance Criteria: Chỉ tạo cho Trip có status = published, chưa quá booking_deadline, không ở mức Weather Risk Red và còn đủ chỗ; lưu snapshot ngày, giá và chính sách hủy. Trip miễn phí tạo bookings.status = confirmed và payment_status = not_required; Trip có phí tạo bookings.status = pending_payment và payment_status = unpaid.

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
- Blocked by: `CTMS-40-T01`
- Story dependency: `CTMS-34, CTMS-35, CTMS-28`

## Definition of Done
- [ ] Implementation complete.
- [ ] Unit tests pass.
- [ ] E2E checklist passes or evidence is attached.
- [ ] Story acceptance criteria verified.
