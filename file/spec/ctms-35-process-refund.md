# CTMS-35 - Process Refund

**Spec Reference**  
/file/spec/ctms-35-process-refund.md

**Story Title**  
Process Refund

**Status**  
To Do

**Story**  
As the System, I want to process Refund so that the CTMS workflow is completed safely, consistently, and within the correct business scope.

## Acceptance Criteria
- [ ] The intended actor can complete the `Process Refund` workflow when all Product Backlog V3 preconditions are satisfied.
- [ ] The backend enforces the task-specific business rules listed below before creating, updating, returning, or synchronizing data.
- [ ] Invalid input, unauthorized access, invalid dependencies, and invalid state transitions are rejected with clear errors and no unintended side effects.
- [ ] The workflow respects its V3 dependencies: CTMS-34, CTMS-32.

## Business Rules Checklist
- [ ] BR-105: A refund must create a payment transaction with type refund, parent_payment_id pointing to the original succeeded charge, and a unique idempotency_key.
- [ ] BR-106: payment transactions may only use status pending, succeeded, or failed. bookings.payment_status is derived/updated from total succeeded refunds as partially_refunded or refunded; do not use payments.status = refunded.
- [ ] BR-107: The total amount of succeeded and pending refunds allowed by policy must not exceed the refundable succeeded charge amount; the same cancellation/refund request must not be refunded twice.
- [ ] BR-108: Provider transaction_ref, when available, must be stored uniquely and used for reconciliation/callback; a client response must not be treated as proof of payment.

## Dev Notes
- Jira status on 2026-08-04: `To Do`.
- Priority: `Must Have`; Story points: `8`; Commitment: `Stretch`.
- Epic: `EPIC 6. Booking and Payment`.
- Sprint: `Sprint 3`; planned window: `2026-08-23` to `2026-09-05`.
- Product Backlog V3 sheet `version 3` is the numbering and scope authority.
- Business Rules Checklist contains only task-relevant business rules after V3 review.
- Keep API, UI, database, tests, and Jira references aligned with the exact Spec Reference path above.

## Story-Specific Implementation Tasks
- CTMS-35-T01 [BE / Shared Logic] Implement `Process Refund` for this task scope and enforce mapped business rules: BR-105, BR-106, BR-107, BR-108. Ref: /file/spec/ctms-35-process-refund.md#backend-preparation-logic-and-tests
- CTMS-35-T02 [UI Web/Mobile/Consumer] Implement `Process Refund` for this task scope and enforce mapped business rules: BR-105, BR-106, BR-107, BR-108. Ref: /file/spec/ctms-35-process-refund.md#ui-and-tests

## Task to Acceptance Criteria Traceability
| Acceptance criterion / business rule | Covered by tasks | Evidence expected |
| --- | --- | --- |
| AC1: The intended actor can complete the `Process Refund` workflow when all Product Backlog V3 preconditions are satisfied. | CTMS-35-T01, CTMS-35-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC2: The backend enforces the task-specific business rules listed below before creating, updating, returning, or synchronizing data. | CTMS-35-T01, CTMS-35-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC3: Invalid input, unauthorized access, invalid dependencies, and invalid state transitions are rejected with clear errors and no unintended side effects. | CTMS-35-T01, CTMS-35-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| AC4: The workflow respects its V3 dependencies: CTMS-34, CTMS-32. | CTMS-35-T01, CTMS-35-T02 | Unit, integration, API, UI, or E2E evidence depending on touched layer |
| BR-105: A refund must create a payment transaction with type refund, parent_payment_id pointing to the original succeeded charge, and a unique idempotency_key. | CTMS-35-T01, CTMS-35-T02 | Tests and review evidence must prove this rule is enforced for `Process Refund`. |
| BR-106: payment transactions may only use status pending, succeeded, or failed. bookings.payment_status is derived/updated from total succeeded refunds as partially_refunded or refunded; do not use payments.status = refunded. | CTMS-35-T01, CTMS-35-T02 | Tests and review evidence must prove this rule is enforced for `Process Refund`. |
| BR-107: The total amount of succeeded and pending refunds allowed by policy must not exceed the refundable succeeded charge amount; the same cancellation/refund request must not be refunded twice. | CTMS-35-T01, CTMS-35-T02 | Tests and review evidence must prove this rule is enforced for `Process Refund`. |
| BR-108: Provider transaction_ref, when available, must be stored uniquely and used for reconciliation/callback; a client response must not be treated as proof of payment. | CTMS-35-T01, CTMS-35-T02 | Tests and review evidence must prove this rule is enforced for `Process Refund`. |

## Story-Specific Risks and Edge Cases
- Missing authorization or ownership checks can expose CTMS data across users, roles, trips, routes, bookings, or operational records.
- Concurrent requests, duplicate submissions, stale reads, and retry behavior can create inconsistent state if transactions and idempotency are not handled.
- UI validation must improve the user experience but must never replace backend validation or permission checks.
- State transitions must reject invalid source states and preserve a clear error response for the user or calling service.
- Any mapped business rule missing from tests creates a release risk and must be resolved before Done.

## Functional and Domain Requirements
- Implement the `Process Refund` workflow exactly within `EPIC 6. Booking and Payment`.
- Enforce role-based access before executing any domain action.
- Validate required fields, enum values, date ranges, ownership boundaries, and cross-entity references before writing data.
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
- Notify affected users when the workflow changes booking, trip, route, Porter, SOS, emergency, or administrative state.

## File Structure Notes
- Backend: place controllers, DTOs, services, repositories, guards, and tests in the module that owns the domain entity.
- Frontend: place screens, components, hooks, API clients, schemas, and tests in the feature folder that owns the workflow.
- Shared constants, enums, query keys, and validation schemas should be centralized only when reused by more than one feature.
- Keep migration, seed, and fixture changes close to the persistence model they support.

## Implementation Guidance for the Dev Agent
- Start by reading the existing module patterns before adding new files or abstractions.
- Keep the implementation narrow to this story and reuse existing CTMS helpers for auth, validation, transactions, i18n, API errors, and tests.
- Build backend behavior first when the UI depends on an API contract, then wire the frontend to the typed contract.
- Do not mark the story Done until mapped acceptance criteria, business rules, audit behavior, and regression tests are all covered.

## Testing Requirements
- Add unit tests for domain validation, permission checks, state transitions, and mapped business rule violations.
- Add API or integration tests for success, invalid input, unauthorized access, missing resource, conflict, and rollback cases.
- Add UI/component tests for rendering, validation messages, disabled states, loading states, error handling, and successful submission where UI exists.
- Add E2E coverage for the primary user journey and at least one critical failure path.
- Every business rule listed in the Business Rules Checklist must appear in at least one test or review evidence item.

## References
- Story ID: `CTMS-35`
- Epic: `EPIC 6. Booking and Payment`
- Sprint: `Sprint 3`
- Dependencies: `CTMS-34`, `CTMS-32`
- Linked items: `Blocked by: CTMS-34, CTMS-32
Blocks: CTMS-36, CTMS-113, CTMS-117, CTMS-119, CTMS-121`
- Spec Reference: `/file/spec/ctms-35-process-refund.md`
- Product Backlog source: `PRODUCT BACKLOG.xlsx`, sheet `version 3`
- Business Rules source: `CTMS- Business rules.xlsx`
- Story-level business rules: BR-105, BR-106, BR-107, BR-108
