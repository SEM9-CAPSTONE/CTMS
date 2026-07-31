## User Story
Là hệ thống, tôi muốn hủy Trip không đạt capacity_min trước hạn chốt.

## Metadata
- External ID: `CTMS-47`
- Epic: `ctms-epic-05` / Trip Management
- Priority: `Must Have`
- Story points: `8`
- Sprint: `Sprint 3`
- Scope: `stretch`

## Use Case
Hủy Trip không đủ người

## Acceptance Criteria
Sau booking_deadline, nếu seats_taken < capacity_min thì trips.status = cancelled; các trip_camp_stays không còn chiếm zone; equipment_reservations được giải phóng; booking được hủy và xử lý hoàn tiền.

## Child Task Checklist
- [ ] `CTMS-47-T01` Hủy Trip không đủ người - backend/API and domain rules
- [ ] `CTMS-47-T02` Hủy Trip không đủ người - validation and edge cases
- [ ] `CTMS-47-T03` Hủy Trip không đủ người - integration and acceptance evidence

## Blocked By
- `CTMS-34`
- `CTMS-43`
- `CTMS-46`

## Definition of Done
- [ ] All child task checklists are completed.
- [ ] Unit test checklist in each task is verified.
- [ ] E2E checklist in each task is verified or evidence is attached.
- [ ] Linked blockers are resolved or explicitly waived.
