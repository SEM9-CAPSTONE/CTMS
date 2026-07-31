## Parent Story
- External Story ID: `CTMS-34`
- Story title: Phê duyệt và công khai Trip
- Epic: `ctms-epic-05`
- Sprint: `Sprint 2`

## Requirement
- Implement API/service logic, persistence contract and authorization checks.
- Acceptance Criteria: Chỉ Trip có status = pending_approval và dữ liệu hợp lệ mới được chuyển sang status = published; Trip overnight phải đủ trip_camp_stays. Nếu không duyệt, giữ status = pending_approval để Host chỉnh sửa và lưu lý do trong audit_logs/notifications; nếu Trip bị hủy thì chuyển status = cancelled. Không sử dụng status rejected.

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
- Story dependency: `CTMS-06, CTMS-32, CTMS-33`

## Definition of Done
- [ ] Implementation complete.
- [ ] Unit tests pass.
- [ ] E2E checklist passes or evidence is attached.
- [ ] Story acceptance criteria verified.
