## User Story
Là Camper, tôi muốn hủy booking theo chính sách.

## Metadata
- External ID: `CTMS-45`
- Epic: `ctms-epic-06` / Booking and Payment
- Priority: `Should Have`
- Story points: `5`
- Sprint: `Sprint 3`
- Scope: `committed`

## Use Case
Hủy booking theo chính sách

## Acceptance Criteria
Tính phí hủy theo cancellation_policy_snapshot; cập nhật bookings.status = cancelled và cancelled_at; giảm seats_taken, giải phóng equipment_reservations còn hiệu lực; ghi booking_change_logs và lý do.

## Child Task Checklist
- [ ] `CTMS-45-T01` Hủy booking theo chính sách - backend/API and domain rules
- [ ] `CTMS-45-T02` Hủy booking theo chính sách - UI flow
- [ ] `CTMS-45-T03` Hủy booking theo chính sách - validation and edge cases
- [ ] `CTMS-45-T04` Hủy booking theo chính sách - integration and acceptance evidence

## Blocked By
- `CTMS-40`

## Definition of Done
- [ ] All child task checklists are completed.
- [ ] Unit test checklist in each task is verified.
- [ ] E2E checklist in each task is verified or evidence is attached.
- [ ] Linked blockers are resolved or explicitly waived.
