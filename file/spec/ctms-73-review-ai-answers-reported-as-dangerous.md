# CTMS-073 — AI Feedback Analysis & Investigation

## 1. Overview

Story: CTMS-073 ([Jira CTMS-261](https://thuha140105.atlassian.net/browse/CTMS-261))

Epic: EPIC 11. AI Survival Assistant and RAG

Use Case: AI Feedback Analysis & Investigation. Includes Review AI Answers Reported as Dangerous.

Priority: Must Have

Goal: Analyze accepted AI feedback, preserve investigation evidence and help authorized Admin review Unsafe reports, hand problems to Developers and record traceable outcomes.

Backlog story: As an Admin, I want to review AI answers reported as unsafe so dangerous guidance can be investigated and handled.

Acceptance Criteria:

| Source  | Criterion                                                           |
| ------- | ------------------------------------------------------------------- |
| PB AC-1 / BR-253 | Only authorized Admin may review unsafe AI feedback. |
| PB AC-2 | Moderation applies to feedback with `reported_unsafe = true`.       |
| PB AC-3 / BR-520 | Review status follows valid pending/reviewing/actioned transitions. |
| PB AC-4 / BR-521 | Moderation records reviewer and review time. |
| PB AC-5 / BR-522 | Resolution note is recorded when completing the report review. |
| PB AC-6 / BR-191 / BR-192 | Moderation action is audited. |
| Investigation AC-1 / BR-523 / BR-532 | Analyze each accepted effective feedback change upon intake, prioritizing Unsafe and Not Useful. |
| Investigation AC-2 / BR-524 | Useful-only feedback contributes aggregate signals without creating an investigation solely from that rating. |
| Investigation AC-3 / BR-525 / BR-526 | Group cases by a supported shared problem and retain each original feedback reference. Allow single-item groups. |
| Investigation AC-4 / BR-527 / BR-528 / BR-533 | Produce the evidence-backed report. Mark unsupported causes `UNDETERMINED` and require independent evidence to verify a finding. |
| Investigation AC-5 / BR-529 | Admin can hand off work and records a substantiated disposition before completing the case. |
| Investigation AC-6 / BR-530 / BR-531 | Preserve minimal evidence for open cases past original expiry and clean it up under an approved investigation policy. |

## 2. Scope

### In Scope

- Unsafe-feedback queue.
- Authorized Admin review.
- Review lifecycle.
- Reviewer/time.
- Resolution note.
- Moderation audit.
- Automated feedback analysis, issue grouping, investigation reports, evidence snapshots and Developer handoff. These are planned extensions. The current code accepts feedback and initializes Unsafe review status to `pending`.

### Out of Scope

- Camper feedback creation — CTMS-072.
- Automatic rewriting of AI output.
- Automatic source-document modification.
- Emergency detection and SOS (CTMS-075 and CTMS-074/076).
- Benchmark execution and release decisions (CTMS-098).
- Admin changes to source, prompts, RAG, model or code from the investigation workflow.

## 3. Actors & Authorization

- Authorized Admin performs review, handoff and disposition.
- System analyzes accepted feedback and drafts investigation findings under a restricted service identity.
- Developer verifies and fixes technical issues through the team's engineering workflow. This requires no new CTMS role. Admin shares only authorized, minimized evidence.

Non-Admin users cannot perform moderation transitions.

## 4. Preconditions & Dependencies

Dependency:

- CTMS-072 supplies the accepted feedback. CTMS-069 supplies its available Inference Trace. CTMS-050/051 govern access to source artifacts. CTMS-098 may receive candidate regression cases or provide run references.

An accepted feedback record is required for automated analysis. `reported_unsafe = true` is required for the existing Unsafe moderation queue and review transitions.

CTMS-072 accepts an Unsafe report independently of a usefulness rating. Local
feedback contains the evaluated question and answer. Online feedback references the
retained answer and its available server-recorded evidence. A historical Online
answer may lack the original question. Render the reported content as text.

## 5. Business Rules

| BR         | Rule                                                                                                                                                                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BR-253     | Only an authorized Admin may perform Unsafe feedback moderation. |
| BR-520     | Unsafe moderation may move `review_status` only from `pending` to `reviewing` and from `reviewing` to `actioned`. |
| BR-521     | Every Unsafe moderation transition must persist its reviewer and review time. |
| BR-522     | An Unsafe moderation transition to `actioned` requires a resolution note. |
| BR-523     | Each accepted effective feedback change must enter automated analysis without a volume threshold. |
| BR-524     | A Useful rating without an Unsafe report must not create an investigation solely from that rating. |
| BR-525     | Feedback may share an issue group only when the available evidence supports a common problem. |
| BR-526     | Every issue-group member must remain traceable to its original feedback identity. |
| BR-527     | An investigation must record `UNDETERMINED` when the evidence cannot establish a cause. |
| BR-528     | A finding must have independent supporting evidence before it can be marked verified. |
| BR-529     | Admin may complete an investigation only after recording a substantiated disposition. |
| BR-530     | An open investigation must retain its minimum necessary evidence independently of the expiry of the original answer or feedback. |
| BR-531     | Investigation evidence must be cleaned up when eligible under the approved investigation retention policy. |
| BR-532     | Automated analysis must prioritize Unsafe and Not Useful feedback over Useful-only feedback. |
| BR-533     | Each actionable feedback case must have an Investigation Report, including when it is the only case of its kind. |
| BR-172     | Access control must be enforced by the backend using role, ownership, and business scope. Hiding or disabling functionality in the UI is not a substitute for backend authorization. |
| BR-191     | Critical actions must be recorded in the audit log with actor, action, target, timestamp, and either before/after data or the reason for the change.                                                                                                                           |
| BR-192     | Audit logs must not contain passwords, OTPs, tokens, sensitive payment data, or unnecessary health data.                                                                                                                                                                       |
| BR-212     | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                                          |
| BR-213     | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                                                   |

## 6. State & Lifecycle

`pending`
→ `reviewing`
→ `actioned`

These remain the Unsafe-only review states. `pending` is initialized by CTMS-072. The planned case holds the review history independently of original feedback expiry and preserves the same state semantics while the original is retained. Not Useful without Unsafe has an investigation disposition and no Unsafe `review_status`. A later Unsafe action on the same feedback creates the `pending` review path and keeps the existing investigation linkage.

Unsafe feedback remains available to authorized Admin as soon as it is accepted, including while automated analysis is pending or unavailable.

Engineering progress is separate. Track handoff, verification and any fix reference in the technical disposition. A handoff alone leaves the case open and cannot set `actioned`. Admin completes an Unsafe case through `reviewing → actioned` with a resolution note and evidence of the recorded outcome. Admin closes a Not Useful-only case on the same disposition standard. A documented outcome may include a technically verified fix or a justified no-fix disposition. `UNDETERMINED` can be part of a supported disposition that records the investigation performed and unresolved evidence. The analyzer's uncertainty alone cannot close a case.

## 7. Business Flow

1. Consume each accepted effective feedback change and make actionable evidence durable before original expiry. Process Unsafe first, then Not Useful, with Useful-only contributing aggregate signals. Begin analysis per feedback without waiting for other cases.
2. Analyze the reported question/answer, trace and genuine source evidence. A Camper rating is a user signal. Check hypotheses against source artifacts, runtime/configuration facts, deterministic checks or independent human verification.
3. For Unsafe or Not Useful, produce an Investigation Report. A case can stand alone. Link cases only where the evidence supports a common problem. Similar topic, model or document alone is insufficient. Record unknowns, including `UNDETERMINED` when evidence is inconclusive. Processing failures may receive bounded technical retries. Inconclusive findings do not trigger repeated analysis.
4. An authorized Admin receives the report. In the Unsafe queue, review the question, answer and available source evidence and move `pending → reviewing`. Record reviewer/time and audit the transition.
5. Admin hands a technical issue to Developer with the minimized evidence, scope of the suspected problem and a reference to the case. Developer verifies the findings and tracks any fix or verification evidence in the engineering workflow.
6. Admin records the supported outcome. For Unsafe review, enter the resolution note, move `reviewing → actioned`, persist reviewer/time and audit the transition. Close the investigation only with the substantiated disposition. The workflow has no Admin-triggered AI reanalysis action.

## 8. Data & Invariants

Moderation record contains:

- feedback;
- review status;
- reviewer;
- review timestamp;
- resolution note;
- audit reference/context.

Only unsafe-reported feedback belongs in the Unsafe moderation workflow. Investigation records may also cover Not Useful feedback.

An Investigation Report records feedback and answer identity, reported question and answer, suspected issue type, actual inference evidence and source references, related feedback and groups, hypotheses, supporting and conflicting evidence, confidence and unknowns, a proposed remedy and suggested test cases when available. The case preserves the original submitted evidence independently of mutable review and technical progress. Render user text as text. Keep raw evidence out of operational logs and limit audit payloads to the necessary action context.

Online answers and feedback expire under CTMS-069/072's original 30-day rules. Capture a separate, minimal Investigation Snapshot for actionable cases before the original can expire. The open case, its evidence and lineage must remain readable under investigation authorization even after source-row cleanup. Snapshot creation does not renew the original feedback or answer expiry. Clean investigation evidence and unused retained artifacts under the approved separate lifecycle. No new duration is approved here.

## 9. API / Integration Contract

Use the [planned integration and data contract](../../docs/features/CTMS-073-Investigation-Design.md) for acceptance handoff, snapshot capture, grouping, authorization, retention and Developer handoff. CTMS-072 acknowledges durable feedback independently of analysis completion. Jira/GitHub can carry manual technical work references. Any automatic integration requires a separate decision and implementation.

## 10. Error & Edge Cases

| Case                                                    | Expected Behavior           |
| ------------------------------------------------------- | --------------------------- |
| Camper tries moderation                                 | Reject                      |
| Admin reviews non-unsafe feedback through this workflow | Reject/not eligible         |
| Invalid state transition                                | Reject                      |
| Action without resolution note                          | Reject according to BR-522  |
| Concurrent moderation update                            | Detect stale state/conflict |
| Successful action                                       | Audit moderation            |
| One Unsafe or Not Useful feedback                       | Start analysis and produce a case report without waiting for more feedback. |
| Useful feedback without Unsafe                          | Process as an aggregate signal without opening a new case solely because of the rating. |
| Missing historical fields or restricted source          | Flag missing evidence. Use `UNDETERMINED` when the remaining evidence cannot establish cause. |
| Feedback replay, or older revision with no effective change | Acknowledge according to CTMS-072. Do not create duplicate analysis or groups. |
| Source row expires during an open investigation         | Continue from the Investigation Snapshot without restoring the original row. |
| Analyzer delayed or unavailable                         | Preserve the Unsafe queue and allow authorized review from the available evidence. |
| Technical ticket created, outcome still pending         | Keep investigation open and the existing review state. |

## 11. Acceptance & Test Matrix

| Source | Scenario             | Expected Result                 | Test Type     |
| ------ | -------------------- | ------------------------------- | ------------- |
| PB AC-1 / BR-253 / BR-172 | Authorized Admin, unauthorized roles, and restricted evidence access | Only authorized review and scoped evidence reads succeed. | Authorization / HTTP E2E |
| PB AC-2 | Unsafe and Not Useful-only cases | Only Unsafe enters the Unsafe queue. | Integration |
| PB AC-1 / PB AC-2 | Unsafe feedback accepted while the analyzer is unavailable | Authorized Admin can begin review with the available evidence. | Integration |
| PB AC-3 / BR-520 | Allowed transitions, direct skip, stale concurrent requests | Commit only valid transitions from the expected state. | PostgreSQL integration |
| PB AC-4 / BR-521 | Each transition, with missing attribution or a spoofed reviewer | Persist authenticated reviewer and server review time. Reject or derive missing trusted fields server-side. | Integration |
| PB AC-5 / BR-522 | Complete with a valid or blank resolution note | Accept valid note. Reject missing or blank note. | HTTP E2E |
| PB AC-6 / BR-191 / BR-192 | Moderation and failed or unauthorized writes | Audit every successful transition with minimal context. Preserve state on failed writes without leaking raw evidence. | Audit / integration |
| Investigation AC-1 / BR-523 / BR-532 | Competing Unsafe, Not Useful and Useful changes and an idempotent replay | Process accepted effective changes individually, honor ordering priority and suppress duplicate work. | Integration |
| Investigation AC-2 / BR-524 | Useful-only and Useful with Unsafe | Count Useful-only in aggregate. Investigate the Unsafe signal even if rated Useful. | Integration |
| Investigation AC-3 / BR-525 / BR-526 | One report, same cause, similar topic with a different cause, and attempted dangling membership | Preserve singleton or evidence-supported membership with durable original IDs. Reject unsupported matches and broken links. | Integration |
| Investigation AC-4 / BR-527 / BR-528 / BR-533 | Evidence-supported cause, contradictory evidence, unavailable source, and a lone actionable case | Produce a report. Record independent verification only when supported. Use `UNDETERMINED` when cause cannot be established. | Integration / contract |
| Investigation AC-5 / BR-529 | Handoff alone, verified fix, and justified no-fix disposition | Handoff leaves the case open. Admin can close with a recorded supported disposition. | State / integration |
| Investigation AC-6 / BR-530 / BR-531 | Expiring raw records, active investigation, eligible closed evidence, and unauthorized access | Preserve open-case evidence through original cleanup. Delete only eligible evidence under the approved policy and restrict reads. | PostgreSQL integration / security |

## 12. Open Decisions

Approve investigation evidence and artifact retention periods, closure/hold rules, source access after withdrawal or deletion, analyzer execution limits and any automated Jira/GitHub integration before enabling them. Final API and storage shapes remain Technical Design. Specific downstream moderation remedies and Unsafe withdrawal policy remain open.
