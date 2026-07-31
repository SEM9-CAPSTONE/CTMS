## Parent Story
- External Story ID: `CTMS-44`
- Story title: Tự động hết hạn booking
- Epic: `ctms-epic-06`
- Sprint: `Sprint 3`

## Requirement
- Implement validation, boundary handling, conflict handling and recoverable error behavior.
- Acceptance Criteria: Booking có status = pending_payment quá hold_expires_at chuyển status = expired; giảm seats_taken nếu đã giữ chỗ; equipment_reservations có status = reserved liên quan chuyển status = cancelled; ghi booking_change_logs và phát thông báo.

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
- Blocked by: `CTMS-44-T01`
- Story dependency: `CTMS-40, CTMS-43`

## Definition of Done
- [ ] Implementation complete.
- [ ] Unit tests pass.
- [ ] E2E checklist passes or evidence is attached.
- [ ] Story acceptance criteria verified.
