## User Story
Là Admin, tôi muốn cấu hình bộ trọng số và ngưỡng Weather Risk theo loại route.

## Metadata
- External ID: `CTMS-30`
- Epic: `ctms-epic-04` / Weather Risk Assessment
- Priority: `Should Have`
- Story points: `5`
- Sprint: `Post-defense`
- Scope: `post-defense`

## Use Case
Cấu hình Weather Risk rules

## Acceptance Criteria
Lưu weights, thresholds, version và trạng thái is_active; chỉ một phiên bản phù hợp được sử dụng tại một thời điểm; thay đổi được ghi audit log.

## Child Task Checklist
- [ ] `CTMS-30-T01` Cấu hình Weather Risk rules - backend/API and domain rules
- [ ] `CTMS-30-T02` Cấu hình Weather Risk rules - UI flow
- [ ] `CTMS-30-T03` Cấu hình Weather Risk rules - validation and edge cases
- [ ] `CTMS-30-T04` Cấu hình Weather Risk rules - integration and acceptance evidence

## Blocked By
- `CTMS-06`
- `CTMS-25`

## Definition of Done
- [ ] All child task checklists are completed.
- [ ] Unit test checklist in each task is verified.
- [ ] E2E checklist in each task is verified or evidence is attached.
- [ ] Linked blockers are resolved or explicitly waived.
