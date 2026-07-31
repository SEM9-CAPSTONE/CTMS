## User Story
Tạo offline package MVP để Camper xem route/checkpoint khi không có mạng.

## Metadata
- External ID: `CTMS-MVP-67A`
- Epic: `ctms-epic-09` / Offline Package
- Priority: `Must Have`
- Story points: `8`
- Sprint: `Sprint 4`
- Scope: `committed`

## Use Case
Tạo offline package MVP

## Acceptance Criteria
Chỉ tạo cho Trip có status = published; gói gồm route, checkpoint, vùng nguy hiểm, weather snapshot và metadata phiên bản; không chứa danh sách đoàn, dữ liệu y tế, packing list hoặc Porter trong MVP.

## Child Task Checklist
- [ ] `CTMS-MVP-67A-T01` Tạo offline package MVP - backend/API and domain rules
- [ ] `CTMS-MVP-67A-T02` Tạo offline package MVP - UI flow
- [ ] `CTMS-MVP-67A-T03` Tạo offline package MVP - validation and edge cases
- [ ] `CTMS-MVP-67A-T04` Tạo offline package MVP - integration and acceptance evidence

## Blocked By
- `CTMS-20`
- `CTMS-23`
- `CTMS-26`
- `CTMS-34`
- `CTMS-41`

## Definition of Done
- [ ] All child task checklists are completed.
- [ ] Unit test checklist in each task is verified.
- [ ] E2E checklist in each task is verified or evidence is attached.
- [ ] Linked blockers are resolved or explicitly waived.
