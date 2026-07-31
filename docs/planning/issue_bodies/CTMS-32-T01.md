## Parent Story
- External Story ID: `CTMS-32`
- Story title: Tạo Trip
- Epic: `ctms-epic-05`
- Sprint: `Sprint 2`

## Requirement
- Implement API/service logic, persistence contract and authorization checks.
- Acceptance Criteria: Trip có route, tiêu đề, trip_type = day_trip hoặc overnight, thời gian bắt đầu/kết thúc, điểm tập trung, hạn booking, sức chứa tối thiểu/tối đa và giá; starts_at < ends_at; Trip mới có status = pending_approval.

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
- Story dependency: `CTMS-19`

## Definition of Done
- [ ] Implementation complete.
- [ ] Unit tests pass.
- [ ] E2E checklist passes or evidence is attached.
- [ ] Story acceptance criteria verified.
