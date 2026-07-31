## User Story
Là Camper, tôi muốn tìm kiếm và xem chi tiết các Trip đã công khai để lựa chọn chuyến phù hợp.

## Metadata
- External ID: `CTMS-36`
- Epic: `ctms-epic-05` / Trip Management
- Priority: `Must Have`
- Story points: `8`
- Sprint: `Sprint 2`
- Scope: `committed`

## Use Case
Tìm kiếm và xem chi tiết Trip

## Acceptance Criteria
Chỉ hiển thị Trip có status = published; hỗ trợ lọc theo thời gian, trip_type, độ khó, giá và route; hiển thị starts_at, ends_at, meeting_point, giá, số chỗ còn lại, includes/excludes và mức rủi ro gần nhất.

## Child Task Checklist
- [ ] `CTMS-36-T01` Tìm kiếm và xem chi tiết Trip - backend/API and domain rules
- [ ] `CTMS-36-T02` Tìm kiếm và xem chi tiết Trip - UI flow
- [ ] `CTMS-36-T03` Tìm kiếm và xem chi tiết Trip - validation and edge cases
- [ ] `CTMS-36-T04` Tìm kiếm và xem chi tiết Trip - integration and acceptance evidence

## Blocked By
- `CTMS-34`
- `CTMS-24`

## Definition of Done
- [ ] All child task checklists are completed.
- [ ] Unit test checklist in each task is verified.
- [ ] E2E checklist in each task is verified or evidence is attached.
- [ ] Linked blockers are resolved or explicitly waived.
