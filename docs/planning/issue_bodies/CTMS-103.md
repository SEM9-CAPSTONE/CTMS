## User Story
Là Camper, tôi muốn thấy số chỗ còn lại của Trip được cập nhật theo thời gian thực.

## Metadata
- External ID: `CTMS-103`
- Epic: `ctms-epic-14` / Real-Time Communication
- Priority: `Should Have`
- Story points: `5`
- Sprint: `Sprint 5`
- Scope: `stretch`

## Use Case
Cập nhật số chỗ Trip theo thời gian thực

## Acceptance Criteria
Khi booking có status IN (confirmed, cancelled, expired), frontend nhận seats_taken và số chỗ còn lại mới; không hiển thị Locked/Released theo slot; sự kiện trùng phải được bỏ qua.

## Child Task Checklist
- [ ] `CTMS-103-T01` Cập nhật số chỗ Trip theo thời gian thực - backend/API and domain rules
- [ ] `CTMS-103-T02` Cập nhật số chỗ Trip theo thời gian thực - UI flow
- [ ] `CTMS-103-T03` Cập nhật số chỗ Trip theo thời gian thực - integration and acceptance evidence

## Blocked By
- `CTMS-40`
- `CTMS-35`
- `CTMS-98`

## Definition of Done
- [ ] All child task checklists are completed.
- [ ] Unit test checklist in each task is verified.
- [ ] E2E checklist in each task is verified or evidence is attached.
- [ ] Linked blockers are resolved or explicitly waived.
