# CTMS-29 - Use LLM to Explain Weather Risk as Clear Advice

**Spec Reference**  
/file/spec/ctms-29-use-llm-to-explain-weather-risk-as-clear-advice.md

**Story Title**  
Use LLM to Explain Weather Risk as Clear Advice

**Status**  
To Do

**Story**  
As a user, I want to use LLM to Explain Weather Risk as Clear Advice so that the CTMS workflow is completed safely, consistently, and within the correct business scope.

## Acceptance Criteria
- [ ] The LLM only explains the input data.
- [ ] it must not modify the risk score.
- [ ] the response includes concrete actions.

## Business Rules Checklist
- [ ] BR-074: Do not create Trip Member records because the system uses bookings and booking_members.
- [ ] BR-075: The LLM may only explain the provided input data.
- [ ] BR-076: The LLM must not change the risk score by itself.
- [ ] BR-202: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows.
- [ ] BR-204: Users may only view or change data they own unless their role and business relationship allow access to another user's data.
- [ ] BR-205: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing.
- [ ] BR-228: Users may disable ordinary notifications, but mandatory safety or emergency alerts cannot be disabled while participating in the related Trip.
- [ ] BR-229: When an external service times out or returns incomplete data, the system must record the error, must not assume success, and must not create unverifiable data.
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
- CTMS-29-T01 [BE / Shared Logic] Implement `Use LLM to Explain Weather Risk as Clear Advice` for this task scope and enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-228, BR-229, BR-074, BR-075, BR-076, BR-206, BR-207. Ref: /file/spec/ctms-29-use-llm-to-explain-weather-risk-as-clear-advice.md#backend-preparation-logic-and-tests
- CTMS-29-T02 [UI Web/Mobile/Consumer] Implement `Use LLM to Explain Weather Risk as Clear Advice` for this task scope and enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-240, BR-241, BR-242, BR-074, BR-075, BR-076. Ref: /file/spec/ctms-29-use-llm-to-explain-weather-risk-as-clear-advice.md#ui-and-tests

## Task to Acceptance Criteria Traceability
| Acceptance criterion / BR | Covered by tasks | Evidence expected |
| --- | --- | --- |
| AC1: The LLM only explains the input data | CTMS-29-T01, CTMS-29-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC2: it must not modify the risk score | CTMS-29-T01, CTMS-29-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC3: the response includes concrete actions | CTMS-29-T01, CTMS-29-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| BR-202: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows. | CTMS-29-T01, CTMS-29-T02 | Tests and review evidence must prove this exact rule is enforced: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows. |
| BR-204: Users may only view or change data they own unless their role and business relationship allow access to another user's data. | CTMS-29-T01, CTMS-29-T02 | Tests and review evidence must prove this exact rule is enforced: Users may only view or change data they own unless their role and business relationship allow access to another user's data. |
| BR-205: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing. | CTMS-29-T01, CTMS-29-T02 | Tests and review evidence must prove this exact rule is enforced: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing. |
| BR-230: External-service retries must have limits and backoff; retries must not create duplicate records or transactions. | CTMS-29-T01, CTMS-29-T02 | Tests and review evidence must prove this exact rule is enforced: External-service retries must have limits and backoff; retries must not create duplicate records or transactions. |
| BR-231: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data. | CTMS-29-T01, CTMS-29-T02 | Tests and review evidence must prove this exact rule is enforced: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data. |
| BR-242: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry. | CTMS-29-T01, CTMS-29-T02 | Tests and review evidence must prove this exact rule is enforced: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry. |
| BR-243: Cases with insufficient permission or unmet business conditions must not create any side effect. | CTMS-29-T01 | Tests and review evidence must prove this exact rule is enforced: Cases with insufficient permission or unmet business conditions must not create any side effect. |
| BR-244: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done. | CTMS-29-T01 | Tests and review evidence must prove this exact rule is enforced: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done. |
| BR-228: Users may disable ordinary notifications, but mandatory safety or emergency alerts cannot be disabled while participating in the related Trip. | CTMS-29-T01 | Tests and review evidence must prove this exact rule is enforced: Users may disable ordinary notifications, but mandatory safety or emergency alerts cannot be disabled while participating in the related Trip. |
| BR-229: When an external service times out or returns incomplete data, the system must record the error, must not assume success, and must not create unverifiable data. | CTMS-29-T01 | Tests and review evidence must prove this exact rule is enforced: When an external service times out or returns incomplete data, the system must record the error, must not assume success, and must not create unverifiable data. |
| BR-074: Do not create Trip Member records because the system uses bookings and booking_members. | CTMS-29-T01, CTMS-29-T02 | Tests and review evidence must prove this exact rule is enforced: Do not create Trip Member records because the system uses bookings and booking_members. |
| BR-075: The LLM may only explain the provided input data. | CTMS-29-T01, CTMS-29-T02 | Tests and review evidence must prove this exact rule is enforced: The LLM may only explain the provided input data. |
| BR-076: The LLM must not change the risk score by itself. | CTMS-29-T01, CTMS-29-T02 | Tests and review evidence must prove this exact rule is enforced: The LLM must not change the risk score by itself. |

