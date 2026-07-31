## Parent Story
- External Story ID: `CTMS-22`
- Story title: Phê duyệt route
- Epic: `ctms-epic-03`
- Sprint: `Sprint 2`

## Requirement
- Implement API/service logic, persistence contract and authorization checks.
- Acceptance Criteria: Route có status = draft hoặc pending_approval được kiểm tra dữ liệu hình học, độ khó và checkpoint; duyệt thành công chuyển status = active. Nếu không duyệt, chuyển về draft để Host chỉnh sửa; trường hợp route không được phép hoạt động thì chuyển status = closed. Lý do được lưu trong audit_logs/notifications; không sử dụng status rejected.

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
- Story dependency: `CTMS-06, CTMS-19`

## Definition of Done
- [ ] Implementation complete.
- [ ] Unit tests pass.
- [ ] E2E checklist passes or evidence is attached.
- [ ] Story acceptance criteria verified.
