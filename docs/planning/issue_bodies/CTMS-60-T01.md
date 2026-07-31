## Parent Story
- External Story ID: `CTMS-60`
- Story title: Phản hồi lời mời campsite
- Epic: `ctms-epic-08`
- Sprint: `Sprint 3`

## Requirement
- Implement API/service logic, persistence contract and authorization checks.
- Acceptance Criteria: Porter chỉ phản hồi lời mời của chính mình; chấp nhận chuyển campsite_porters.status = active và ghi joined_at; từ chối hoặc rời campsite chuyển status = removed; tạm nghỉ chuyển status = paused; Host nhận thông báo.

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
- Story dependency: `CTMS-59`

## Definition of Done
- [ ] Implementation complete.
- [ ] Unit tests pass.
- [ ] E2E checklist passes or evidence is attached.
- [ ] Story acceptance criteria verified.
