## Parent Story
- External Story ID: `CTMS-MVP-67A`
- Story title: Tạo offline package MVP
- Epic: `ctms-epic-09`
- Sprint: `Sprint 4`

## Requirement
- Implement validation, boundary handling, conflict handling and recoverable error behavior.
- Acceptance Criteria: Chỉ tạo cho Trip có status = published; gói gồm route, checkpoint, vùng nguy hiểm, weather snapshot và metadata phiên bản; không chứa danh sách đoàn, dữ liệu y tế, packing list hoặc Porter trong MVP.

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
- Blocked by: `CTMS-MVP-67A-T01`
- Story dependency: `CTMS-20, CTMS-23, CTMS-26, CTMS-34, CTMS-41`

## Definition of Done
- [ ] Implementation complete.
- [ ] Unit tests pass.
- [ ] E2E checklist passes or evidence is attached.
- [ ] Story acceptance criteria verified.
