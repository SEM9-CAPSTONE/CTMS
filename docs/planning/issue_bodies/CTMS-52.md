## User Story
Là Host, tôi muốn quản lý danh mục thiết bị để theo dõi tài sản.

## Metadata
- External ID: `CTMS-52`
- Epic: `ctms-epic-07` / Equipment and Logistics
- Priority: `Must Have`
- Story points: `5`
- Sprint: `Sprint 3`
- Scope: `committed`

## Use Case
Quản lý danh mục thiết bị

## Acceptance Criteria
Tạo và sửa danh mục equipment; không dùng xóa mềm vì bảng equipment không có deleted_at. Khi ngừng sử dụng, chuyển equipment.status sang maintenance, lost hoặc retired tùy ngữ cảnh; lưu quantity_total, rental_price_per_day, deposit_amount, storage_location và maintenance_schedule.

## Child Task Checklist
- [ ] `CTMS-52-T01` Quản lý danh mục thiết bị - backend/API and domain rules
- [ ] `CTMS-52-T02` Quản lý danh mục thiết bị - UI flow
- [ ] `CTMS-52-T03` Quản lý danh mục thiết bị - validation and edge cases
- [ ] `CTMS-52-T04` Quản lý danh mục thiết bị - integration and acceptance evidence

## Blocked By
- `CTMS-06`
- `CTMS-10`

## Definition of Done
- [ ] All child task checklists are completed.
- [ ] Unit test checklist in each task is verified.
- [ ] E2E checklist in each task is verified or evidence is attached.
- [ ] Linked blockers are resolved or explicitly waived.
