## User Story
Là Host hoặc Porter, tôi muốn đánh dấu thành viên không xuất hiện để quản lý danh sách đoàn chính xác.

## Metadata
- External ID: `CTMS-50`
- Epic: `ctms-epic-06` / Booking and Payment
- Priority: `Should Have`
- Story points: `3`
- Sprint: `Sprint 3`
- Scope: `stretch`

## Use Case
Đánh dấu thành viên không xuất hiện

## Acceptance Criteria
Sau thời điểm khởi hành, thành viên có member_status = registered nhưng chưa check-in có thể chuyển member_status = no_show; lưu người thao tác và thời gian; booking không có status no_show vì trạng thái này thuộc từng booking_member.

## Child Task Checklist
- [ ] `CTMS-50-T01` Đánh dấu thành viên không xuất hiện - backend/API and domain rules
- [ ] `CTMS-50-T02` Đánh dấu thành viên không xuất hiện - UI flow
- [ ] `CTMS-50-T03` Đánh dấu thành viên không xuất hiện - integration and acceptance evidence

## Blocked By
- `CTMS-48`

## Definition of Done
- [ ] All child task checklists are completed.
- [ ] Unit test checklist in each task is verified.
- [ ] E2E checklist in each task is verified or evidence is attached.
- [ ] Linked blockers are resolved or explicitly waived.
