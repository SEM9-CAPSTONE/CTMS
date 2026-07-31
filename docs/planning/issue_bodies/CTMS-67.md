## User Story
Là System, tôi muốn tạo offline package cho mỗi chuyến.

## Metadata
- External ID: `CTMS-67`
- Epic: `ctms-epic-09` / Offline Package
- Priority: `Must Have`
- Story points: `8`
- Sprint: `Post-defense`
- Scope: `post-defense`

## Use Case
Tạo offline package cho mỗi chuyến

## Acceptance Criteria
Chỉ tạo offline package cho Trip có status = published. Gói gồm route, checkpoint, vùng nguy hiểm, packing list, weather snapshot và survival knowledge. Nếu gói chứa danh sách đoàn hoặc thông tin y tế/liên hệ khẩn cấp, dữ liệu phải lấy từ booking có status = confirmed và booking_members; Porter lấy từ porter_assignments có status = accepted. Package được tạo phiên bản mới khi dữ liệu nguồn thay đổi.

## Child Task Checklist
- [ ] `CTMS-67-T01` Tạo offline package cho mỗi chuyến - backend/API and domain rules
- [ ] `CTMS-67-T02` Tạo offline package cho mỗi chuyến - UI flow
- [ ] `CTMS-67-T03` Tạo offline package cho mỗi chuyến - validation and edge cases
- [ ] `CTMS-67-T04` Tạo offline package cho mỗi chuyến - integration and acceptance evidence

## Blocked By
- `CTMS-20`
- `CTMS-23`
- `CTMS-26`
- `CTMS-34`
- `CTMS-41`
- `CTMS-43`
- `CTMS-56`
- `CTMS-62`
- `CTMS-66`

## Definition of Done
- [ ] All child task checklists are completed.
- [ ] Unit test checklist in each task is verified.
- [ ] E2E checklist in each task is verified or evidence is attached.
- [ ] Linked blockers are resolved or explicitly waived.
