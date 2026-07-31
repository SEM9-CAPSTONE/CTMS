## Parent Story
- External Story ID: `CTMS-54`
- Story title: Ghi nhận bàn giao thiết bị khi check-in
- Epic: `ctms-epic-07`
- Sprint: `Sprint 3`

## Requirement
- Wire integration where applicable and capture evidence for acceptance criteria.
- Acceptance Criteria: Khi bàn giao, cập nhật equipment_reservations.status = picked_up và picked_up_at; nếu gán thiết bị cụ thể thì cập nhật equipment_items.status = in_use. Không chuyển toàn bộ bản ghi loại thiết bị trong bảng equipment sang in_use; lưu người nhận và thời gian bàn giao.

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
- Blocked by: `CTMS-54-T01`
- Story dependency: `CTMS-53, CTMS-48`

## Definition of Done
- [ ] Implementation complete.
- [ ] Unit tests pass.
- [ ] E2E checklist passes or evidence is attached.
- [ ] Story acceptance criteria verified.
