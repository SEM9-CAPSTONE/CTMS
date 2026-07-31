## User Story
Là Camper, tôi muốn tạo booking để mua suất tham gia một Trip đã công khai.

## Metadata
- External ID: `CTMS-40`
- Epic: `ctms-epic-06` / Booking and Payment
- Priority: `Must Have`
- Story points: `8`
- Sprint: `Sprint 2`
- Scope: `committed`

## Use Case
Tạo booking cho Trip

## Acceptance Criteria
Chỉ tạo cho Trip có status = published, chưa quá booking_deadline, không ở mức Weather Risk Red và còn đủ chỗ; lưu snapshot ngày, giá và chính sách hủy. Trip miễn phí tạo bookings.status = confirmed và payment_status = not_required; Trip có phí tạo bookings.status = pending_payment và payment_status = unpaid.

## Child Task Checklist
- [ ] `CTMS-40-T01` Tạo booking cho Trip - backend/API and domain rules
- [ ] `CTMS-40-T02` Tạo booking cho Trip - UI flow
- [ ] `CTMS-40-T03` Tạo booking cho Trip - validation and edge cases
- [ ] `CTMS-40-T04` Tạo booking cho Trip - integration and acceptance evidence

## Blocked By
- `CTMS-34`
- `CTMS-35`
- `CTMS-28`

## Definition of Done
- [ ] All child task checklists are completed.
- [ ] Unit test checklist in each task is verified.
- [ ] E2E checklist in each task is verified or evidence is attached.
- [ ] Linked blockers are resolved or explicitly waived.
