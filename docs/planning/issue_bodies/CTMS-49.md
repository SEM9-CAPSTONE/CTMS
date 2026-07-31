## User Story
Là Host hoặc Porter, tôi muốn ghi nhận thành viên rời chuyến và hoàn tất booking.

## Metadata
- External ID: `CTMS-49`
- Epic: `ctms-epic-06` / Booking and Payment
- Priority: `Should Have`
- Story points: `3`
- Sprint: `Sprint 3`
- Scope: `committed`

## Use Case
Hoàn tất booking

## Acceptance Criteria
Cập nhật booking_members.member_status = left và left_at; booking chỉ chuyển status = completed khi Trip đã kết thúc và các thành viên đã được xử lý; kiểm tra thiết bị thuê đã trả hoặc ghi nhận chưa trả; sau đó cho phép đánh giá.

## Child Task Checklist
- [ ] `CTMS-49-T01` Hoàn tất booking - backend/API and domain rules
- [ ] `CTMS-49-T02` Hoàn tất booking - UI flow
- [ ] `CTMS-49-T03` Hoàn tất booking - validation and edge cases
- [ ] `CTMS-49-T04` Hoàn tất booking - integration and acceptance evidence

## Blocked By
- `CTMS-48`

## Definition of Done
- [ ] All child task checklists are completed.
- [ ] Unit test checklist in each task is verified.
- [ ] E2E checklist in each task is verified or evidence is attached.
- [ ] Linked blockers are resolved or explicitly waived.
