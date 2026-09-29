# CTMS-065 — Reliable Synchronization after Reconnection

## 1. Overview

Story: CTMS-065
Epic: EPIC 10. Buffer and Synchronization
Use Case: Reliable Synchronization after Reconnection
Priority: Must Have

Goal:
Allow System to complete `Reliable Synchronization after Reconnection` within the approved CTMS v3.1 scope.

Acceptance summary:
The Reliable Synchronization after Reconnection workflow must satisfy the approved PB v3.1 acceptance criteria for this story. Do not copy the Vietnamese backlog text into this spec; implementers must preserve the approved source meaning when refining detailed tests.

## 2. Scope

### In Scope

- Story-owned behavior for `Reliable Synchronization after Reconnection`.
- Validation, authorization, state handling, persistence, audit, and observable errors required by the mapped Business Rules.
- Story-specific acceptance tests that prove both allowed and rejected paths.

### Out of Scope

- Behavior owned by dependency stories unless a mapped BR explicitly makes it part of this story.
- Implementation of dependency stories: CTMS-064.

## 3. Actors & Authorization

- System: primary business actor for this story.
- Backend API: authoritative enforcement point for permissions, state, and business rules.
- UI or client application: may guide the user, but must not replace backend enforcement.

Authorization must be concrete: the caller must have the role, ownership, assignment, or operational relationship required by the mapped BRs before any protected data is returned or any state-changing action is committed.

## 4. Preconditions & Dependencies

- Product Backlog v3.1 row `CTMS-065` is the story scope source.
- The mapped Primary BR IDs below exist in the latest Business Rules workbook.
- Required domain records already exist and are in states allowed by the mapped BRs.
- Dependencies:
- CTMS-064

## 5. Business Rules

