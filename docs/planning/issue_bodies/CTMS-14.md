## User Story
Là Host, tôi muốn cập nhật trạng thái zone khi bãi cắm đóng, mở lại hoặc ngừng sử dụng.

## Metadata
- External ID: `CTMS-14`
- Epic: `ctms-epic-02` / Campsite and Zone Management
- Priority: `Must Have`
- Story points: `3`
- Sprint: `Sprint 2`
- Scope: `stretch`

## Use Case
Cập nhật trạng thái zone

## Acceptance Criteria
Zone sử dụng đúng enum zone_status: active, closed, archived; zone có status khác active không được chọn cho đêm nghỉ mới; các Trip đang bị ảnh hưởng phải được cảnh báo để xử lý.

## Child Task Checklist
- [ ] `CTMS-14-T01` Cập nhật trạng thái zone - backend/API and domain rules
- [ ] `CTMS-14-T02` Cập nhật trạng thái zone - UI flow
- [ ] `CTMS-14-T03` Cập nhật trạng thái zone - validation and edge cases
- [ ] `CTMS-14-T04` Cập nhật trạng thái zone - integration and acceptance evidence

## Blocked By
- `CTMS-12`

## Definition of Done
- [ ] All child task checklists are completed.
- [ ] Unit test checklist in each task is verified.
- [ ] E2E checklist in each task is verified or evidence is attached.
- [ ] Linked blockers are resolved or explicitly waived.
