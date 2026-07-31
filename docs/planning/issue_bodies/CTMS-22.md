## User Story
Là Admin, tôi muốn phê duyệt route trước khi route được sử dụng để tạo Trip.

## Metadata
- External ID: `CTMS-22`
- Epic: `ctms-epic-03` / Trekking Route and Checkpoint Management
- Priority: `Must Have`
- Story points: `5`
- Sprint: `Sprint 2`
- Scope: `stretch`

## Use Case
Phê duyệt route

## Acceptance Criteria
Route có status = draft hoặc pending_approval được kiểm tra dữ liệu hình học, độ khó và checkpoint; duyệt thành công chuyển status = active. Nếu không duyệt, chuyển về draft để Host chỉnh sửa; trường hợp route không được phép hoạt động thì chuyển status = closed. Lý do được lưu trong audit_logs/notifications; không sử dụng status rejected.

## Child Task Checklist
- [ ] `CTMS-22-T01` Phê duyệt route - backend/API and domain rules
- [ ] `CTMS-22-T02` Phê duyệt route - UI flow
- [ ] `CTMS-22-T03` Phê duyệt route - validation and edge cases
- [ ] `CTMS-22-T04` Phê duyệt route - integration and acceptance evidence

## Blocked By
- `CTMS-06`
- `CTMS-19`

## Definition of Done
- [ ] All child task checklists are completed.
- [ ] Unit test checklist in each task is verified.
- [ ] E2E checklist in each task is verified or evidence is attached.
- [ ] Linked blockers are resolved or explicitly waived.
