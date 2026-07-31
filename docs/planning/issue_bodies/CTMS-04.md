## User Story
Là người dùng, tôi muốn làm mới phiên đăng nhập để không phải đăng nhập lại thường xuyên.

## Metadata
- External ID: `CTMS-04`
- Epic: `ctms-epic-01` / Authentication and User Management
- Priority: `Must Have`
- Story points: `3`
- Sprint: `Sprint 1`
- Scope: `committed`

## Use Case
Làm mới phiên đăng nhập

## Acceptance Criteria
Refresh token hợp lệ tạo access token mới; token hết hạn hoặc bị thu hồi phải bị từ chối.

## Child Task Checklist
- [ ] `CTMS-04-T01` Làm mới phiên đăng nhập - backend/API and domain rules
- [ ] `CTMS-04-T02` Làm mới phiên đăng nhập - validation and edge cases
- [ ] `CTMS-04-T03` Làm mới phiên đăng nhập - integration and acceptance evidence

## Blocked By
- `CTMS-03`

## Definition of Done
- [ ] All child task checklists are completed.
- [ ] Unit test checklist in each task is verified.
- [ ] E2E checklist in each task is verified or evidence is attached.
- [ ] Linked blockers are resolved or explicitly waived.
