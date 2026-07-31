## User Story
Là hệ thống, tôi muốn phân quyền theo Camper, Host, Porter và Admin để giới hạn truy cập.

## Metadata
- External ID: `CTMS-06`
- Epic: `ctms-epic-01` / Authentication and User Management
- Priority: `Must Have`
- Story points: `8`
- Sprint: `Sprint 1`
- Scope: `committed`

## Use Case
Phân quyền theo Camper, Host, Porter và Admin

## Acceptance Criteria
API kiểm tra quyền ở backend; người dùng không thể truy cập chức năng ngoài vai trò; thao tác trái phép trả về 403.

## Child Task Checklist
- [ ] `CTMS-06-T01` Phân quyền theo Camper, Host, Porter và Admin - backend/API and domain rules
- [ ] `CTMS-06-T02` Phân quyền theo Camper, Host, Porter và Admin - UI flow
- [ ] `CTMS-06-T03` Phân quyền theo Camper, Host, Porter và Admin - validation and edge cases
- [ ] `CTMS-06-T04` Phân quyền theo Camper, Host, Porter và Admin - integration and acceptance evidence

## Blocked By
- `CTMS-03`

## Definition of Done
- [ ] All child task checklists are completed.
- [ ] Unit test checklist in each task is verified.
- [ ] E2E checklist in each task is verified or evidence is attached.
- [ ] Linked blockers are resolved or explicitly waived.
