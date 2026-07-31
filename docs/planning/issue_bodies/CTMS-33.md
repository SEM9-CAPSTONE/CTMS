## User Story
Là Host, tôi muốn cấu hình bãi ngủ cho từng đêm của Trip overnight.

## Metadata
- External ID: `CTMS-33`
- Epic: `ctms-epic-05` / Trip Management
- Priority: `Must Have`
- Story points: `8`
- Sprint: `Sprint 2`
- Scope: `committed`

## Use Case
Cấu hình đêm nghỉ của Trip

## Acceptance Criteria
Mỗi đêm có night_number, stay_date, zone_id và tents_needed; không trùng night_number hoặc stay_date trong cùng Trip; số dòng bằng duration_nights; Trip có trip_type = day_trip không có trip_camp_stays; sức chứa được kiểm tra theo CTMS-31.

## Child Task Checklist
- [ ] `CTMS-33-T01` Cấu hình đêm nghỉ của Trip - backend/API and domain rules
- [ ] `CTMS-33-T02` Cấu hình đêm nghỉ của Trip - UI flow
- [ ] `CTMS-33-T03` Cấu hình đêm nghỉ của Trip - validation and edge cases
- [ ] `CTMS-33-T04` Cấu hình đêm nghỉ của Trip - integration and acceptance evidence

## Blocked By
- `CTMS-31`
- `CTMS-32`

## Definition of Done
- [ ] All child task checklists are completed.
- [ ] Unit test checklist in each task is verified.
- [ ] E2E checklist in each task is verified or evidence is attached.
- [ ] Linked blockers are resolved or explicitly waived.