| BR | Rule |
|---|---|
| BR-243 | This BR is the authoritative story rule for `Reliable Synchronization after Reconnection`. Preserve and enforce these source thresholds, states, identifiers, and comparison operators exactly: GPS, UUID. |
| BR-244 | This BR is the authoritative story rule for `Reliable Synchronization after Reconnection`. Preserve and enforce these source thresholds, states, identifiers, and comparison operators exactly: GPS, UUID. |
| BR-245 | When connectivity is lost, GPS logs and safety events must be stored in the local database and survive app restart or device restart. OFF_ROUTE, checkpoint, and safety alerts must continue locally from the Offline Safety Package. |
| BR-257 | This BR is the authoritative story rule for `Reliable Synchronization after Reconnection`. Preserve and enforce these source thresholds, states, identifiers, and comparison operators exactly: SOS, GPS. |
| BR-400 | This BR is the authoritative story rule for `Reliable Synchronization after Reconnection`. Enforce it before persistence, reject violations without partial side effects, and keep the outcome auditable and testable. |
| BR-401 | This BR is the authoritative story rule for `Reliable Synchronization after Reconnection`. Enforce it before persistence, reject violations without partial side effects, and keep the outcome auditable and testable. |
| BR-404 | This BR is the authoritative story rule for `Reliable Synchronization after Reconnection`. Enforce it before persistence, reject violations without partial side effects, and keep the outcome auditable and testable. |
| BR-441 | V3 safety tracking configuration is fixed: GPS sampling every 10 seconds, GPS log every 30 seconds, runtime valid accuracy `<= 20m`, OFF_ROUTE `> 50m` with 3 VALID samples, ON_ROUTE recovery `< 20m` with 3 VALID samples, and Route Checkpoint reached `<= 20m` with 3 VALID samples. |
| BR-442 | This BR is the authoritative story rule for `Reliable Synchronization after Reconnection`. Enforce it before persistence, reject violations without partial side effects, and keep the outcome auditable and testable. |
| BR-443 | This BR is the authoritative story rule for `Reliable Synchronization after Reconnection`. Enforce it before persistence, reject violations without partial side effects, and keep the outcome auditable and testable. |
| BR-176 | State-changing operations must persist the authoritative result before dependent side effects are emitted. |
| BR-177 | Duplicate submissions and retries must not create duplicate authoritative records. |
| BR-178 | Provider, sync, queue, and notification retries must be idempotent. |
| BR-179 | Multi-record operations that define one business outcome must use a transaction or equivalent atomic boundary. |
| BR-180 | Stateful resources must follow defined state transitions and must not use enum values outside the database or API contract. |
| BR-181 | Before updating state, the backend must verify the current persisted state; stale requests must fail with a business conflict. |
| BR-188 | Date and time handling must use the authoritative timezone and ordering rules for the business workflow, and invalid or impossible time ranges must be rejected. |
| BR-190 | Expired, consumed, revoked, superseded, or stale credentials, tokens, OTPs, packages, snapshots, or assignments must not be accepted. |
| BR-193 | Automated actions must record `actor_id = NULL` or a system actor and must store a clear execution reason. |
| BR-199 | APIs must return consistent error codes: 401 for authentication failure, 403 for missing permission, 404 for not found, 409 for business conflict, and 422 for invalid data. |
| BR-200 | Error messages must explain the problem and the user action needed, while never exposing stack traces, secrets, or resources the user is not allowed to view. |
| BR-207 | Offline data must include a request identifier or `idempotency_key`; resubmitting the same sync batch must not create duplicate data. |
| BR-208 | When offline data conflicts with newer server data, the server must apply the defined conflict rule and must not silently overwrite newer data. |
| BR-212 | Any Business Rule, enum, state transition, or API contract change must update the spec, tests, and data documentation before the story is Done. |
| BR-213 | Every mapped Business Rule must have at least one valid-path test and one violation-path test; concurrency, idempotency, and transaction rules require integration or E2E coverage. |
| BR-225 | Every operational action must resolve to success, pending, or failure. On conflict or connectivity failure, user-entered or local data must remain recoverable. |
| BR-230 | When `sharing_consent` is revoked, server access to medical data must end immediately. Downloaded offline packages containing medical data must mark the sensitive portion invalid/outdated, and the client must purge or lock it at the next sync/connection. |
| BR-360 | Trip/client must be able to identify the package version used when GPS or safety data was recorded. GPS logs, safety events, and sync payloads must carry enough reference/version context for historical safety analysis. |
| BR-363 | Each device safety-tracking session must bind at minimum to `trip_id`, member or participant identity, device/session context, and active `offline_package_id/version`; missing required context prevents authoritative Trip safety events. |
| BR-389 | If the app restarts during a Trip, the client must restore the active safety session, package context, and any valid unsynced safety events or GPS logs from local storage before continuing tracking. |
| BR-390 | Recovery from OFF_ROUTE uses the fixed ON_ROUTE threshold `< 20m`. The `20m-50m` range is a buffer zone to prevent state oscillation near the OFF_ROUTE threshold. |
| BR-398 | `gps_logs` are historical telemetry and are not the sole source of realtime safety state. OFF_ROUTE and checkpoint events must be persisted independently from the 30-second `gps_log` boundary when the event sample does not align with that boundary. |
| BR-402 | This BR is the authoritative story rule for `Reliable Synchronization after Reconnection`. Preserve and enforce these source thresholds, states, identifiers, and comparison operators exactly: GPS. |
| BR-403 | This BR is the authoritative story rule for `Reliable Synchronization after Reconnection`. Preserve and enforce these source thresholds, states, identifiers, and comparison operators exactly: GPS. |
| BR-408 | When a Trip ends, realtime tracking must transition to completed/closed according to policy; the client must not continue sending operational GPS indefinitely under the same Trip context. |

## 6. State & Lifecycle

Relevant states from the approved rules: `active`, `completed`, `expired`, `closed`, `fail`.

Do not introduce placeholder workflow states unless an owning domain contract explicitly defines them.

## 7. Business Flow

1. System initiates `Reliable Synchronization after Reconnection` through the approved UI, API, scheduled job, or integration point.
2. The backend loads the required source records and verifies authorization, ownership or assignment, current state, and all mapped BR prerequisites.
3. The backend applies the story-owned decision logic from Section 5.
4. If any mapped rule is violated, the backend rejects the operation with no partial side effects and returns an actionable error.
5. If the action changes authoritative data, the change commits atomically with required audit and post-commit notifications.
6. The client presents the committed result or the rejection reason without exposing protected data.