## Story-Specific Risks and Edge Cases
- Missing authorization or ownership checks can expose CTMS data across users, roles, trips, campsites, or bookings.
- Concurrent requests, duplicate submissions, stale reads, and retry behavior can create inconsistent state if transactions and idempotency are not handled.
- UI validation must improve the user experience but must never replace backend validation or permission checks.
- State transitions must reject invalid source states and preserve a clear error response for the user or calling service.
- Any mapped BR missing from tests creates a release risk and must be resolved before Done.

## Functional and Domain Requirements
- Implement the `Use LLM to Explain Weather Risk as Clear Advice` workflow exactly within `EPIC 4. Weather Risk`.
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
- **Host**: the owner of the Route's Campsite. Can generate and read weather advice for their own Route.
- **Admin**: can generate and read weather advice for any Route, bypassing ownership.

### Preconditions
- The Route must exist and be `active` (BR-243).
- A weather risk assessment must already exist for the Route -- calculated by CTMS-26-T01's `POST /trekking-routes/:routeId/weather/risk-score`.
- The actor must hold a valid session with the `host` or `admin` role; a Host must additionally own the Route's Campsite.

### Architecture Decision (confirmed with the user before implementation)
- LLM calls are made through the project's own `services/ai` FastAPI microservice (already scaffolded and wired in `docker-compose.yml`/`infra/docker/ai.Dockerfile`, previously non-functional), not directly from `services/api`. `services/api` only ever calls `POST {AI_SERVICE_URL}/weather-advisory` over plain HTTP; the OpenAI API key lives only in the `ai` container's own `OPENAI_API_KEY` environment variable, so `services/api` never sees it -- a clean secret boundary.
- Provider: **OpenAI** (`gpt-4o-mini`), matching the infrastructure already provisioned for this service.
- **Deferred**: no real `OPENAI_API_KEY` was available at implementation time. All real code and all real tests below were written and verified against the real `ai` container -- the container boots, validates its own input/output contract, and correctly returns its own `503` when unconfigured. Only the true, money-costing end-to-end call to the real OpenAI API is deferred pending a real key; this is documented honestly rather than mocked away or silently skipped. Once a key is available, the one test currently asserting the honest 503 (`weather-advice.integration-spec.ts`) should be replaced with a real success assertion.

### BR-074 -- Not Applicable
- BR-074 ("Do not create Trip Member records because the system uses bookings and booking_members") does not apply to this task: the Trip domain does not exist in this codebase (routes/bookings/booking_members only), and weather advice generation creates no Trip-related record of any kind -- only a `weather_advice` row scoped to a `weather_risk_assessments` row.

### BR-076 -- structural enforcement, not just a prompt instruction
- The Python service's own request/response schemas (`services/ai/app/models.py`) are the actual enforcement mechanism: `WeatherAdvisoryResponse` has only `advice: str` and `actions: list[str]` -- there is no field anywhere in the contract capable of carrying a risk level or score back from the LLM, so even a model that tries to smuggle one into its JSON has it silently dropped by Pydantic. Verified directly with `test_br076_a_smuggled_risk_level_in_the_llm_json_is_silently_dropped` in `services/ai/app/test_weather_advisory_service.py`. `WeatherAdviceService` (NestJS) also never recalculates or overwrites `riskLevel`/`compositeScore` -- it only ever reads the existing assessment and persists `adviceText`/`actions`.

