## User Story
Là Admin, tôi muốn phê duyệt và công khai Trip để Camper có thể đặt chỗ.

## Metadata
- External ID: `CTMS-34`
- Epic: `ctms-epic-05` / Trip Management
- Priority: `Must Have`
- Story points: `5`
- Sprint: `Sprint 2`
- Scope: `committed`

## Use Case
Phê duyệt và công khai Trip

## Acceptance Criteria
Chỉ Trip có status = pending_approval và dữ liệu hợp lệ mới được chuyển sang status = published; Trip overnight phải đủ trip_camp_stays. Nếu không duyệt, giữ status = pending_approval để Host chỉnh sửa và lưu lý do trong audit_logs/notifications; nếu Trip bị hủy thì chuyển status = cancelled. Không sử dụng status rejected.

## Child Task Checklist
- [ ] `CTMS-34-T01` Phê duyệt và công khai Trip - backend/API and domain rules
- [ ] `CTMS-34-T02` Phê duyệt và công khai Trip - UI flow
- [ ] `CTMS-34-T03` Phê duyệt và công khai Trip - validation and edge cases
- [ ] `CTMS-34-T04` Phê duyệt và công khai Trip - integration and acceptance evidence

## Blocked By
- `CTMS-06`
- `CTMS-32`
- `CTMS-33`

## Definition of Done
- [ ] All child task checklists are completed.
- [ ] Unit test checklist in each task is verified.
- [ ] E2E checklist in each task is verified or evidence is attached.
- [ ] Linked blockers are resolved or explicitly waived.
