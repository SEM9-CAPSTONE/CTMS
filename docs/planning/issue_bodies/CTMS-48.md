## User Story
Là Host hoặc Porter, tôi muốn check-in từng thành viên bằng mã booking hoặc QR.

## Metadata
- External ID: `CTMS-48`
- Epic: `ctms-epic-06` / Booking and Payment
- Priority: `Should Have`
- Story points: `5`
- Sprint: `Sprint 3`
- Scope: `committed`

## Use Case
Check-in thành viên

## Acceptance Criteria
Chỉ booking có status = confirmed được check-in; cập nhật booking_members.member_status = joined và checked_in_at cho từng người; booking vẫn giữ status = confirmed; không check-in thành viên có member_status = removed hoặc booking có status IN (cancelled, expired).

## Child Task Checklist
- [ ] `CTMS-48-T01` Check-in thành viên - backend/API and domain rules
- [ ] `CTMS-48-T02` Check-in thành viên - UI flow
- [ ] `CTMS-48-T03` Check-in thành viên - integration and acceptance evidence

## Blocked By
- `CTMS-41`
- `CTMS-42`

## Definition of Done
- [ ] All child task checklists are completed.
- [ ] Unit test checklist in each task is verified.
- [ ] E2E checklist in each task is verified or evidence is attached.
- [ ] Linked blockers are resolved or explicitly waived.
