## Parent Story
- External Story ID: `CTMS-14`
- Story title: Cập nhật trạng thái zone
- Epic: `ctms-epic-02`
- Sprint: `Sprint 2`

## Requirement
- Implement API/service logic, persistence contract and authorization checks.
- Acceptance Criteria: Zone sử dụng đúng enum zone_status: active, closed, archived; zone có status khác active không được chọn cho đêm nghỉ mới; các Trip đang bị ảnh hưởng phải được cảnh báo để xử lý.

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
- Story dependency: `CTMS-12`

## Definition of Done
- [ ] Implementation complete.
- [ ] Unit tests pass.
- [ ] E2E checklist passes or evidence is attached.
- [ ] Story acceptance criteria verified.
