# CTMS-27 - Explain Risk Level Reasons

**Spec Reference**  
/file/spec/ctms-27-explain-risk-level-reasons.md

**Story Title**  
Explain Risk Level Reasons

**Status**  
To Do

**Story**  
As a user, I want to explain Risk Level Reasons so that the CTMS workflow is completed safely, consistently, and within the correct business scope.

## Acceptance Criteria
- [ ] Show which criteria exceeded thresholds.
- [ ] do not show only a color or total score.

## Business Rules Checklist
- [ ] BR-069: Results must be reproducible.
- [ ] BR-070: The system must display the criteria that exceeded thresholds.
- [ ] BR-202: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows.
- [ ] BR-204: Users may only view or change data they own unless their role and business relationship allow access to another user's data.
- [ ] BR-205: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing.
- [ ] BR-230: External-service retries must have limits and backoff; retries must not create duplicate records or transactions.
- [ ] BR-231: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data.
- [ ] BR-242: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry.
- [ ] BR-243: Cases with insufficient permission or unmet business conditions must not create any side effect.
- [ ] BR-244: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done.

## Dev Notes
- Jira status on 2026-08-04: `To Do`.
- Priority: `Must Have`; Story points: `3`; Commitment: `Committed`.
- Epic: `EPIC 4. Weather Risk`.
- Sprint: `Sprint 2`; planned window: `2026-08-09` to `2026-08-22`.
- Keep API, UI, database, tests, and Jira references aligned with the exact Spec Reference path above.

## Story-Specific Implementation Tasks
- CTMS-27-T01 [BE / Shared Logic] Implement `Explain Risk Level Reasons` for this task scope and enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-069, BR-070, BR-206, BR-207. Ref: /file/spec/ctms-27-explain-risk-level-reasons.md#backend-preparation-logic-and-tests
- CTMS-27-T02 [UI Web/Mobile/Consumer] Implement `Explain Risk Level Reasons` for this task scope and enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-240, BR-241, BR-242, BR-069, BR-070. Ref: /file/spec/ctms-27-explain-risk-level-reasons.md#ui-and-tests

## Task to Acceptance Criteria Traceability
| Acceptance criterion / BR | Covered by tasks | Evidence expected |
| --- | --- | --- |
| AC1: Show which criteria exceeded thresholds | CTMS-27-T01, CTMS-27-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC2: do not show only a color or total score | CTMS-27-T01, CTMS-27-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| BR-202: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows. | CTMS-27-T01, CTMS-27-T02 | Tests and review evidence must prove this exact rule is enforced: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows. |
| BR-204: Users may only view or change data they own unless their role and business relationship allow access to another user's data. | CTMS-27-T01, CTMS-27-T02 | Tests and review evidence must prove this exact rule is enforced: Users may only view or change data they own unless their role and business relationship allow access to another user's data. |
| BR-205: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing. | CTMS-27-T01, CTMS-27-T02 | Tests and review evidence must prove this exact rule is enforced: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing. |
| BR-230: External-service retries must have limits and backoff; retries must not create duplicate records or transactions. | CTMS-27-T01, CTMS-27-T02 | Tests and review evidence must prove this exact rule is enforced: External-service retries must have limits and backoff; retries must not create duplicate records or transactions. |
| BR-231: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data. | CTMS-27-T01, CTMS-27-T02 | Tests and review evidence must prove this exact rule is enforced: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data. |
| BR-242: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry. | CTMS-27-T01, CTMS-27-T02 | Tests and review evidence must prove this exact rule is enforced: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry. |
| BR-243: Cases with insufficient permission or unmet business conditions must not create any side effect. | CTMS-27-T01 | Tests and review evidence must prove this exact rule is enforced: Cases with insufficient permission or unmet business conditions must not create any side effect. |
| BR-244: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done. | CTMS-27-T01 | Tests and review evidence must prove this exact rule is enforced: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done. |
| BR-069: Results must be reproducible. | CTMS-27-T01, CTMS-27-T02 | Tests and review evidence must prove this exact rule is enforced: Results must be reproducible. |
| BR-070: The system must display the criteria that exceeded thresholds. | CTMS-27-T01, CTMS-27-T02 | Tests and review evidence must prove this exact rule is enforced: The system must display the criteria that exceeded thresholds. |

