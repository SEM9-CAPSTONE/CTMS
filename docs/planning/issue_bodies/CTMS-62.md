## User Story
Là Host, tôi muốn phân công Porter cho chuyến trekking.

## Metadata
- External ID: `CTMS-62`
- Epic: `ctms-epic-08` / Porter Management
- Priority: `Must Have`
- Story points: `5`
- Sprint: `Sprint 3`
- Scope: `committed`

## Use Case
Phân công Porter cho chuyến trekking

## Acceptance Criteria
Chỉ phân công Porter có campsite_porters.status = active tại campsite xuất phát của route; Porter lead phải có proficiency IN (proficient, expert); không cho work_range chồng với porter_assignments có status IN (pending, accepted); gửi thông báo để Porter xác nhận hoặc từ chối.

## Child Task Checklist
- [ ] `CTMS-62-T01` Phân công Porter cho chuyến trekking - backend/API and domain rules
- [ ] `CTMS-62-T02` Phân công Porter cho chuyến trekking - UI flow
- [ ] `CTMS-62-T03` Phân công Porter cho chuyến trekking - validation and edge cases
- [ ] `CTMS-62-T04` Phân công Porter cho chuyến trekking - integration and acceptance evidence

## Blocked By
- `CTMS-32`
- `CTMS-58`
- `CTMS-61`

## Definition of Done
- [ ] All child task checklists are completed.
- [ ] Unit test checklist in each task is verified.
- [ ] E2E checklist in each task is verified or evidence is attached.
- [ ] Linked blockers are resolved or explicitly waived.
