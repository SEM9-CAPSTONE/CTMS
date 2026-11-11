# CTMS-019 — Generate Clear Weather Risk Advice Using LLM

## 1. Overview

Story: CTMS-019

Epic: EPIC 3. Weather Risk Assessment

Use Case: Generate Clear Weather Risk Advice Using LLM

Priority: Should Have

Goal: Convert authoritative Weather Risk factors into clear advisory text without allowing the LLM to change safety decisions.

Backlog story:
As a User, I want clear Weather Risk advice so I can understand the assessment and recommended precautions.

Acceptance Criteria:

| Source | Criterion |
| --- | --- |
| PB AC-1 | LLM can generate understandable advice from provided Weather Risk inputs. |
| PB AC-2 | Advice remains grounded in supplied factors/reasons. |
| PB AC-3 | LLM cannot change authoritative risk score or level. |
| PB AC-4 | LLM cannot override Route/Trip hard state or hard business rules. |

## 2. Scope

### In Scope

- Supply authoritative weather/risk factors to LLM.
- Generate advisory explanation.
- Present advice as interpretive text.
- Protect deterministic safety/business state from LLM output.

### Out of Scope

- Calculating Weather Risk.
- Changing risk level.
- Closing/reopening Route.
- Blocking/unblocking booking.
- Modifying hard safety rules.

## 3. Actors & Authorization

Primary actor: System.

User consumes generated advice.

LLM is an advisory component, not an authoritative business actor.

## 4. Preconditions & Dependencies

Dependency: CTMS-016.

Authoritative Weather Risk input must already exist.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                               |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BR-049 | The LLM may only interpret the supplied weather, risk, and safety inputs and produce advisory text. It must not change the Weather Risk score/level, Route or Trip hard state, or override any hard business rule. |
| BR-050 | LLM guidance must recommend concrete actions, remain grounded in the supplied factors/reasons, and must not assert facts that are absent from the source inputs.                                                   |
| BR-212 | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                              |
| BR-213 | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                       |

## 6. State & Lifecycle

Authoritative assessment
→ LLM receives permitted inputs
→ advisory text generated.

Authoritative assessment remains unchanged.

## 7. Business Flow

1. System loads authoritative Weather Risk assessment.
2. System selects permitted factors/reasons.
3. Inputs are sent to LLM.
4. LLM generates explanatory/advisory text.
5. System returns advice separately from authoritative score/level.
6. No LLM response is allowed to mutate Route/Trip/risk hard state.

## 8. Data & Invariants

- Risk score remains deterministic and authoritative.
- Risk level remains deterministic and authoritative.
- LLM output is advisory.
- LLM cannot override Red booking block or other hard policy.
- Advice must be traceable to supplied factors/reasons.

## 9. API / Integration Contract

TBD — Technical Design.

Model/provider/prompt are technical choices unless separately governed.

## 10. Error & Edge Cases

| Case | Expected Behavior |
| --- | --- |
| LLM unavailable | Authoritative risk remains available; advice may be unavailable. |
| LLM says risk is safe while authoritative level is Red | Ignore LLM safety override; Red remains authoritative. |
| LLM suggests reopening closed Route | Advice cannot change Route state. |
| Missing factors | Do not fabricate authoritative factors. |
| LLM output conflicts with hard BR | Hard BR wins. |

## 11. Acceptance & Test Matrix

| Source | Scenario | Expected Result | Test Type |
| --- | --- | --- | --- |
| BR-049 | Generate advice from valid assessment | Advisory text returned. | Integration |
| BR-049 | LLM contradicts risk level | Authoritative level unchanged. | Safety |
| BR-049 | LLM attempts state-changing instruction | No business state mutation. | Security |
| BR-050 | Advice generation | Uses supplied factors/reasons. | Integration |

## 12. Open Decisions

Exact LLM provider/model, prompt template and output format are Technical Design decisions.

They must not alter the authority boundary defined by BR-049.