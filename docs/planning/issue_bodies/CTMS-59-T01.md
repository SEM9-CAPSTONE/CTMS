## Parent Story
- External Story ID: `CTMS-59`
- Story title: Mời Porter vào campsite
- Epic: `ctms-epic-08`
- Sprint: `Sprint 3`

## Requirement
- Implement API/service logic, persistence contract and authorization checks.
- Acceptance Criteria: Tạo campsite_porters với status = invited; không tạo trùng cặp campsite_id và porter_id; lưu invited_by và day_rate; Porter nhận thông báo.

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
- Story dependency: `CTMS-06, CTMS-10, CTMS-57`

## Definition of Done
- [ ] Implementation complete.
- [ ] Unit tests pass.
- [ ] E2E checklist passes or evidence is attached.
- [ ] Story acceptance criteria verified.
