## User Story
Là Admin, tôi muốn phê duyệt campsite trước khi công khai.

## Metadata
- External ID: `CTMS-16`
- Epic: `ctms-epic-02` / Campsite and Zone Management
- Priority: `Should Have`
- Story points: `5`
- Sprint: `Sprint 2`
- Scope: `stretch`

## Use Case
Phê duyệt campsite trước khi công khai

## Acceptance Criteria
Chỉ campsite có status = pending_approval mới được xét duyệt; duyệt thành công chuyển status = active. Nếu không duyệt, chuyển về draft để Host chỉnh sửa và lưu lý do trong audit_logs/notifications; không sử dụng status rejected vì database không có giá trị này.

## Child Task Checklist
- [ ] `CTMS-16-T01` Phê duyệt campsite trước khi công khai - backend/API and domain rules
- [ ] `CTMS-16-T02` Phê duyệt campsite trước khi công khai - UI flow
- [ ] `CTMS-16-T03` Phê duyệt campsite trước khi công khai - validation and edge cases
- [ ] `CTMS-16-T04` Phê duyệt campsite trước khi công khai - integration and acceptance evidence

## Blocked By
- `CTMS-06`
- `CTMS-10`

## Definition of Done
- [ ] All child task checklists are completed.
- [ ] Unit test checklist in each task is verified.
- [ ] E2E checklist in each task is verified or evidence is attached.
- [ ] Linked blockers are resolved or explicitly waived.
