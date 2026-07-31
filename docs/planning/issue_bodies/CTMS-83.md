## User Story
Là System, tôi muốn thử lại khi đồng bộ thất bại.

## Metadata
- External ID: `CTMS-83`
- Epic: `ctms-epic-11` / Buffer and Synchronization
- Priority: `Must Have`
- Story points: `5`
- Sprint: `Sprint 4`
- Scope: `committed`

## Use Case
Thử lại khi đồng bộ thất bại

## Acceptance Criteria
Áp dụng exponential backoff; giới hạn số lần thử; không chặn thao tác của người dùng.

## Child Task Checklist
- [ ] `CTMS-83-T01` Thử lại khi đồng bộ thất bại - backend/API and domain rules
- [ ] `CTMS-83-T02` Thử lại khi đồng bộ thất bại - validation and edge cases
- [ ] `CTMS-83-T03` Thử lại khi đồng bộ thất bại - integration and acceptance evidence

## Blocked By
- `CTMS-81`

## Definition of Done
- [ ] All child task checklists are completed.
- [ ] Unit test checklist in each task is verified.
- [ ] E2E checklist in each task is verified or evidence is attached.
- [ ] Linked blockers are resolved or explicitly waived.
