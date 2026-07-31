## Parent Story
- External Story ID: `CTMS-30`
- Story title: Cấu hình Weather Risk rules
- Epic: `ctms-epic-04`
- Sprint: `Post-defense`

## Requirement
- Wire integration where applicable and capture evidence for acceptance criteria.
- Acceptance Criteria: Lưu weights, thresholds, version và trạng thái is_active; chỉ một phiên bản phù hợp được sử dụng tại một thời điểm; thay đổi được ghi audit log.

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
- Blocked by: `CTMS-30-T01`
- Story dependency: `CTMS-06, CTMS-25`

## Definition of Done
- [ ] Implementation complete.
- [ ] Unit tests pass.
- [ ] E2E checklist passes or evidence is attached.
- [ ] Story acceptance criteria verified.