## Story-Specific Risks and Edge Cases
- Missing authorization or ownership checks can expose CTMS data across users, roles, trips, campsites, or bookings.
- Concurrent requests, duplicate submissions, stale reads, and retry behavior can create inconsistent state if transactions and idempotency are not handled.
- UI validation must improve the user experience but must never replace backend validation or permission checks.
- State transitions must reject invalid source states and preserve a clear error response for the user or calling service.
- Any mapped BR missing from tests creates a release risk and must be resolved before Done.

## Functional and Domain Requirements
- Implement the `Explain Risk Level Reasons` workflow exactly within `EPIC 4. Weather Risk`.
- Enforce role-based access before executing any domain action.
- Validate all required fields, enum values, date ranges, ownership boundaries, and cross-entity references before writing data.
- Return consistent API errors: 401 for authentication failures, 403 for authorization failures, 404 for missing resources, 409 for business conflicts, and 422 for invalid input.

## Data and Persistence Requirements
- Persist only validated data and keep all foreign-key relationships scoped to existing, authorized CTMS records.
- Use transactions for multi-record updates, capacity checks, payments, booking changes, equipment changes, synchronization, or any workflow with side effects.
- Store timestamps in a consistent server-side format and preserve source timestamps when client-side events are synchronized later.
- Avoid hard deletes unless the related database model and business rule explicitly allow them.

## State and Audit Requirements
- Validate the current state before every transition and reject transitions that are not explicitly allowed.
- Record important create, update, approval, cancellation, payment, synchronization, administrative, and safety-related actions in audit logs.
- Capture actor, target type, target id, before value, after value, timestamp, and reason whenever those fields apply.
- Notify affected users when the workflow changes booking, trip, route, campsite, Porter, SOS, emergency, or administrative state.

## File Structure Notes
- Backend: place controllers, DTOs, services, repositories, guards, and tests in the module that owns the domain entity.
- Frontend: place screens, components, hooks, API clients, schemas, and tests in the feature folder that owns the workflow.
- Shared constants, enums, query keys, and validation schemas should be centralized only when reused by more than one feature.
- Keep migration, seed, and fixture changes close to the persistence model they support.

## Implementation Guidance for the Dev Agent
- Start by reading the existing module patterns before adding new files or abstractions.
- Keep the implementation narrow to this story and reuse existing CTMS helpers for auth, validation, transactions, i18n, API errors, and tests.
- Build backend behavior first when the UI depends on an API contract, then wire the frontend to the typed contract.
- Do not mark the story Done until mapped ACs, business rules, audit behavior, and regression tests are all covered.

## Testing Requirements
- Add unit tests for domain validation, permission checks, state transitions, and mapped business rule violations.
- Add API or integration tests for success, invalid input, unauthorized access, missing resource, conflict, and rollback cases.
- Add UI/component tests for rendering, validation messages, disabled states, loading states, error handling, and successful submission where UI exists.
- Add E2E coverage for the primary user journey and at least one critical failure path.
- Every BR listed in the Business Rules Checklist must appear in at least one test or review evidence item.

## Backend Preparation Logic and Tests

### Actors
- **Host**: the owner of the Route's Campsite. Can view the latest risk assessment for their own Route.
- **Admin**: can view the latest risk assessment for any Route, bypassing ownership.

### Preconditions
- A weather risk assessment must already exist for the Route -- calculated by `CTMS-26-T01`'s `POST /trekking-routes/:routeId/weather/risk-score`.
- The actor must hold a valid session with the `host` or `admin` role; a Host must additionally own the Route's Campsite.

### Decision Gate: no new backend logic, no new endpoint
- **This story is already fully implemented by CTMS-26-T01's own API contract and data model.** Verified directly against the real code (not assumed from the Jira description alone) before writing anything: `WeatherRiskAssessment.criteriaScores` stores, for each of the 5 criteria (rainfall, wind, temperature, visibility, thunderstorm), the actual `value`, a per-criterion `level` (`green`/`yellow`/`red` -- literally the result of comparing `value` against that criterion's own Yellow/Red threshold in `weather-risk.service.ts`'s `scoreRainfall`/`scoreWind`/etc.), `weight`, and `score`. `GET /trekking-routes/:routeId/weather/risk-score/latest` (CTMS-26-T01) already returns this full breakdown, not just `riskLevel`/`compositeScore`.
- AC1 ("Show which criteria exceeded thresholds") and AC2 ("do not show only a color or total score") are satisfied by this existing response shape: a criterion at `yellow`/`red` is, by construction, a criterion that exceeded a configured threshold; `green` is one that didn't.
- BR-069 (reproducible) and BR-070 (display the criteria that exceeded thresholds) are therefore already covered by CTMS-26-T01's own persistence (`criteriaScores` stored immutably alongside `snapshotId`/`ruleVersionId`) and tests.
- **No new migration, entity, repository, service, or controller was added for CTMS-27-T01.** Adding a second, parallel endpoint or a duplicate `exceededThreshold` boolean column would only create two sources of truth for the same fact this table already answers.

