# CTMS-26 - Calculate Weather Risk Score by Multiple Criteria

**Spec Reference**  
/file/spec/ctms-26-calculate-weather-risk-score-by-multiple-criteria.md

**Story Title**  
Calculate Weather Risk Score by Multiple Criteria

**Status**  
To Do

**Story**  
As the system, I want to calculate Weather Risk Score by Multiple Criteria so that the CTMS workflow is completed safely, consistently, and within the correct business scope.

## Acceptance Criteria
- [ ] Risk score is calculated from rules and weights.
- [ ] the result is classified as Green, Yellow, or Red and must be reproducible.

## Business Rules Checklist
- [ ] BR-066: The system must handle API timeouts or missing data.
- [ ] BR-067: The system must calculate the score from rules and weights.
- [ ] BR-068: The system must classify risk as Green, Yellow, or Red.
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
- Priority: `Must Have`; Story points: `8`; Commitment: `Committed`.
- Epic: `EPIC 4. Weather Risk`.
- Sprint: `Sprint 2`; planned window: `2026-08-09` to `2026-08-22`.
- Keep API, UI, database, tests, and Jira references aligned with the exact Spec Reference path above.

## Story-Specific Implementation Tasks
- CTMS-26-T01 [BE / Shared Logic] Implement `Calculate Weather Risk Score by Multiple Criteria` for this task scope and enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-066, BR-067, BR-068, BR-206, BR-207. Ref: /file/spec/ctms-26-calculate-weather-risk-score-by-multiple-criteria.md#backend-preparation-logic-and-tests
- CTMS-26-T02 [UI Web/Mobile/Consumer] Implement `Calculate Weather Risk Score by Multiple Criteria` for this task scope and enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-240, BR-241, BR-242, BR-066, BR-067, BR-068. Ref: /file/spec/ctms-26-calculate-weather-risk-score-by-multiple-criteria.md#ui-and-tests

## Task to Acceptance Criteria Traceability
| Acceptance criterion / BR | Covered by tasks | Evidence expected |
| --- | --- | --- |
| AC1: Risk score is calculated from rules and weights | CTMS-26-T01, CTMS-26-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC2: the result is classified as Green, Yellow, or Red and must be reproducible | CTMS-26-T01, CTMS-26-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| BR-202: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows. | CTMS-26-T01, CTMS-26-T02 | Tests and review evidence must prove this exact rule is enforced: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows. |
| BR-204: Users may only view or change data they own unless their role and business relationship allow access to another user's data. | CTMS-26-T01, CTMS-26-T02 | Tests and review evidence must prove this exact rule is enforced: Users may only view or change data they own unless their role and business relationship allow access to another user's data. |
| BR-205: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing. | CTMS-26-T01, CTMS-26-T02 | Tests and review evidence must prove this exact rule is enforced: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing. |
| BR-230: External-service retries must have limits and backoff; retries must not create duplicate records or transactions. | CTMS-26-T01, CTMS-26-T02 | Tests and review evidence must prove this exact rule is enforced: External-service retries must have limits and backoff; retries must not create duplicate records or transactions. |
| BR-231: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data. | CTMS-26-T01, CTMS-26-T02 | Tests and review evidence must prove this exact rule is enforced: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data. |
| BR-242: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry. | CTMS-26-T01, CTMS-26-T02 | Tests and review evidence must prove this exact rule is enforced: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry. |
| BR-243: Cases with insufficient permission or unmet business conditions must not create any side effect. | CTMS-26-T01 | Tests and review evidence must prove this exact rule is enforced: Cases with insufficient permission or unmet business conditions must not create any side effect. |
| BR-244: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done. | CTMS-26-T01 | Tests and review evidence must prove this exact rule is enforced: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done. |
| BR-066: The system must handle API timeouts or missing data. | CTMS-26-T01, CTMS-26-T02 | Tests and review evidence must prove this exact rule is enforced: The system must handle API timeouts or missing data. |
| BR-067: The system must calculate the score from rules and weights. | CTMS-26-T01, CTMS-26-T02 | Tests and review evidence must prove this exact rule is enforced: The system must calculate the score from rules and weights. |
| BR-068: The system must classify risk as Green, Yellow, or Red. | CTMS-26-T01, CTMS-26-T02 | Tests and review evidence must prove this exact rule is enforced: The system must classify risk as Green, Yellow, or Red. |

## Story-Specific Risks and Edge Cases
- Missing authorization or ownership checks can expose CTMS data across users, roles, trips, campsites, or bookings.
- Concurrent requests, duplicate submissions, stale reads, and retry behavior can create inconsistent state if transactions and idempotency are not handled.
- UI validation must improve the user experience but must never replace backend validation or permission checks.
- State transitions must reject invalid source states and preserve a clear error response for the user or calling service.
- Any mapped BR missing from tests creates a release risk and must be resolved before Done.

## Functional and Domain Requirements
- Implement the `Calculate Weather Risk Score by Multiple Criteria` workflow exactly within `EPIC 4. Weather Risk`.
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

## References
- Story ID: `CTMS-26`
- Epic: `EPIC 4. Weather Risk`
- Sprint: `Sprint 2`
- Dependencies: `CTMS-25`
- Linked items: `Blocked by: CTMS-25

Blocks: CTMS-27, CTMS-28, CTMS-29, CTMS-37, CTMS-56, CTMS-67, CTMS-108, CTMS-120`
- Spec Reference: `/file/spec/ctms-26-calculate-weather-risk-score-by-multiple-criteria.md`
- Business Rules workbook: `C:/Users/admin/Downloads/CTMS_Global_Business_Rules_Sprint_1-3.xlsx`
- Story-level BRs: `BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-066, BR-067, BR-068`

