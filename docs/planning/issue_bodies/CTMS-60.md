## User Story
Là Porter, tôi muốn chấp nhận hoặc từ chối lời mời làm việc tại campsite.

## Metadata
- External ID: `CTMS-60`
- Epic: `ctms-epic-08` / Porter Management
- Priority: `Must Have`
- Story points: `3`
- Sprint: `Sprint 3`
- Scope: `committed`

## Use Case
Phản hồi lời mời campsite

## Acceptance Criteria
Porter chỉ phản hồi lời mời của chính mình; chấp nhận chuyển campsite_porters.status = active và ghi joined_at; từ chối hoặc rời campsite chuyển status = removed; tạm nghỉ chuyển status = paused; Host nhận thông báo.

## Child Task Checklist
- [ ] `CTMS-60-T01` Phản hồi lời mời campsite - backend/API and domain rules
- [ ] `CTMS-60-T02` Phản hồi lời mời campsite - UI flow
- [ ] `CTMS-60-T03` Phản hồi lời mời campsite - validation and edge cases
- [ ] `CTMS-60-T04` Phản hồi lời mời campsite - integration and acceptance evidence

## Blocked By
- `CTMS-59`

## Definition of Done
- [ ] All child task checklists are completed.
- [ ] Unit test checklist in each task is verified.
- [ ] E2E checklist in each task is verified or evidence is attached.
- [ ] Linked blockers are resolved or explicitly waived.