### A real, pre-existing bug found and fixed while verifying this (not invented, not hidden)
- The backend could not start at all after CTMS-26 was merged: `weather-risk.service.ts` used `import type` for `WeatherRiskRepository` and `WeatherSnapshotsRepository`, both constructor-injected. TypeScript erases a type-only import before `emitDecoratorMetadata` runs, so NestJS saw `Function` instead of the real class at both parameter positions and threw `Nest can't resolve dependencies of the WeatherRiskService (?, Function)` on every boot. Fixed by making both real imports (matching this same codebase's own established convention elsewhere: `// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime`). Confirmed by a real `nest start --watch` boot succeeding afterward, and the full existing backend unit (335) and integration (194) suites still passing unchanged.

### Test Evidence
- No new backend unit/integration tests were added for CTMS-27-T01's own logic, because there is no new logic -- BR-069/BR-070 traceability is carried entirely by CTMS-26-T01's existing `weather-risk.service.spec.ts` (44 passed) and `weather-risk.integration-spec.ts` (part of the 194 passing integration tests), which already assert the exact `criteriaScores` shape and its reproducibility (idempotent return on a repeat call for the same snapshot/rule version).
- Regression evidence after the DI fix: `pnpm --filter @ctms/api test` -> 335 passed. `pnpm --filter @ctms/api test:integration` -> 194 passed. `pnpm --filter @ctms/api lint` -> passed. `pnpm --filter @ctms/api build` -> passed. A real `nest start --watch` boot was confirmed against real Postgres (previously impossible due to the DI bug above).

## UI and Tests

### Web UI Implementation
- **Also already implemented, by CTMS-26-T02.** `RouteWeatherRiskPanel.tsx` (on `TrekkingRoutesPage`, below `RouteWeatherPanel`) renders the risk level badge and composite score, **and** a dedicated grid of 5 cards -- one per criterion -- each showing its label, actual value, a colored dot (green/yellow/red, i.e. exceeded-or-not), score, and weight. This already satisfies CTMS-27-T02's own Implementation Checklist (screens/states/error-mapping/permission-gating/dedup) verified directly against the component before writing anything new for this story.
- Web only, mirroring CTMS-25-T02: Mobile has no counterpart (Host/Admin-only feature; the mobile app manages nothing for Host/Admin, per its own router comment).

### CTMS-27-T02 Test Evidence
- Unit/component: no new tests added, because the screens/hooks are CTMS-26-T02's own -- `useWeatherRiskScore.test.ts` (11) and `RouteWeatherRiskPanel.test.tsx` (7), 18 passed, re-run and confirmed still passing unchanged.
- **E2E (the one real gap this story closes)**: `apps/web/tests/e2e/ctms-27-t02-route-weather-risk.spec.ts` -- 3 passed, real backend/Postgres/Chrome and a real call to the live Open-Meteo API, no mocking:
  - Happy path: refresh weather (real Open-Meteo call), calculate risk, see the level badge, composite score, and all 5 criteria cards rendered; confirmed the real `weather_risk_assessments` row via a new `db-helper.ts` action (`get-weather-risk-assessments`), and that its `criteriaScores` carries all 5 criteria.
  - Conflict flow: calculating on an active Route with no successful weather snapshot yet shows the mapped 409 message and creates zero assessment rows (BR-243).
  - Unauthorized flow: a Camper's direct API call returns 403 and creates zero assessment rows; the Host's own row from the happy path is confirmed unchanged.
- `pnpm --filter @ctms/web lint`/`build` were not re-run in this pass since no `apps/web/src` file changed for this story (only the E2E spec was added); both were already confirmed passing as part of CTMS-26-T02's and CTMS-25-T02's own evidence.

## References
- Story ID: `CTMS-27`
- Epic: `EPIC 4. Weather Risk`
- Sprint: `Sprint 2`
- Dependencies: `CTMS-26`
- Linked items: `Blocked by: CTMS-26

Blocks: None`
- Spec Reference: `/file/spec/ctms-27-explain-risk-level-reasons.md`
- Business Rules workbook: `C:/Users/admin/Downloads/CTMS_Global_Business_Rules_Sprint_1-3.xlsx`
- Story-level BRs: `BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-069, BR-070`
