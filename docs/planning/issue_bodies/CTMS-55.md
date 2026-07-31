## User Story
Là Host, tôi muốn ghi nhận thiết bị hỏng, mất hoặc đã hoàn trả.

## Metadata
- External ID: `CTMS-55`
- Epic: `ctms-epic-07` / Equipment and Logistics
- Priority: `Should Have`
- Story points: `3`
- Sprint: `Sprint 3`
- Scope: `stretch`

## Use Case
Ghi nhận thiết bị hỏng, mất hoặc đã hoàn trả

## Acceptance Criteria
Khi hoàn trả, cập nhật equipment_reservations.status = returned và thiết bị cụ thể về status = available nếu còn tốt; thiết bị hỏng chuyển equipment_items.status = maintenance và tạo equipment_damage_logs; thiết bị mất chuyển status = lost; quá hạn chưa trả chuyển reservation.status = not_returned.

## Child Task Checklist
- [ ] `CTMS-55-T01` Ghi nhận thiết bị hỏng, mất hoặc đã hoàn trả - backend/API and domain rules
- [ ] `CTMS-55-T02` Ghi nhận thiết bị hỏng, mất hoặc đã hoàn trả - UI flow
- [ ] `CTMS-55-T03` Ghi nhận thiết bị hỏng, mất hoặc đã hoàn trả - validation and edge cases
- [ ] `CTMS-55-T04` Ghi nhận thiết bị hỏng, mất hoặc đã hoàn trả - integration and acceptance evidence

## Blocked By
- `CTMS-54`

## Definition of Done
- [ ] All child task checklists are completed.
- [ ] Unit test checklist in each task is verified.
- [ ] E2E checklist in each task is verified or evidence is attached.
- [ ] Linked blockers are resolved or explicitly waived.
