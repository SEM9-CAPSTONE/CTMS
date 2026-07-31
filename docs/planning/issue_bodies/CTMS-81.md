## User Story
Là System, tôi muốn tự động đồng bộ GPS khi kết nối trở lại.

## Metadata
- External ID: `CTMS-81`
- Epic: `ctms-epic-11` / Buffer and Synchronization
- Priority: `Must Have`
- Story points: `8`
- Sprint: `Sprint 4`
- Scope: `committed`

## Use Case
Tự động đồng bộ GPS khi kết nối trở lại

## Acceptance Criteria
Phát hiện kết nối; gửi dữ liệu theo batch; sync_batches.status và gps_logs.sync_status chỉ sử dụng pending, synced hoặc failed; lỗi không làm mất dữ liệu cục bộ.

## Child Task Checklist
- [ ] `CTMS-81-T01` Tự động đồng bộ GPS khi kết nối trở lại - backend/API and domain rules
- [ ] `CTMS-81-T02` Tự động đồng bộ GPS khi kết nối trở lại - validation and edge cases
- [ ] `CTMS-81-T03` Tự động đồng bộ GPS khi kết nối trở lại - integration and acceptance evidence

## Blocked By
- `CTMS-80`

## Definition of Done
- [ ] All child task checklists are completed.
- [ ] Unit test checklist in each task is verified.
- [ ] E2E checklist in each task is verified or evidence is attached.
- [ ] Linked blockers are resolved or explicitly waived.
