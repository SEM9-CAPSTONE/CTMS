## User Story
Là Host, tôi muốn kiểm tra sức chứa zone theo từng ngày để chọn bãi ngủ phù hợp cho Trip overnight.

## Metadata
- External ID: `CTMS-31`
- Epic: `ctms-epic-05` / Trip Management
- Priority: `Must Have`
- Story points: `8`
- Sprint: `Sprint 2`
- Scope: `committed`

## Use Case
Kiểm tra sức chứa zone theo ngày

## Acceptance Criteria
Không hiển thị zone có status IN (closed, archived) hoặc nằm trong campsite_closures; tính tổng tents_needed và tổng capacity_max của các Trip còn hiệu lực theo zone_id và stay_date; chỉ cho chọn khi không vượt max_tents và max_people.

## Child Task Checklist
- [ ] `CTMS-31-T01` Kiểm tra sức chứa zone theo ngày - backend/API and domain rules
- [ ] `CTMS-31-T02` Kiểm tra sức chứa zone theo ngày - UI flow
- [ ] `CTMS-31-T03` Kiểm tra sức chứa zone theo ngày - validation and edge cases
- [ ] `CTMS-31-T04` Kiểm tra sức chứa zone theo ngày - integration and acceptance evidence

## Blocked By
- `CTMS-12`
- `CTMS-13`
- `CTMS-14`

## Definition of Done
- [ ] All child task checklists are completed.
- [ ] Unit test checklist in each task is verified.
- [ ] E2E checklist in each task is verified or evidence is attached.
- [ ] Linked blockers are resolved or explicitly waived.
