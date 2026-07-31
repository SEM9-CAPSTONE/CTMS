## User Story
Là System, tôi muốn thiết lập kết nối WebSocket có xác thực.

## Metadata
- External ID: `CTMS-98`
- Epic: `ctms-epic-14` / Real-Time Communication
- Priority: `Must Have`
- Story points: `8`
- Sprint: `Sprint 5`
- Scope: `committed`

## Use Case
Thiết lập kết nối WebSocket có xác thực

## Acceptance Criteria
Socket kiểm tra JWT; từ chối token sai hoặc hết hạn; người dùng tham gia đúng room.

## Child Task Checklist
- [ ] `CTMS-98-T01` Thiết lập kết nối WebSocket có xác thực - backend/API and domain rules
- [ ] `CTMS-98-T02` Thiết lập kết nối WebSocket có xác thực - validation and edge cases
- [ ] `CTMS-98-T03` Thiết lập kết nối WebSocket có xác thực - integration and acceptance evidence

## Blocked By
- `CTMS-03`

## Definition of Done
- [ ] All child task checklists are completed.
- [ ] Unit test checklist in each task is verified.
- [ ] E2E checklist in each task is verified or evidence is attached.
- [ ] Linked blockers are resolved or explicitly waived.
