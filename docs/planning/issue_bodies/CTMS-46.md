## User Story
Là hệ thống, tôi muốn hoàn tiền khi booking hoặc Trip bị hủy theo chính sách.

## Metadata
- External ID: `CTMS-46`
- Epic: `ctms-epic-06` / Booking and Payment
- Priority: `Must Have`
- Story points: `8`
- Sprint: `Sprint 3`
- Scope: `stretch`

## Use Case
Xử lý hoàn tiền

## Acceptance Criteria
Tạo giao dịch refund gắn với booking; cập nhật bookings.payment_status = refunded hoặc partially_refunded và payments.status = refunded; không hoàn tiền hai lần; lưu transaction_ref.

## Child Task Checklist
- [ ] `CTMS-46-T01` Xử lý hoàn tiền - backend/API and domain rules
- [ ] `CTMS-46-T02` Xử lý hoàn tiền - validation and edge cases
- [ ] `CTMS-46-T03` Xử lý hoàn tiền - integration and acceptance evidence

## Blocked By
- `CTMS-45`
- `CTMS-43`

## Definition of Done
- [ ] All child task checklists are completed.
- [ ] Unit test checklist in each task is verified.
- [ ] E2E checklist in each task is verified or evidence is attached.
- [ ] Linked blockers are resolved or explicitly waived.
