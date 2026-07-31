## Parent Story
- External Story ID: `CTMS-38`
- Story title: Chỉnh sửa Trip
- Epic: `ctms-epic-05`
- Sprint: `Sprint 2`

## Requirement
- Implement screen/form, loading states, empty states and user-facing errors.
- Acceptance Criteria: Chỉ Host sở hữu được sửa; starts_at, ends_at, capacity và trip_camp_stays sau khi Trip có status = published phải kiểm tra ảnh hưởng tới booking, Porter, thiết bị và zone; thay đổi quan trọng được ghi audit và gửi thông báo.

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
- Blocked by: `CTMS-38-T01`
- Story dependency: `CTMS-32, CTMS-33`

## Definition of Done
- [ ] Implementation complete.
- [ ] Unit tests pass.
- [ ] E2E checklist passes or evidence is attached.
- [ ] Story acceptance criteria verified.
