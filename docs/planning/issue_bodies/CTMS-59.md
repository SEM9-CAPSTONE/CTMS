## User Story
Là Host, tôi muốn mời Porter tham gia làm việc tại một campsite.

## Metadata
- External ID: `CTMS-59`
- Epic: `ctms-epic-08` / Porter Management
- Priority: `Must Have`
- Story points: `5`
- Sprint: `Sprint 3`
- Scope: `committed`

## Use Case
Mời Porter vào campsite

## Acceptance Criteria
Tạo campsite_porters với status = invited; không tạo trùng cặp campsite_id và porter_id; lưu invited_by và day_rate; Porter nhận thông báo.

## Child Task Checklist
- [ ] `CTMS-59-T01` Mời Porter vào campsite - backend/API and domain rules
- [ ] `CTMS-59-T02` Mời Porter vào campsite - UI flow
- [ ] `CTMS-59-T03` Mời Porter vào campsite - validation and edge cases
- [ ] `CTMS-59-T04` Mời Porter vào campsite - integration and acceptance evidence

## Blocked By
- `CTMS-06`
- `CTMS-10`
- `CTMS-57`

## Definition of Done
- [ ] All child task checklists are completed.
- [ ] Unit test checklist in each task is verified.
- [ ] E2E checklist in each task is verified or evidence is attached.
- [ ] Linked blockers are resolved or explicitly waived.
