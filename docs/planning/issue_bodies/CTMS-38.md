## User Story
Là Host, tôi muốn chỉnh sửa Trip trước khi khởi hành để cập nhật lịch trình hoặc thông tin tổ chức.

## Metadata
- External ID: `CTMS-38`
- Epic: `ctms-epic-05` / Trip Management
- Priority: `Must Have`
- Story points: `8`
- Sprint: `Sprint 2`
- Scope: `stretch`

## Use Case
Chỉnh sửa Trip

## Acceptance Criteria
Chỉ Host sở hữu được sửa; starts_at, ends_at, capacity và trip_camp_stays sau khi Trip có status = published phải kiểm tra ảnh hưởng tới booking, Porter, thiết bị và zone; thay đổi quan trọng được ghi audit và gửi thông báo.

## Child Task Checklist
- [ ] `CTMS-38-T01` Chỉnh sửa Trip - backend/API and domain rules
- [ ] `CTMS-38-T02` Chỉnh sửa Trip - UI flow
- [ ] `CTMS-38-T03` Chỉnh sửa Trip - validation and edge cases
- [ ] `CTMS-38-T04` Chỉnh sửa Trip - integration and acceptance evidence

## Blocked By
- `CTMS-32`
- `CTMS-33`

## Definition of Done
- [ ] All child task checklists are completed.
- [ ] Unit test checklist in each task is verified.
- [ ] E2E checklist in each task is verified or evidence is attached.
- [ ] Linked blockers are resolved or explicitly waived.
