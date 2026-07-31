## User Story
Là Host, tôi muốn ghi nhận bàn giao thiết bị khi check-in.

## Metadata
- External ID: `CTMS-54`
- Epic: `ctms-epic-07` / Equipment and Logistics
- Priority: `Should Have`
- Story points: `3`
- Sprint: `Sprint 3`
- Scope: `stretch`

## Use Case
Ghi nhận bàn giao thiết bị khi check-in

## Acceptance Criteria
Khi bàn giao, cập nhật equipment_reservations.status = picked_up và picked_up_at; nếu gán thiết bị cụ thể thì cập nhật equipment_items.status = in_use. Không chuyển toàn bộ bản ghi loại thiết bị trong bảng equipment sang in_use; lưu người nhận và thời gian bàn giao.

## Child Task Checklist
- [ ] `CTMS-54-T01` Ghi nhận bàn giao thiết bị khi check-in - backend/API and domain rules
- [ ] `CTMS-54-T02` Ghi nhận bàn giao thiết bị khi check-in - UI flow
- [ ] `CTMS-54-T03` Ghi nhận bàn giao thiết bị khi check-in - validation and edge cases
- [ ] `CTMS-54-T04` Ghi nhận bàn giao thiết bị khi check-in - integration and acceptance evidence

## Blocked By
- `CTMS-53`
- `CTMS-48`

## Definition of Done
- [ ] All child task checklists are completed.
- [ ] Unit test checklist in each task is verified.
- [ ] E2E checklist in each task is verified or evidence is attached.
- [ ] Linked blockers are resolved or explicitly waived.
