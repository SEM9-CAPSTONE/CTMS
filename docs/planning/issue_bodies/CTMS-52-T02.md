## Parent Story
- External Story ID: `CTMS-52`
- Story title: Quản lý danh mục thiết bị
- Epic: `ctms-epic-07`
- Sprint: `Sprint 3`

## Requirement
- Implement screen/form, loading states, empty states and user-facing errors.
- Acceptance Criteria: Tạo và sửa danh mục equipment; không dùng xóa mềm vì bảng equipment không có deleted_at. Khi ngừng sử dụng, chuyển equipment.status sang maintenance, lost hoặc retired tùy ngữ cảnh; lưu quantity_total, rental_price_per_day, deposit_amount, storage_location và maintenance_schedule.

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
- Blocked by: `CTMS-52-T01`
- Story dependency: `CTMS-06, CTMS-10`

## Definition of Done
- [ ] Implementation complete.
- [ ] Unit tests pass.
- [ ] E2E checklist passes or evidence is attached.
- [ ] Story acceptance criteria verified.
