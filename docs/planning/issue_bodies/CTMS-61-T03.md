## Parent Story
- External Story ID: `CTMS-61`
- Story title: Xác minh năng lực Porter theo route
- Epic: `ctms-epic-08`
- Sprint: `Sprint 3`

## Requirement
- Implement validation, boundary handling, conflict handling and recoverable error behavior.
- Acceptance Criteria: Chỉ Porter có campsite_porters.status = active tại campsite của route mới được gán proficiency; porter_routes.proficiency sử dụng learning, proficient hoặc expert; lưu times_led, verified_by và verified_at; một Porter chỉ có một hồ sơ trên mỗi route.

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
- Blocked by: `CTMS-61-T01`
- Story dependency: `CTMS-22, CTMS-60`

## Definition of Done
- [ ] Implementation complete.
- [ ] Unit tests pass.
- [ ] E2E checklist passes or evidence is attached.
- [ ] Story acceptance criteria verified.
