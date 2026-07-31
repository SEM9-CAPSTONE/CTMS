## User Story
Là System, tôi muốn lưu GPS log cục bộ khi mất mạng.

## Metadata
- External ID: `CTMS-80`
- Epic: `ctms-epic-11` / Buffer and Synchronization
- Priority: `Must Have`
- Story points: `8`
- Sprint: `Sprint 4`
- Scope: `committed`

## Use Case
Lưu GPS log cục bộ khi mất mạng

## Acceptance Criteria
GPS log được lưu vào local database; không mất dữ liệu khi đóng hoặc khởi động lại ứng dụng.

## Child Task Checklist
- [ ] `CTMS-80-T01` Lưu GPS log cục bộ khi mất mạng - backend/API and domain rules
- [ ] `CTMS-80-T02` Lưu GPS log cục bộ khi mất mạng - validation and edge cases
- [ ] `CTMS-80-T03` Lưu GPS log cục bộ khi mất mạng - integration and acceptance evidence

## Blocked By
- `CTMS-74`

## Definition of Done
- [ ] All child task checklists are completed.
- [ ] Unit test checklist in each task is verified.
- [ ] E2E checklist in each task is verified or evidence is attached.
- [ ] Linked blockers are resolved or explicitly waived.
