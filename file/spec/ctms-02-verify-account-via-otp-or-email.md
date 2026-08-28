# CTMS-02 - Verify Account via OTP or Email

**Spec Reference**  
/file/spec/ctms-02-verify-account-via-otp-or-email.md

**Story Title**  
Verify Account via OTP or Email

**Status**  
In Progress

**Story**  
As a user, I want to verify Account via OTP or Email so that the CTMS workflow is completed safely, consistently, and within the correct business scope.

## Acceptance Criteria
- [ ] OTP must expire.
- [ ] resend attempts must be limited.
- [ ] accounts cannot be activated with an incorrect or expired OTP.

## Business Rules Checklist
- [ ] BR-005: An account may only be created when all registration data is valid.
- [ ] BR-006: Account verification OTPs must expire according to system configuration.
- [ ] BR-007: OTP resend attempts must be limited according to system configuration.
- [ ] BR-200: Every change must be written to the audit log.
- [ ] BR-201: Every function requiring authentication may only be performed when the user has a valid login session and the account is active.
- [ ] BR-202: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows.
- [ ] BR-204: Users may only view or change data they own unless their role and business relationship allow access to another user's data.
- [ ] BR-205: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing.
- [ ] BR-214: Every data relationship must reference an existing and valid record; child records must not be created for resources outside the correct business scope.
- [ ] BR-215: Emails must be normalized before comparison and storage; phone numbers must be normalized to a consistent format, preferably E.164.
- [ ] BR-220: A valid time range must have a start time earlier than the end time, unless the business rule explicitly allows equality.
- [ ] BR-230: External-service retries must have limits and backoff; retries must not create duplicate records or transactions.
- [ ] BR-231: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data.
- [ ] BR-236: Users may only add, delete, or reorder media for resources they own or are authorized to manage.
- [ ] BR-237: Background jobs must re-check business conditions at execution time and must not rely only on stale state.
- [ ] BR-242: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry.
- [ ] BR-243: Cases with insufficient permission or unmet business conditions must not create any side effect.
- [ ] BR-244: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done.

## Dev Notes
- Jira status on 2026-08-04: `In Progress`.
- Priority: `Must Have`; Story points: `5`; Commitment: `Committed`.
- Epic: `EPIC 1. Authentication`.
- Sprint: `Sprint 1`; planned window: `2026-07-26` to `2026-08-08`.
- Keep API, UI, database, tests, and Jira references aligned with the exact Spec Reference path above.

## Story-Specific Implementation Tasks
- CTMS-02-T01 [BE / Shared Logic] Implement `Verify Account via OTP or Email` for this task scope and enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-200, BR-201, BR-214, BR-215, BR-220, BR-236, BR-237, BR-005, BR-006, BR-007, BR-206, BR-207. Ref: /file/spec/ctms-02-verify-account-via-otp-or-email.md#backend-preparation-logic-and-tests
- CTMS-02-T02 [UI Web/Mobile/Consumer] Implement `Verify Account via OTP or Email` for this task scope and enforce mapped BRs: BR-202, BR-204, BR-205, BR-230, BR-231, BR-240, BR-241, BR-242, BR-005, BR-006, BR-007. Ref: /file/spec/ctms-02-verify-account-via-otp-or-email.md#ui-and-tests

