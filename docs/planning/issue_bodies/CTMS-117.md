## User Story
Là nhóm nghiên cứu, tôi muốn đo hiệu quả cơ chế khóa và trigger chống vượt sức chứa.

## Metadata
- External ID: `CTMS-117`
- Epic: `ctms-epic-18` / Reports and Evaluation Metrics
- Priority: `Must Have`
- Story points: `8`
- Sprint: `Sprint 5`
- Scope: `committed`

## Use Case
Đánh giá cơ chế chống vượt sức chứa

## Acceptance Criteria
Đo số lần tranh chấp zone, thời gian khóa, transaction conflict, số booking hoặc trip_camp_stays bị từ chối và số trường hợp vượt sức chứa; sử dụng dữ liệu zone_lock_events.

## Child Task Checklist
- [ ] `CTMS-117-T01` Đánh giá cơ chế chống vượt sức chứa - backend/API and domain rules
- [ ] `CTMS-117-T02` Đánh giá cơ chế chống vượt sức chứa - validation and edge cases
- [ ] `CTMS-117-T03` Đánh giá cơ chế chống vượt sức chứa - integration and acceptance evidence

## Blocked By
- `CTMS-33`
- `CTMS-35`

## Definition of Done
- [ ] All child task checklists are completed.
- [ ] Unit test checklist in each task is verified.
- [ ] E2E checklist in each task is verified or evidence is attached.
- [ ] Linked blockers are resolved or explicitly waived.
