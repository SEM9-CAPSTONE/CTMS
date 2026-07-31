## User Story
Là hệ thống, tôi muốn ngăn booking và cấu hình đêm nghỉ làm vượt sức chứa Trip hoặc zone.

## Metadata
- External ID: `CTMS-35`
- Epic: `ctms-epic-05` / Trip Management
- Priority: `Must Have`
- Story points: `8`
- Sprint: `Sprint 2`
- Scope: `committed`

## Use Case
Ngăn vượt sức chứa Trip và zone

## Acceptance Criteria
Tạo hoặc xác nhận booking được thực hiện trong transaction; khóa theo trip_id khi cập nhật seats_taken; khóa theo zone_id khi kiểm tra trip_camp_stays; tổng người không vượt capacity_max hoặc max_people và tổng lều không vượt max_tents; giao dịch xung đột phải rollback.

## Child Task Checklist
- [ ] `CTMS-35-T01` Ngăn vượt sức chứa Trip và zone - backend/API and domain rules
- [ ] `CTMS-35-T02` Ngăn vượt sức chứa Trip và zone - validation and edge cases
- [ ] `CTMS-35-T03` Ngăn vượt sức chứa Trip và zone - integration and acceptance evidence

## Blocked By
- `CTMS-32`
- `CTMS-33`

## Definition of Done
- [ ] All child task checklists are completed.
- [ ] Unit test checklist in each task is verified.
- [ ] E2E checklist in each task is verified or evidence is attached.
- [ ] Linked blockers are resolved or explicitly waived.
