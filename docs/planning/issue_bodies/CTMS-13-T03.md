## Parent Story
- External Story ID: `CTMS-13`
- Story title: Lập lịch đóng campsite hoặc zone
- Epic: `ctms-epic-02`
- Sprint: `Sprint 2`

## Requirement
- Implement validation, boundary handling, conflict handling and recoverable error behavior.
- Acceptance Criteria: Cho phép chọn phạm vi Campsite hoặc Zone, ngày bắt đầu, ngày kết thúc và lý do; ngày bắt đầu không sau ngày kết thúc; Trip và trip_camp_stays giao với khoảng đóng không được công khai hoặc sử dụng.

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
- Blocked by: `CTMS-13-T01`
- Story dependency: `CTMS-10, CTMS-12`

## Definition of Done
- [ ] Implementation complete.
- [ ] Unit tests pass.
- [ ] E2E checklist passes or evidence is attached.
- [ ] Story acceptance criteria verified.
