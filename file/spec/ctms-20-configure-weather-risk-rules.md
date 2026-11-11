# CTMS-020 — Configure Weather Risk Rules

## 1. Overview

Story: CTMS-020

Epic: EPIC 3. Weather Risk Assessment

Use Case: Configure Weather Risk Rules

Priority: Must Have

Goal: Allow Admin to manage versioned Weather Risk rules while ensuring one authoritative active configuration is used for future assessments.

Backlog story:
As an Admin, I want to configure Weather Risk rules so risk assessment criteria can be maintained without changing application business code.

Acceptance Criteria:

| Source  | Criterion                                                                                    |
| ------- | -------------------------------------------------------------------------------------------- |
| PB AC-1 | Authorized Admin can create/configure Weather Risk rule data.                                |
| PB AC-2 | Rule configuration includes versioned criteria such as weights and thresholds.               |
| PB AC-3 | Activation produces an authoritative active rule without inconsistent multiple-active state. |
| PB AC-4 | Rule activation/change is audited.                                                           |

## 2. Scope

### In Scope

- Configure `weather_rules`.
- Store rule name.
- Store weights.
- Store thresholds.
- Version rule.
- Activate rule.
- Maintain active-rule consistency.
- Audit activation/change.

### Out of Scope

- Retrieving weather.
- Calculating risk manually.
- Editing historical assessments.
- LLM advice.

## 3. Actors & Authorization

Primary actor: Admin.

Only authorized Admin may configure/activate Weather Risk rules.

Backend is authoritative for rule activation.

## 4. Preconditions & Dependencies

Dependencies:

- CTMS-006
- CTMS-015

Admin must be authenticated and authorized.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                             |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BR-051 | weather_rules must store name, weights, thresholds, version, is_active, and the audit metadata required by the system. Each version must be unique.                                              |
| BR-052 | The MVP may have at most one active weather_rules record at any time. Activating a new rule must deactivate the previously active rule within the same transaction.                              |
| BR-053 | Creating, editing, or activating a Weather Risk rule must be audited with the actor, rule version, before/after values, and a reason where applicable.                                           |
| BR-174 | All input must be validated for required fields, data type, format, length, enum membership, and cross-field relationships before processing.                                                    |
| BR-175 | The backend is the authoritative source for authorization, state, pricing, capacity, inventory, risk level, and transaction outcome. The client must not establish these values authoritatively. |
| BR-212 | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.            |
| BR-213 | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                     |

## 6. State & Lifecycle

Rule version created
→ inactive/configured

Inactive rule
→ Admin activation
→ active rule.

Previous active rule
→ replaced/deactivated according to authoritative activation transaction.

Historical assessments retain their original rule reference/version.

## 7. Business Flow

1. Admin creates or edits Weather Risk rule configuration.
2. Backend authorizes Admin.
3. Backend validates weights/thresholds/version metadata.
4. Rule version is persisted.
5. Admin activates selected rule.
6. Backend transaction establishes authoritative active rule state.
7. Activation is audited.
8. Future CTMS-016 assessments use the active rule.
9. Historical assessments remain bound to their original `rule_id`/version.

## 8. Data & Invariants

Source-supported concepts:

- `name`
- `weights`
- `thresholds`
- `version`
- `is_active`
- metadata
- audit context

Invariants:

- Invalid configuration cannot become active.
- Active-rule selection is server-authoritative.
- Activation cannot leave inconsistent multiple-active state where uniqueness requires one active rule.
- Historical assessment must not silently change when a new rule activates.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                                             | Expected Behavior                                                |
| ------------------------------------------------ | ---------------------------------------------------------------- |
| Non-Admin configures rule                        | Reject.                                                          |
| Invalid weights/thresholds                       | Reject.                                                          |
| Duplicate/conflicting version                    | Reject according to uniqueness contract.                         |
| Two Admins activate different rules concurrently | Transaction/constraint preserves one authoritative active state. |
| New rule activated                               | Existing historical assessments retain original rule reference.  |
| Activation transaction fails                     | Previous authoritative active state remains consistent.          |

## 11. Acceptance & Test Matrix

| Source | Scenario                                   | Expected Result                              | Test Type   |
| ------ | ------------------------------------------ | -------------------------------------------- | ----------- |
| BR-051 | Valid new rule version                     | Persisted.                                   | Integration |
| BR-051 | Invalid/duplicate version                  | Rejected.                                    | Boundary    |
| BR-052 | Activate rule                              | Active state changed transactionally.        | E2E         |
| BR-052 | Concurrent activations                     | No inconsistent active-rule state.           | Concurrency |
| BR-053 | Activation                                 | Audit contains actor/version/change context. | Integration |
| BR-175 | Client attempts to self-assert active rule | Backend state wins.                          | Security    |

## 12. Open Decisions

BR-051–053 currently contain partially generated wording.

The precise validation formula for weights, numeric threshold boundaries, version format and whether exactly one global rule or one rule per scope may be active must come from the approved Business Rules/Data Dictionary rather than being inferred.
