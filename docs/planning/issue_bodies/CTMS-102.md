## User Story
Là System, tôi muốn tự động reconnect khi WebSocket bị ngắt.

## Metadata
- External ID: `CTMS-102`
- Epic: `ctms-epic-14` / Real-Time Communication
- Priority: `Must Have`
- Story points: `5`
- Sprint: `Sprint 5`
- Scope: `stretch`

## Use Case
Tự động reconnect khi WebSocket bị ngắt

## Acceptance Criteria
Tự kết nối lại; dùng backoff; khôi phục room; lấy sự kiện bị bỏ lỡ.

## Child Task Checklist
- [ ] `CTMS-102-T01` Tự động reconnect khi WebSocket bị ngắt - backend/API and domain rules
- [ ] `CTMS-102-T02` Tự động reconnect khi WebSocket bị ngắt - validation and edge cases
- [ ] `CTMS-102-T03` Tự động reconnect khi WebSocket bị ngắt - integration and acceptance evidence

## Blocked By
- `CTMS-98`

## Definition of Done
- [ ] All child task checklists are completed.
- [ ] Unit test checklist in each task is verified.
- [ ] E2E checklist in each task is verified or evidence is attached.
- [ ] Linked blockers are resolved or explicitly waived.
