## User Story
Là System, tôi muốn chặn đăng ký mới khi route ở mức Red.

## Metadata
- External ID: `CTMS-28`
- Epic: `ctms-epic-04` / Weather Risk Assessment
- Priority: `Must Have`
- Story points: `3`
- Sprint: `Sprint 2`
- Scope: `stretch`

## Use Case
Chặn đăng ký mới khi route ở mức Red

## Acceptance Criteria
Không tạo booking mới cho Trip/route có mức Red; hiển thị lý do và thời điểm đánh giá; không tạo Trip Member vì hệ thống sử dụng bookings và booking_members.

## Child Task Checklist
- [ ] `CTMS-28-T01` Chặn đăng ký mới khi route ở mức Red - backend/API and domain rules
- [ ] `CTMS-28-T02` Chặn đăng ký mới khi route ở mức Red - validation and edge cases
- [ ] `CTMS-28-T03` Chặn đăng ký mới khi route ở mức Red - integration and acceptance evidence

## Blocked By
- `CTMS-26`

## Definition of Done
- [ ] All child task checklists are completed.
- [ ] Unit test checklist in each task is verified.
- [ ] E2E checklist in each task is verified or evidence is attached.
- [ ] Linked blockers are resolved or explicitly waived.
