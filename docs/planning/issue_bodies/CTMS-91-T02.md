## Parent Story
- External Story ID: `CTMS-91`
- Story title: Đánh giá câu trả lời AI
- Epic: `ctms-epic-12`
- Sprint: `Sprint 5`

## Requirement
- Implement screen/form, loading states, empty states and user-facing errors.
- Acceptance Criteria: Cho phép Useful, Not Useful và Report Unsafe; đồng bộ phản hồi khi có mạng.

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
- Blocked by: `CTMS-91-T01`
- Story dependency: `CTMS-88`

## Definition of Done
- [ ] Implementation complete.
- [ ] Unit tests pass.
- [ ] E2E checklist passes or evidence is attached.
- [ ] Story acceptance criteria verified.