## Task to Acceptance Criteria Traceability
| Acceptance criterion / BR | Covered by tasks | Evidence expected |
| --- | --- | --- |
| AC1: OTP must expire | CTMS-02-T01, CTMS-02-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC2: resend attempts must be limited | CTMS-02-T01, CTMS-02-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC3: accounts cannot be activated with an incorrect or expired OTP | CTMS-02-T01, CTMS-02-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| BR-202: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows. | CTMS-02-T01, CTMS-02-T02 | Tests and review evidence must prove this exact rule is enforced: Accounts in pending_verification, suspended, or deleted status must not use functions that require an active account, except allowed verification or recovery flows. |
| BR-204: Users may only view or change data they own unless their role and business relationship allow access to another user's data. | CTMS-02-T01, CTMS-02-T02 | Tests and review evidence must prove this exact rule is enforced: Users may only view or change data they own unless their role and business relationship allow access to another user's data. |
| BR-205: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing. | CTMS-02-T01, CTMS-02-T02 | Tests and review evidence must prove this exact rule is enforced: All input data must be validated for required fields, data type, format, length, enum values, and cross-field relationships before processing. |
| BR-230: External-service retries must have limits and backoff; retries must not create duplicate records or transactions. | CTMS-02-T01, CTMS-02-T02 | Tests and review evidence must prove this exact rule is enforced: External-service retries must have limits and backoff; retries must not create duplicate records or transactions. |
| BR-231: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data. | CTMS-02-T01, CTMS-02-T02 | Tests and review evidence must prove this exact rule is enforced: APIs must return consistent error codes: 401 for authentication failure, 403 for insufficient permission, 404 for not found, 409 for business conflict, and 422 for invalid data. |
| BR-242: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry. | CTMS-02-T01, CTMS-02-T02 | Tests and review evidence must prove this exact rule is enforced: When the backend rejects a request because data changed concurrently, the UI must preserve entered data, display the reason, and allow reload or retry. |
| BR-243: Cases with insufficient permission or unmet business conditions must not create any side effect. | CTMS-02-T01 | Tests and review evidence must prove this exact rule is enforced: Cases with insufficient permission or unmet business conditions must not create any side effect. |
| BR-244: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done. | CTMS-02-T01 | Tests and review evidence must prove this exact rule is enforced: Changes to Business Rules, enums, state transitions, or API contracts must update the Spec, test cases, and data documentation together before Done. |
| BR-200: Every change must be written to the audit log. | CTMS-02-T01 | Tests and review evidence must prove this exact rule is enforced: Every change must be written to the audit log. |
| BR-201: Every function requiring authentication may only be performed when the user has a valid login session and the account is active. | CTMS-02-T01 | Tests and review evidence must prove this exact rule is enforced: Every function requiring authentication may only be performed when the user has a valid login session and the account is active. |
| BR-214: Every data relationship must reference an existing and valid record; child records must not be created for resources outside the correct business scope. | CTMS-02-T01 | Tests and review evidence must prove this exact rule is enforced: Every data relationship must reference an existing and valid record; child records must not be created for resources outside the correct business scope. |
| BR-215: Emails must be normalized before comparison and storage; phone numbers must be normalized to a consistent format, preferably E.164. | CTMS-02-T01 | Tests and review evidence must prove this exact rule is enforced: Emails must be normalized before comparison and storage; phone numbers must be normalized to a consistent format, preferably E.164. |
| BR-220: A valid time range must have a start time earlier than the end time, unless the business rule explicitly allows equality. | CTMS-02-T01 | Tests and review evidence must prove this exact rule is enforced: A valid time range must have a start time earlier than the end time, unless the business rule explicitly allows equality. |
| BR-236: Users may only add, delete, or reorder media for resources they own or are authorized to manage. | CTMS-02-T01 | Tests and review evidence must prove this exact rule is enforced: Users may only add, delete, or reorder media for resources they own or are authorized to manage. |
| BR-237: Background jobs must re-check business conditions at execution time and must not rely only on stale state. | CTMS-02-T01 | Tests and review evidence must prove this exact rule is enforced: Background jobs must re-check business conditions at execution time and must not rely only on stale state. |
| BR-005: An account may only be created when all registration data is valid. | CTMS-02-T01, CTMS-02-T02 | Tests and review evidence must prove this exact rule is enforced: An account may only be created when all registration data is valid. |
| BR-006: Account verification OTPs must expire according to system configuration. | CTMS-02-T01, CTMS-02-T02 | Tests and review evidence must prove this exact rule is enforced: Account verification OTPs must expire according to system configuration. |
| BR-007: OTP resend attempts must be limited according to system configuration. | CTMS-02-T01, CTMS-02-T02 | Tests and review evidence must prove this exact rule is enforced: OTP resend attempts must be limited according to system configuration. |

## UI and Tests

### Mobile UI Implementation

- `/verify` (`VerifyScreen`) is reached only from `RegisterScreen` on a successful `POST /auth/register`, carrying the created account's `RegisterResult` (id/email/phone/role/status) as router `extra` -- never entered directly.
- No OTP is ever sent automatically on screen entry: the user must pick a channel (Phone or Email) via `_ChannelButton`, then press "Gửi mã OTP" -- same Decision Gate contract as Web's `VerifyOtpPage.tsx`.
- Both channel buttons stay visible; Phone/SMS is wired end to end in the UI but is not exercised by real E2E evidence below since no SMS provider is configured in this environment -- Email is the channel proven against the real backend.
- `VerifyOtpController` (`Notifier<VerifyOtpState>`) owns `selectedChannel`, `code`, `isSending`/`isVerifying`, `hasSentCode`, a 60s resend `countdown` (`Timer.periodic`), `errorMessage`, and `verifySuccess`; `sendCode` dispatches `sendOtp` on the first call and `resendOtp` on every call after, both guarded against concurrent/duplicate taps.
- `verify` requires `hasSentCode` (BR-241-style guard) and calls the real `POST /auth/verify` with the account id and entered code; on success it sets `verifySuccess`, which swaps the screen to `_VerifySuccessView` and auto-redirects to `/login` after 2.5s (manual "Đến trang đăng nhập ngay" is also offered, same UX timing as Web's `useVerifyOtpForm.ts`).
- All error text shown to the user is relayed verbatim from the backend's own `ApiException` message (BR-242's "preserve entered data, display the reason" convention) -- no invented client-side copy for a real HTTP failure; the entered code is left untouched on a failed verify, only cleared implicitly by navigating away on success.