## Backend Preparation Logic and Tests

### Actors
- **Host**: The owner of the Route's Campsite. Can trigger risk calculation and view the latest assessment for their own Route.
- **Admin**: Can trigger risk calculation and view the latest assessment for any Route, bypassing ownership.

### Preconditions
- The Trekking Route must exist and be in `active` status.
- A successful weather snapshot must have been fetched and persisted for the Route (via refresh).
- An active weather risk rule set must be configured in the database (seeding version 1 default rule).
- The actor must hold a valid active session with the role of Host or Admin.

### Decision Gates
- **Scoring Logic**: Risk score is computed using a weighted composite score across five criteria (Rainfall, Wind, Temperature, Visibility, Thunderstorm) using configured rules and weights.
- **Classification**: Score mapped to Green (`score < 0.5`), Yellow (`0.5 <= score < 1.2`), or Red (`score >= 1.2`).
- **Reproducibility**: Calculated scores, input snapshot values, and active rule version are stored in the database so the calculation is fully reproducible (BR-069).
- **Idempotency**: Requests targeting the same snapshot ID and rule version ID return the existing assessment to avoid duplicate writes on retries (BR-230).

### Main Flow (Calculate Risk)
1. Host or Admin triggers `POST /trekking-routes/:routeId/weather/risk-score`.
2. Look up the Route, verify status is active, and assert Host ownership/Admin role.
3. Look up the latest successful weather snapshot for the Route.
4. Retrieve the active weather risk rule version.
5. Check if an assessment already exists for this snapshot and rule. If so, return it (`200`/`201` with same ID).
6. Calculate scores, composite score, and risk level.
7. Save the assessment with details to the database.
8. Return the assessment response (`201`).

### Alternate Flow (Read Latest Assessment)
- `GET /trekking-routes/:routeId/weather/risk-score/latest` returns the latest computed assessment for the Route (`200`, empty body `{}` if none exists).

### Exception Flows
- Route not found -> `404`.
- Host does not own Route -> `403`.
- No successful weather snapshot found -> `409` (Conflict).
- Route is not active -> `409` (Conflict) with zero side effects.
- No active weather rule configured -> `409` (Conflict).
- Unauthorized or session expired -> `401`.
- Invalid Camper role -> `403`.

### API Contract
| Method | Path | Roles | Success | Errors |
| --- | --- | --- | --- | --- |
| `POST` | `/trekking-routes/:routeId/weather/risk-score` | Host (owner), Admin | `201 WeatherRiskAssessmentResponseDto` | `401, 403, 404, 409` |
| `GET` | `/trekking-routes/:routeId/weather/risk-score/latest` | Host (owner), Admin | `200 WeatherRiskAssessmentResponseDto \| null` | `401, 403, 404` |

### Data Mapping
- New table `weather_risk_rules`: stores versioned thresholds, weights, and classification boundaries.
- New table `weather_risk_assessments`: stores immutable calculated assessments, composite scores, and breakdown details.

### Test Evidence
- **Backend Unit Tests**: `pnpm --filter @ctms/api test -- weather` -> 44 passed, covering rule scoring calculations, risk level boundaries, input persistence, and idempotency checks.
- **Backend Integration Tests**: `pnpm --filter @ctms/api test:integration -- weather-risk.integration-spec.ts` -> 9 passed, verifying calculating, caching, and loading flows, Admin bypass, camper blocking, and non-active route side-effect prevention.
- All backend unit tests passed: 335 passed.
- All backend integration tests passed: 194 passed.

## UI and Tests

### Component Layout
- **RouteWeatherRiskPanel**: Renders a dedicated panel immediately below the `RouteWeatherPanel` on the `TrekkingRoutesPage`.
- **States Handled**:
  - **Loading**: Spans a spinner loader `Đang tải đánh giá rủi ro...` during initial fetch.
  - **Empty**: Renders a friendly prompt `Chưa có đánh giá rủi ro cho tuyến này. Vui lòng tính điểm rủi ro.` if no risk assessment exists yet.
  - **Success**: Renders a colored alert/badge based on the `riskLevel` (An toàn / Cảnh báo / Nguy hiểm) and the exact `compositeScore`. It also displays a detailed grid of cards showing the name, actual value, individual risk indicator light, and points/weight for each of the 5 criteria.
  - **Error mapping**: Displays errors when load fails (with a retry button) or when calculation fails (e.g. no successful weather snapshot exists).
- **calculate Action**: A primary action button `Tính điểm rủi ro` to trigger the service score calculation. It is disabled for non-active routes (shows warning text `Chỉ tính được khi tuyến đang Hoạt động`) and handles dedup via in-flight check.

### Custom Hook
- **useWeatherRiskScore**: Encapsulates data fetching and mutation trigger. Manages component states (`assessment`, `isLoading`, `error`, `isCalculating`, `calculateError`) and encapsulates request sequence tracking.

### UI Verification Evidence
- **Unit Tests**:
  - `pnpm --filter @ctms/web test -- useWeatherRiskScore` -> 11 passed, validating loading, custom error messages mapping (401, 403, 404, 409), calculation response mutation, and call deduping.
  - `pnpm --filter @ctms/web test -- RouteWeatherRiskPanel` -> 7 passed, validating rendering loading, empty, and success states, handling error banners, and disabling conditions based on route status.
- **Build Output**: Frontend build compiled successfully (`tsc -b && vite build` exited with code 0).
- **Linter**: Eslint checks passed without errors.


