# CTMS-081 — Broadcast Emergency Alert to Trip

## 1. Overview

Story: CTMS-081

Epic: EPIC 12. SOS and Emergency Communication

Use Case: Broadcast Emergency Alert to Trip

Priority: Must Have

Goal: Allow an authorized Host to broadcast an emergency alert to eligible members and Porters of a Trip they manage.

Backlog story: As a Host, I want to broadcast an emergency alert to my Trip so eligible participants and Porters can receive urgent instructions.

Acceptance Criteria:

| Source  | Criterion                                                         |
| ------- | ----------------------------------------------------------------- |
| PB AC-1 | Host may broadcast an emergency alert only to a Trip they manage. |
| PB AC-2 | Alert stores the associated Trip.                                 |
| PB AC-3 | Alert stores alert type.                                          |
| PB AC-4 | Alert stores alert content.                                       |
| PB AC-5 | Alert is delivered to eligible Trip members and Porters.          |
| PB AC-6 | MVP does not support area-based targeting outside the Trip scope. |

## 2. Scope

### In Scope

- Trip-scoped emergency broadcast.
- Alert type.
- Alert content.
- Eligible Trip members.
- Eligible assigned Porters.

### Out of Scope

- Geographic/area-based targeting outside the Trip.
- General marketing notifications.
- SOS creation.

## 3. Actors & Authorization

Primary actor:

- Host.

Host may broadcast only for a Trip they manage.

## 4. Preconditions & Dependencies

- Trip exists.
- Host manages the Trip.
- Eligible recipients can be resolved from authoritative Trip participation/assignment data.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                     |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-262 | A Host may broadcast an emergency alert only to a Trip they manage. The alert must store the Trip, alert type, and content and must be delivered to eligible Trip members and Porters. The MVP does not support area-based targeting outside this scope. |
| BR-212 | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                    |
| BR-213 | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                             |

## 6. State & Lifecycle

Broadcast request
→ authorization/validation
→ alert persisted
→ eligible recipients resolved
→ delivery initiated.

## 7. Business Flow

1. Host selects a managed Trip.
2. Host selects alert type.
3. Host enters alert content.
4. Backend verifies Host authorization.
5. Validate alert input.
6. Persist Trip-scoped emergency alert.
7. Resolve eligible Trip members and Porters.
8. Commit.
9. Deliver alert to eligible recipients.

## 8. Data & Invariants

Emergency alert contains:

- trip_id;
- alert_type;
- content.

Recipient scope must derive from the target Trip.

MVP must not silently expand recipient targeting to unrelated users based on geographic area.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                         | Expected Behavior              |
| ---------------------------- | ------------------------------ |
| Host manages Trip            | Broadcast permitted            |
| Host does not manage Trip    | Reject                         |
| Unrelated Camper             | Must not receive alert         |
| Porter not eligible for Trip | Must not receive alert         |
| Empty/invalid content        | Reject according to validation |
| Area targeting requested     | Not supported in MVP           |

## 11. Acceptance & Test Matrix

| Source | Scenario                   | Expected Result | Test Type     |
| ------ | -------------------------- | --------------- | ------------- |
| BR-262 | Authorized Host broadcasts | Alert created   | Integration   |
| BR-262 | Unrelated Host             | Rejected        | Security      |
| BR-262 | Eligible Camper            | Receives alert  | E2E           |
| BR-262 | Eligible Porter            | Receives alert  | E2E           |
| BR-262 | Unrelated user             | No alert        | Authorization |
| BR-262 | Area-based target          | Not supported   | Scope         |

## 12. Open Decisions

Exact supported emergency alert-type enum belongs to authoritative data/configuration design.
