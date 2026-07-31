## User Story
Là Admin, tôi muốn xử lý các báo cáo nội dung hoặc dịch vụ do người dùng gửi.

## Metadata
- External ID: `CTMS-127`
- Epic: `ctms-epic-19` / Administration and Audit
- Priority: `Should Have`
- Story points: `5`
- Sprint: `Post-defense`
- Scope: `post-defense`

## Use Case
Xử lý báo cáo nội dung

## Acceptance Criteria
Hiển thị reporter, target_type, target_id, lý do và trạng thái; Admin có thể chuyển Pending sang Reviewing, Actioned hoặc Rejected; mọi thay đổi được ghi audit log.

## Child Task Checklist
- [ ] `CTMS-127-T01` Xử lý báo cáo nội dung - backend/API and domain rules
- [ ] `CTMS-127-T02` Xử lý báo cáo nội dung - UI flow
- [ ] `CTMS-127-T03` Xử lý báo cáo nội dung - validation and edge cases
- [ ] `CTMS-127-T04` Xử lý báo cáo nội dung - integration and acceptance evidence

## Blocked By
- `CTMS-06`
- `CTMS-116`

## Definition of Done
- [ ] All child task checklists are completed.
- [ ] Unit test checklist in each task is verified.
- [ ] E2E checklist in each task is verified or evidence is attached.
- [ ] Linked blockers are resolved or explicitly waived.