### Main Flow (`POST /trekking-routes/:routeId/weather/advice`)
1. Look up the Route; 404 if missing.
2. Ownership check: Host must own the Route's Campsite, or be Admin; else 403.
3. BR-243: Route must be `active`; else 409, with zero side effects (checked before any assessment lookup or provider call).
4. Look up the latest weather risk assessment for the Route; 409 if none exists yet ("calculate a risk score first").
5. Idempotency (BR-230): if a `weather_advice` row already exists for that assessment, return it directly -- the provider is never called again for an already-explained assessment.
6. Otherwise, call the `ai` service with the assessment's own criteria (never recalculated), with up to 3 attempts and `[500ms, 1000ms, 2000ms]` backoff, entirely in-memory (BR-230) -- persisting happens once, only after a successful call.
7. On success: persist `adviceText`/`actions` and return the new row (201).
8. On exhausted retries (BR-229): record the error, persist nothing, return 503 -- never assume success, never create unverifiable data.

### Alternate / Exception Flows
- `GET /trekking-routes/:routeId/weather/advice/latest`: same route/ownership checks (404/403), then returns the latest advice row for the Route or `null` if none exists yet -- no side effects, no provider call.
- 401 without a valid session; 403 for a Camper or a non-owning Host.

### API Contract
| Method & Path | Auth | Success | Errors |
| --- | --- | --- | --- |
| `POST /trekking-routes/:routeId/weather/advice` | Host (owner) or Admin | 201 `WeatherAdviceResponseDto` | 401, 403, 404, 409 (not active / no assessment), 503 (provider unavailable after retries) |
| `GET /trekking-routes/:routeId/weather/advice/latest` | Host (owner) or Admin | 200 `WeatherAdviceResponseDto \| null` | 401, 403, 404 |

### Data Mapping
- `weather_advice` (new table): `id`, `assessment_id` (FK to `weather_risk_assessments`, `ON DELETE CASCADE`, `UNIQUE` -- one advice per assessment), `advice_text`, `actions` (`jsonb` string array), `created_by` (FK to `users`, `ON DELETE RESTRICT`), `created_at`.
- No `risk_level`/`compositeScore`/score column exists on this table at all -- the structural half of BR-076 carried through to persistence, not just the Python service's response schema.

### Test Evidence
- **Python (`services/ai`)**: `test_weather_advisory_service.py` (8) + `test_main.py` (6) = 14 passed, run for real inside the project's own Docker runtime (`docker compose run --rm --no-deps -e OPENAI_API_KEY=<fake> ai python -m pytest app -v`) since no local Python interpreter is available on this machine. Covers the happy path, the BR-076 smuggled-field drop, empty/malformed/network-error responses, missing-key 503, and both FastAPI-level 422s (missing field, invalid enum) with the service never called in either.
- **NestJS unit**: `weather-advice.repository.spec.ts` (5), `http-weather-advice.provider.spec.ts` (6), `weather-advice.service.spec.ts` (13) = 24 passed, added to the existing suite -> `pnpm --filter @ctms/api test` now passes 359 (was 335).
- **NestJS integration** (`weather-advice.integration-spec.ts`, 12 passed, real Postgres + the real `ai` container, no mocking): 404/403/401 paths; 409 for a non-active Route and for a missing assessment, both with zero `weather_advice` rows written; the honest 503-after-retries outcome against the real, unconfigured `ai` container with zero rows persisted (the deferred case, see above); idempotent return of a directly-seeded existing advice row without any provider call, verified through the real API response and a real `SELECT`; Admin ownership bypass on the read path. `pnpm --filter @ctms/api test:integration` -> 206 passed (was 194).
- `pnpm --filter @ctms/api build` and `pnpm --filter @ctms/api lint` both pass clean.

## References
- Story ID: `CTMS-29`
- Epic: `EPIC 4. Weather Risk`
- Sprint: `Sprint 2`
- Dependencies: `CTMS-26`
- Linked items: `Blocked by: CTMS-26

Blocks: None`
- Spec Reference: `/file/spec/ctms-29-use-llm-to-explain-weather-risk-as-clear-advice.md`
- Business Rules workbook: `C:/Users/admin/Downloads/CTMS_Global_Business_Rules_Sprint_1-3.xlsx`
- Story-level BRs: `BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-228, BR-229, BR-074, BR-075, BR-076`
