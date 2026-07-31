## User Story
Là Camper, tôi muốn thêm dịch vụ hoặc phụ phí tùy chọn vào booking.

## Metadata
- External ID: `CTMS-51`
- Epic: `ctms-epic-06` / Booking and Payment
- Priority: `Could Have`
- Story points: `3`
- Sprint: `Sprint 3`
- Scope: `stretch`

## Use Case
Thêm dịch vụ vào booking

## Acceptance Criteria
Lưu booking_items với item_type, ref_id, quantity và price; cập nhật surcharge và total_amount; thiết bị thuê không được lưu ở booking_items mà sử dụng equipment_reservations.

## Child Task Checklist
- [ ] `CTMS-51-T01` Thêm dịch vụ vào booking - backend/API and domain rules
- [ ] `CTMS-51-T02` Thêm dịch vụ vào booking - UI flow
- [ ] `CTMS-51-T03` Thêm dịch vụ vào booking - integration and acceptance evidence

## Blocked By
- `CTMS-40`

## Definition of Done
- [ ] All child task checklists are completed.
- [ ] Unit test checklist in each task is verified.
- [ ] E2E checklist in each task is verified or evidence is attached.
- [ ] Linked blockers are resolved or explicitly waived.