### CTMS-02-T02 Test Evidence (Mobile)

- Unit/API-client: `apps/mobile/test/features/auth/auth_api_otp_test.dart` -- 5 tests, covering `sendOtp`/`resendOtp` payload shape and `verifyOtp` success plus 404/409 `ApiException` propagation.
- Controller: `apps/mobile/test/features/auth/verify_otp_controller_test.dart` -- 18 tests, covering channel selection guards, first-send-vs-resend routing, the 60s countdown, BR-241-style in-flight guards, and BR-242 (code preserved, no `verifySuccess`) on a failed verify.
- Widget: `apps/mobile/test/features/auth/verify_screen_test.dart` -- 8 tests, covering rendering, disabled-state gating, the send/verify happy path, backend error surfacing for both send and verify failures, and both navigation-to-`/login` paths.
- Combined run: `flutter test test/features/auth/auth_api_otp_test.dart test/features/auth/verify_otp_controller_test.dart test/features/auth/verify_screen_test.dart` -> 31 passed.
- E2E: `apps/mobile/integration_test/verify_otp_test.dart`, orchestrated by `apps/mobile/scripts/run-verify-otp-e2e.ps1` (real Chrome, real backend, real Postgres, no mocking) -- 3 scenarios: (1) register through the real UI, select Email, and receive a real OTP; (2) a wrong code after a real send is rejected with the real backend's "Incorrect OTP" message and BR-242's code-preserved behavior; (3) a known-correct OTP planted directly in Postgres (via a new `db-helper.ts` `find-users-by-email-prefix`/`get-otp` combination) activates a `pending_verification` account and lands on `/login`.
- E2E result and a known environment flakiness: scenarios 1-2 passed on every run. Scenario 3 passed in some runs and timed out waiting for the success text in others (observed 4 fails out of 8 local runs). Root-caused by reading the real backend's own log, not by guessing: `flutter drive -d chrome` in debug mode on this local machine occasionally restarts the whole test process mid-run (visible as two real registrations under the same test's account-name prefix per run, in both passing and failing runs alike). Since scenario 3's OTP is single-use and deleted server-side on first successful verify (`auth.service.ts`'s `verifyOtp`), the duplicate in-process run's second identical verify attempt gets a legitimate "OTP not found" -- a race between two copies of the same test, not a defect in the OTP feature. Every run's backend log confirms the real `POST /auth/verify` call did activate the account server-side, including on runs reported as failed. Treated as a known local-tooling flakiness (Chrome/DWDS reconnect under this machine's memory constraints), not a feature defect; not chased further per the user's decision to document and move on.

## Story-Specific Risks and Edge Cases
- Missing authorization or ownership checks can expose CTMS data across users, roles, trips, campsites, or bookings.
- Concurrent requests, duplicate submissions, stale reads, and retry behavior can create inconsistent state if transactions and idempotency are not handled.
- UI validation must improve the user experience but must never replace backend validation or permission checks.
- State transitions must reject invalid source states and preserve a clear error response for the user or calling service.
- Any mapped BR missing from tests creates a release risk and must be resolved before Done.

## Functional and Domain Requirements
- Implement the `Verify Account via OTP or Email` workflow exactly within `EPIC 1. Authentication`.
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
- Story ID: `CTMS-02`
- Epic: `EPIC 1. Authentication`
- Sprint: `Sprint 1`
- Dependencies: `CTMS-01`
- Linked items: `Blocked by: CTMS-01

Blocks: CTMS-03`
- Spec Reference: `/file/spec/ctms-02-verify-account-via-otp-or-email.md`
- Business Rules workbook: `C:/Users/admin/Downloads/CTMS_Global_Business_Rules_Sprint_1-3.xlsx`
- Story-level BRs: `BR-202, BR-204, BR-205, BR-230, BR-231, BR-242, BR-243, BR-244, BR-200, BR-201, BR-214, BR-215, BR-220, BR-236, BR-237, BR-005, BR-006, BR-007`
