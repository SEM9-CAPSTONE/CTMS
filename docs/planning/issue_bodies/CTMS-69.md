## User Story
Là người dùng, tôi muốn hệ thống kiểm tra tính toàn vẹn của offline package.

## Metadata
- External ID: `CTMS-69`
- Epic: `ctms-epic-09` / Offline Package
- Priority: `Must Have`
- Story points: `5`
- Sprint: `Sprint 4`
- Scope: `committed`

## Use Case
Hệ thống kiểm tra tính toàn vẹn của offline package

## Acceptance Criteria
Kiểm tra checksum; package không hợp lệ chuyển offline_packages.status = failed; cho phép tải lại; không sử dụng status corrupted vì enum offline_package_status không có giá trị này.

## Child Task Checklist
- [ ] `CTMS-69-T01` Hệ thống kiểm tra tính toàn vẹn của offline package - backend/API and domain rules
- [ ] `CTMS-69-T02` Hệ thống kiểm tra tính toàn vẹn của offline package - validation and edge cases
- [ ] `CTMS-69-T03` Hệ thống kiểm tra tính toàn vẹn của offline package - integration and acceptance evidence

## Blocked By
- `CTMS-68`

## Definition of Done
- [ ] All child task checklists are completed.
- [ ] Unit test checklist in each task is verified.
- [ ] E2E checklist in each task is verified or evidence is attached.
- [ ] Linked blockers are resolved or explicitly waived.