## 8. Data & Invariants

- Persist or return only fields required for `Reliable Synchronization after Reconnection` and the mapped BRs.
- Preserve authoritative identifiers, ownership links, timestamps, snapshots, status values, and audit references when they affect the business outcome.
- Derived counters, scores, release-gate metrics, and ledger amounts must be traceable to their source records and rule version.
- Do not invent tables, enum values, state machines, or audit stores solely for this story.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case | Expected Behavior |
|---|---|
| Caller lacks the required role, ownership, assignment, or relationship | Reject with no side effects. |
| Required source record is missing | Return not found or blocked state without fabricating data. |
| Current state violates a mapped BR | Return business conflict and preserve the current authoritative state. |
| Input violates a mapped BR | Return validation error before persistence. |
| Duplicate or retried request affects authoritative data | Enforce idempotency or reject safely so duplicate records, refunds, notifications, or ledger entries are not created. |

## 11. Acceptance & Test Matrix

| BR / AC | Scenario | Expected Result | Test Type |
|---|---|---|---|
| PB AC | Approved backlog acceptance path for `Reliable Synchronization after Reconnection` | Meets the acceptance summary above | E2E |
| BR-243 | Approved rule is satisfied for `Reliable Synchronization after Reconnection` | Accepted and persisted or returned as applicable | Integration |
| BR-243 | Approved rule is violated for `Reliable Synchronization after Reconnection` | Rejected with no partial side effects | Boundary / Integration |
| BR-244 | Approved rule is satisfied for `Reliable Synchronization after Reconnection` | Accepted and persisted or returned as applicable | Integration |
| BR-244 | Approved rule is violated for `Reliable Synchronization after Reconnection` | Rejected with no partial side effects | Boundary / Integration |
| BR-245 | Approved rule is satisfied for `Reliable Synchronization after Reconnection` | Accepted and persisted or returned as applicable | Integration |
| BR-245 | Approved rule is violated for `Reliable Synchronization after Reconnection` | Rejected with no partial side effects | Boundary / Integration |
| BR-257 | Approved rule is satisfied for `Reliable Synchronization after Reconnection` | Accepted and persisted or returned as applicable | Integration |
| BR-257 | Approved rule is violated for `Reliable Synchronization after Reconnection` | Rejected with no partial side effects | Boundary / Integration |
| BR-400 | Approved rule is satisfied for `Reliable Synchronization after Reconnection` | Accepted and persisted or returned as applicable | Integration |
| BR-400 | Approved rule is violated for `Reliable Synchronization after Reconnection` | Rejected with no partial side effects | Boundary / Integration |
| BR-401 | Approved rule is satisfied for `Reliable Synchronization after Reconnection` | Accepted and persisted or returned as applicable | Integration |
| BR-401 | Approved rule is violated for `Reliable Synchronization after Reconnection` | Rejected with no partial side effects | Boundary / Integration |
| BR-404 | Approved rule is satisfied for `Reliable Synchronization after Reconnection` | Accepted and persisted or returned as applicable | Integration |
| BR-404 | Approved rule is violated for `Reliable Synchronization after Reconnection` | Rejected with no partial side effects | Boundary / Integration |
| BR-441 | Approved rule is satisfied for `Reliable Synchronization after Reconnection` | Accepted and persisted or returned as applicable | Integration |
| BR-441 | Approved rule is violated for `Reliable Synchronization after Reconnection` | Rejected with no partial side effects | Boundary / Integration |
| Remaining mapped BRs | Each mapped BR has valid and violation coverage in the owning test suite | Coverage proves the rule is enforced | Unit / Integration / E2E |

## 12. Open Decisions & References

### 12.1 Open Decisions

None.

### 12.2 References

- Product Backlog v3.1.
- CTMS Business Rules workbook.
- CTMS Architecture Overview.
