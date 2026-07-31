## Parent Story
- External Story ID: `CTMS-51`
- Story title: Thêm dịch vụ vào booking
- Epic: `ctms-epic-06`
- Sprint: `Sprint 3`

## Requirement
- Wire integration where applicable and capture evidence for acceptance criteria.
- Acceptance Criteria: Lưu booking_items với item_type, ref_id, quantity và price; cập nhật surcharge và total_amount; thiết bị thuê không được lưu ở booking_items mà sử dụng equipment_reservations.

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
- Blocked by: `CTMS-51-T01`
- Story dependency: `CTMS-40`

## Definition of Done
- [ ] Implementation complete.
- [ ] Unit tests pass.
- [ ] E2E checklist passes or evidence is attached.
- [ ] Story acceptance criteria verified.
