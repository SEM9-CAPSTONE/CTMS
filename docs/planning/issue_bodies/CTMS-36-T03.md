## Parent Story
- External Story ID: `CTMS-36`
- Story title: Tìm kiếm và xem chi tiết Trip
- Epic: `ctms-epic-05`
- Sprint: `Sprint 2`

## Requirement
- Implement validation, boundary handling, conflict handling and recoverable error behavior.
- Acceptance Criteria: Chỉ hiển thị Trip có status = published; hỗ trợ lọc theo thời gian, trip_type, độ khó, giá và route; hiển thị starts_at, ends_at, meeting_point, giá, số chỗ còn lại, includes/excludes và mức rủi ro gần nhất.

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
- Blocked by: `CTMS-36-T01`
- Story dependency: `CTMS-34, CTMS-24`

## Definition of Done
- [ ] Implementation complete.
- [ ] Unit tests pass.
- [ ] E2E checklist passes or evidence is attached.
- [ ] Story acceptance criteria verified.
