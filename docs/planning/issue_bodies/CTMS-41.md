## User Story
Là Camper, tôi muốn thêm thành viên vào booking.

## Metadata
- External ID: `CTMS-41`
- Epic: `ctms-epic-06` / Booking and Payment
- Priority: `Must Have`
- Story points: `5`
- Sprint: `Sprint 2`
- Scope: `committed`

## Use Case
Thêm thành viên vào booking

## Acceptance Criteria
booking_members chứa toàn bộ người tham gia, kể cả người đặt booking; mỗi booking có đúng một is_primary = true; num_people bằng số booking_members; không thêm trùng user trong cùng booking và không làm booking vượt sức chứa Trip.

## Child Task Checklist
- [ ] `CTMS-41-T01` Thêm thành viên vào booking - backend/API and domain rules
- [ ] `CTMS-41-T02` Thêm thành viên vào booking - UI flow
- [ ] `CTMS-41-T03` Thêm thành viên vào booking - validation and edge cases
- [ ] `CTMS-41-T04` Thêm thành viên vào booking - integration and acceptance evidence

## Blocked By
- `CTMS-40`

## Definition of Done
- [ ] All child task checklists are completed.
- [ ] Unit test checklist in each task is verified.
- [ ] E2E checklist in each task is verified or evidence is attached.
- [ ] Linked blockers are resolved or explicitly waived.
