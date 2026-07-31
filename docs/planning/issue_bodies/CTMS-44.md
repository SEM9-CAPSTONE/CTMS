## User Story
Là hệ thống, tôi muốn tự động hết hạn booking chưa thanh toán khi thời gian giữ chỗ kết thúc.

## Metadata
- External ID: `CTMS-44`
- Epic: `ctms-epic-06` / Booking and Payment
- Priority: `Must Have`
- Story points: `5`
- Sprint: `Sprint 3`
- Scope: `committed`

## Use Case
Tự động hết hạn booking

## Acceptance Criteria
Booking có status = pending_payment quá hold_expires_at chuyển status = expired; giảm seats_taken nếu đã giữ chỗ; equipment_reservations có status = reserved liên quan chuyển status = cancelled; ghi booking_change_logs và phát thông báo.

## Child Task Checklist
- [ ] `CTMS-44-T01` Tự động hết hạn booking - backend/API and domain rules
- [ ] `CTMS-44-T02` Tự động hết hạn booking - validation and edge cases
- [ ] `CTMS-44-T03` Tự động hết hạn booking - integration and acceptance evidence

## Blocked By
- `CTMS-40`
- `CTMS-43`

## Definition of Done
- [ ] All child task checklists are completed.
- [ ] Unit test checklist in each task is verified.
- [ ] E2E checklist in each task is verified or evidence is attached.
- [ ] Linked blockers are resolved or explicitly waived.
