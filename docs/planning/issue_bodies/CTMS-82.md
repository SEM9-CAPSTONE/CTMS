## User Story
Là System, tôi muốn chống gửi trùng GPS log.

## Metadata
- External ID: `CTMS-82`
- Epic: `ctms-epic-11` / Buffer and Synchronization
- Priority: `Must Have`
- Story points: `5`
- Sprint: `Sprint 4`
- Scope: `committed`

## Use Case
Chống gửi trùng GPS log

## Acceptance Criteria
Mỗi log có idempotency key; server bỏ qua log đã nhận; không tạo bản ghi trùng.

## Child Task Checklist
- [ ] `CTMS-82-T01` Chống gửi trùng GPS log - backend/API and domain rules
- [ ] `CTMS-82-T02` Chống gửi trùng GPS log - validation and edge cases
- [ ] `CTMS-82-T03` Chống gửi trùng GPS log - integration and acceptance evidence

## Blocked By
- `CTMS-81`

## Definition of Done
- [ ] All child task checklists are completed.
- [ ] Unit test checklist in each task is verified.
- [ ] E2E checklist in each task is verified or evidence is attached.
- [ ] Linked blockers are resolved or explicitly waived.
