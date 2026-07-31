## Parent Story
- External Story ID: `CTMS-62`
- Story title: Phân công Porter cho chuyến trekking
- Epic: `ctms-epic-08`
- Sprint: `Sprint 3`

## Requirement
- Implement API/service logic, persistence contract and authorization checks.
- Acceptance Criteria: Chỉ phân công Porter có campsite_porters.status = active tại campsite xuất phát của route; Porter lead phải có proficiency IN (proficient, expert); không cho work_range chồng với porter_assignments có status IN (pending, accepted); gửi thông báo để Porter xác nhận hoặc từ chối.

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
- Story dependency: `CTMS-32, CTMS-58, CTMS-61`

## Definition of Done
- [ ] Implementation complete.
- [ ] Unit tests pass.
- [ ] E2E checklist passes or evidence is attached.
- [ ] Story acceptance criteria verified.
