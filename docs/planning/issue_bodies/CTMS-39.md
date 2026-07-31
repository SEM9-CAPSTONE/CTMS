## User Story
Là Host, tôi muốn quản lý hình ảnh của Trip để Camper xem trước chuyến đi.

## Metadata
- External ID: `CTMS-39`
- Epic: `ctms-epic-05` / Trip Management
- Priority: `Should Have`
- Story points: `3`
- Sprint: `Sprint 2`
- Scope: `stretch`

## Use Case
Quản lý hình ảnh Trip

## Acceptance Criteria
Cho phép thêm, xóa và sắp xếp trip_media; mỗi media có URL, loại và thứ tự; chỉ Host sở hữu Trip được cập nhật khi trips.status NOT IN (ongoing, completed).

## Child Task Checklist
- [ ] `CTMS-39-T01` Quản lý hình ảnh Trip - backend/API and domain rules
- [ ] `CTMS-39-T02` Quản lý hình ảnh Trip - UI flow
- [ ] `CTMS-39-T03` Quản lý hình ảnh Trip - integration and acceptance evidence

## Blocked By
- `CTMS-32`

## Definition of Done
- [ ] All child task checklists are completed.
- [ ] Unit test checklist in each task is verified.
- [ ] E2E checklist in each task is verified or evidence is attached.
- [ ] Linked blockers are resolved or explicitly waived.
