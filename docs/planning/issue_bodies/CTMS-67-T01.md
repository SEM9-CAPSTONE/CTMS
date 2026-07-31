## Parent Story
- External Story ID: `CTMS-67`
- Story title: Tạo offline package cho mỗi chuyến
- Epic: `ctms-epic-09`
- Sprint: `Post-defense`

## Requirement
- Implement API/service logic, persistence contract and authorization checks.
- Acceptance Criteria: Chỉ tạo offline package cho Trip có status = published. Gói gồm route, checkpoint, vùng nguy hiểm, packing list, weather snapshot và survival knowledge. Nếu gói chứa danh sách đoàn hoặc thông tin y tế/liên hệ khẩn cấp, dữ liệu phải lấy từ booking có status = confirmed và booking_members; Porter lấy từ porter_assignments có status = accepted. Package được tạo phiên bản mới khi dữ liệu nguồn thay đổi.

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
- Story dependency: `CTMS-20, CTMS-23, CTMS-26, CTMS-34, CTMS-41, CTMS-43, CTMS-56, CTMS-62, CTMS-66`

## Definition of Done
- [ ] Implementation complete.
- [ ] Unit tests pass.
- [ ] E2E checklist passes or evidence is attached.
- [ ] Story acceptance criteria verified.
