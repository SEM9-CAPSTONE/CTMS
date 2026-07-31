## Parent Story
- External Story ID: `CTMS-89`
- Story title: Tra cứu hướng dẫn sinh tồn khi offline
- Epic: `ctms-epic-12`
- Sprint: `Sprint 4`

## Requirement
- Implement screen/form, loading states, empty states and user-facing errors.
- Acceptance Criteria: Tìm kiếm trong package cục bộ; hỗ trợ keyword hoặc full-text search; không gọi LLM online.

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
- Blocked by: `CTMS-89-T01`
- Story dependency: `CTMS-70, CTMS-66`

## Definition of Done
- [ ] Implementation complete.
- [ ] Unit tests pass.
- [ ] E2E checklist passes or evidence is attached.
- [ ] Story acceptance criteria verified.
