## User Story
Là Host, tôi muốn tạo Trip từ một trekking route để mở một chuyến khởi hành cụ thể.

## Metadata
- External ID: `CTMS-32`
- Epic: `ctms-epic-05` / Trip Management
- Priority: `Must Have`
- Story points: `8`
- Sprint: `Sprint 2`
- Scope: `committed`

## Use Case
Tạo Trip

## Acceptance Criteria
Trip có route, tiêu đề, trip_type = day_trip hoặc overnight, thời gian bắt đầu/kết thúc, điểm tập trung, hạn booking, sức chứa tối thiểu/tối đa và giá; starts_at < ends_at; Trip mới có status = pending_approval.

## Child Task Checklist
- [ ] `CTMS-32-T01` Tạo Trip - backend/API and domain rules
- [ ] `CTMS-32-T02` Tạo Trip - UI flow
- [ ] `CTMS-32-T03` Tạo Trip - validation and edge cases
- [ ] `CTMS-32-T04` Tạo Trip - integration and acceptance evidence

## Blocked By
- `CTMS-19`

## Definition of Done
- [ ] All child task checklists are completed.
- [ ] Unit test checklist in each task is verified.
- [ ] E2E checklist in each task is verified or evidence is attached.
- [ ] Linked blockers are resolved or explicitly waived.
