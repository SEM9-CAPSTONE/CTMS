# CTMS-086 — Manage Trip Incidents

## 1. Overview

Story: CTMS-086

Epic: EPIC 14. Host Operations and Monitoring

Use Case: Manage Trip Incidents

Priority: Must Have

Goal: Allow an authorized Host to create or receive Trip incidents, assign handling responsibility, and track incident handling through valid states with auditable history.

Backlog story: As a Host, I want to manage Trip incidents so operational problems can be assigned, tracked, and resolved.

Acceptance Criteria:

| Source  | Criterion                                                                 |
| ------- | ------------------------------------------------------------------------- |
| PB AC-1 | Authorized Host may create or receive an incident for an applicable Trip. |
| PB AC-2 | Handling responsibility can be assigned.                                  |
| PB AC-3 | Incident may be updated only through valid state transitions.             |
| PB AC-4 | Incident action history is auditable.                                     |
| PB AC-5 | Unauthorized users cannot mutate incident state.                          |

## 2. Scope

### In Scope

- Incident creation/reception.
- Assignment.
- State updates.
- Action history.
- Audit.

### Out of Scope

- SOS-specific lifecycle — CTMS-074–080.
- Automatic incident classification unless separately specified.

## 3. Actors & Authorization

Primary actor:

- Authorized Host.

System may create/deliver an incident from another supported operational source.

## 4. Preconditions & Dependencies

- Applicable Trip exists.
- Host is authorized for that Trip.

## 5. Business Rules

| BR         | Rule                                                                                                                                                                                                       |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-269     | The system must allow an authorized Host to create/receive incidents, assign handling responsibility, and update incidents through valid state transitions. The complete action history must be auditable. |
| BR-212     | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                      |
| BR-213     | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                               |

## 6. State & Lifecycle

Incident
→ created/received
→ assigned
→ handling-state transitions
→ terminal state according to authoritative incident lifecycle.

Exact state enum is not defined by BR-269 itself.

## 7. Business Flow

1. Incident is created or received.
2. Associate incident with Trip.
3. Verify Host authorization.
4. Host reviews incident.
5. Assign handling responsibility.
6. Update incident through permitted states.
7. Record each action/history entry.
8. Reject invalid state transition.

## 8. Data & Invariants

Incident requires sufficient context for:

- Trip;
- incident identity;
- handling responsibility;
- current state;
- action history.

Every authoritative mutation must remain traceable.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                     | Expected Behavior         |
| ------------------------ | ------------------------- |
| Authorized Host creates  | Incident created          |
| Unauthorized Host        | Reject                    |
| Valid assignment         | Responsibility updated    |
| Invalid transition       | Reject                    |
| Concurrent state update  | Do not silently overwrite |
| Incident history queried | Previous actions retained |

## 11. Acceptance & Test Matrix

| Source | Scenario           | Expected Result             | Test Type   |
| ------ | ------------------ | --------------------------- | ----------- |
| BR-269 | Create incident    | Persisted                   | Integration |
| BR-269 | Assign handler     | Assignment stored           | Functional  |
| BR-269 | Valid transition   | Accepted                    | State       |
| BR-269 | Invalid transition | Rejected                    | Negative    |
| BR-269 | Mutation           | History auditable           | Audit       |
| BR-213 | Concurrent update  | Correct authoritative state | Concurrency |

## 12. Open Decisions

Incident state enum and transition graph require authoritative lifecycle definition if not already defined elsewhere.
