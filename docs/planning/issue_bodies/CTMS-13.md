## User Story
Là Host, tôi muốn lập lịch đóng toàn campsite hoặc một zone trong một khoảng ngày để ngăn tổ chức chuyến tại khu vực không an toàn.

## Metadata
- External ID: `CTMS-13`
- Epic: `ctms-epic-02` / Campsite and Zone Management
- Priority: `Must Have`
- Story points: `5`
- Sprint: `Sprint 2`
- Scope: `stretch`

## Use Case
Lập lịch đóng campsite hoặc zone

## Acceptance Criteria
Cho phép chọn phạm vi Campsite hoặc Zone, ngày bắt đầu, ngày kết thúc và lý do; ngày bắt đầu không sau ngày kết thúc; Trip và trip_camp_stays giao với khoảng đóng không được công khai hoặc sử dụng.

## Child Task Checklist
- [ ] `CTMS-13-T01` Lập lịch đóng campsite hoặc zone - backend/API and domain rules
- [ ] `CTMS-13-T02` Lập lịch đóng campsite hoặc zone - UI flow
- [ ] `CTMS-13-T03` Lập lịch đóng campsite hoặc zone - validation and edge cases
- [ ] `CTMS-13-T04` Lập lịch đóng campsite hoặc zone - integration and acceptance evidence

## Blocked By
- `CTMS-10`
- `CTMS-12`

## Definition of Done
- [ ] All child task checklists are completed.
- [ ] Unit test checklist in each task is verified.
- [ ] E2E checklist in each task is verified or evidence is attached.
- [ ] Linked blockers are resolved or explicitly waived.
