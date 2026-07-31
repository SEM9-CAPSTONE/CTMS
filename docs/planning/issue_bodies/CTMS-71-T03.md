## Parent Story
- External Story ID: `CTMS-71`
- Story title: Xác nhận đoàn đã đến checkpoint
- Epic: `ctms-epic-08`
- Sprint: `Sprint 4`

## Requirement
- Implement validation, boundary handling, conflict handling and recoverable error behavior.
- Acceptance Criteria: Lưu thời gian, vị trí và người xác nhận; hoạt động được khi offline và đồng bộ sau.

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
- Blocked by: `CTMS-71-T01`
- Story dependency: `CTMS-20, CTMS-63, CTMS-70`

## Definition of Done
- [ ] Implementation complete.
- [ ] Unit tests pass.
- [ ] E2E checklist passes or evidence is attached.
- [ ] Story acceptance criteria verified.
