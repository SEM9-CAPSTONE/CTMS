## User Story
Là Host, tôi muốn xác nhận mức độ thông thạo route của Porter để phân công an toàn.

## Metadata
- External ID: `CTMS-61`
- Epic: `ctms-epic-08` / Porter Management
- Priority: `Must Have`
- Story points: `5`
- Sprint: `Sprint 3`
- Scope: `committed`

## Use Case
Xác minh năng lực Porter theo route

## Acceptance Criteria
Chỉ Porter có campsite_porters.status = active tại campsite của route mới được gán proficiency; porter_routes.proficiency sử dụng learning, proficient hoặc expert; lưu times_led, verified_by và verified_at; một Porter chỉ có một hồ sơ trên mỗi route.

## Child Task Checklist
- [ ] `CTMS-61-T01` Xác minh năng lực Porter theo route - backend/API and domain rules
- [ ] `CTMS-61-T02` Xác minh năng lực Porter theo route - UI flow
- [ ] `CTMS-61-T03` Xác minh năng lực Porter theo route - validation and edge cases
- [ ] `CTMS-61-T04` Xác minh năng lực Porter theo route - integration and acceptance evidence

## Blocked By
- `CTMS-22`
- `CTMS-60`

## Definition of Done
- [ ] All child task checklists are completed.
- [ ] Unit test checklist in each task is verified.
- [ ] E2E checklist in each task is verified or evidence is attached.
- [ ] Linked blockers are resolved or explicitly waived.
