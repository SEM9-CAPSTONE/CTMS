# CTMS-072 - Rate AI Answers

## 1. Overview

Story: CTMS-072

Epic: EPIC 11. AI Survival Assistant and RAG

Use Case: Rate AI Answers

Priority: Should Have

Goal: Allow Camper to provide usefulness and safety feedback on AI answers, including while temporarily offline.

Backlog story: As a Camper, I want to rate AI answers and report unsafe guidance so the system can identify answer-quality and safety problems.

Acceptance Criteria:

| Source  | Criterion |
| ------- | --------- |
| Jira AC1 | The Camper can rate a completed AI answer as Useful or Not Useful. |
| Jira AC2 | The Camper can independently report a completed AI answer as Unsafe, without choosing a usefulness rating. |
| Jira AC3 | Feedback records a rating value of Useful or Not Useful, or a null rating only when `reportedUnsafe` is true; it also records the unsafe-report indicator and an optional reason. |
| Jira AC4 | Feedback committed offline is durably retained and automatically synchronized after connectivity and API availability return, without a second submit. |
| Jira AC5 | Repeated synchronization or lost acknowledgments do not create duplicate authoritative feedback. |
| Jira AC6 | Local feedback contains the exact selected question and answer, the local answer identity, and available model metadata. Unrelated chat turns are excluded. Online feedback uses the authoritative `answerId`. |
| Jira AC7 | The Camper long-presses the rating icon to choose Useful or Not Useful. The answer displays only the chosen rating icon. There is no rating-success toast, confirmation text, draft, or extra Submit button. |

## 2. Scope

### In Scope

- Useful and Not Useful ratings on completed Online and Local answers.
- Independent Unsafe report with an optional reason.
- Durable offline feedback and automatic synchronization.
- Evidence for CTMS-073 review of accepted Unsafe reports.

### Out of Scope

- Admin unsafe-review workflow - CTMS-073.
- AI answer regeneration.
- Automatic modification of the knowledge base or model training.
- Upload of the local conversation transcript on reconnect.

## 3. Actors & Authorization

- Active Camper: provides feedback on a completed answer in their own chat.
- Synchronization subsystem: sends committed feedback using the originating account.
- Backend: checks role and ownership and protects review evidence.

Apply BR-172 to all submissions. Resolve Online ownership from the server answer. For Local
feedback, account-scoped storage binds the snapshot to the selected turn and installation.
Client-reported Local provenance does not attest to the model's output.

## 4. Preconditions & Dependencies

- CTMS-069 supplies the completed Online or Local answer. CTMS-071 supplies genuine citation metadata for Online answers.
- Integrate with the CTMS-065 reconnection coordinator after safety and telemetry delivery.
- CTMS-073 consumes eligible Unsafe feedback. CTMS-341 implements logic before CTMS-342 implements the UI.

## 5. Business Rules

| BR | Rule |
| -- | ---- |
| BR-252 | A Camper may rate a completed AI answer as Useful or Not Useful. |
| BR-511 | A Camper may report a completed AI answer as Unsafe independently of its usefulness rating. |
| BR-512 | Feedback requires a usefulness rating unless it explicitly reports the answer as Unsafe. |
| BR-513 | Local feedback carries the exact question and displayed answer from the evaluated turn. |
| BR-514 | A Local feedback upload is limited to the evaluated turn. |
| BR-515 | Committed feedback remains durably pending until server acknowledgment or authoritative terminal rejection. |
| BR-516 | Pending feedback synchronizes automatically when connectivity and the API are available. |
| BR-212 | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done. |
| BR-213 | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage. |

Reuse BR-172 (role and ownership), BR-178 (idempotency), BR-226 (delivery state),
BR-251 (source provenance), BR-502 (account isolation) and BR-503 (local chat transcript).
Use the existing BR-191 and BR-192 audit and sensitive-data practices for moderation;
raw questions, answers and reasons are excluded from operational logs.

## 6. State & Lifecycle

A completed answer displays one rating icon. Long-press opens Useful and Not Useful,
and an accessible tap action can open the same choices. Selecting commits the feedback
locally and shows only the selected rating icon. The same picker can change a rating.
Unsafe is a separate action. The rating has no draft, second confirmation, success toast
or visible delivery status.

Delivery transitions from `PENDING` through an in-flight send to `SYNCED` only on
server acknowledgment. Temporary failures remain pending with exponential backoff.
Permanent server rejection produces `FAILED_FINAL`. An accepted Unsafe report is
eligible for CTMS-073 moderation.

## 7. Business Flow

1. Camper views a completed AI answer and selects Useful or Not Useful from the rating picker, or independently sends an Unsafe report with an optional reason.
2. The client durably commits the action. For Online it records the authoritative answer ID. For Local it snapshots the exact displayed question and answer and available provenance.
3. The coordinator sends pending feedback after safety synchronization. It retries on reconnect, startup, and temporary service failure using the same mutation identity.
4. The API validates the active Camper, target, feedback shape and ordering, and acknowledges durable acceptance.
5. The client marks the accepted operation synchronized. Only Unsafe feedback is eligible for authorized moderation.

Explain before the selection that feedback on a Local answer sends that question
and answer to CTMS. Unselected turns stay local. A usefulness change preserves an
existing Unsafe report. Reopening the same account resumes its pending delivery.

## 8. Data & Invariants

Feedback contains an answer reference, nullable rating, explicit unsafe flag,
optional reason, original action time and owner context. Each account and answer
has one authoritative feedback. The client keeps a stable feedback ID, a new
mutation UUID per action and increasing revisions per client feedback ID. Replays
with a different payload or a reused revision conflict. A late earlier revision
cannot replace a newer rating from the same client. Distinct client streams for
the same Online answer update the same server record in acceptance order.

The Local target is the original account, installation ID and local answer ID.
A Local snapshot is immutable and carries the genuine model ID/version or verified
package ID/version when available. The backend resolves Online evidence by
answer ID. Historical Online answers can lack the original question. Their
stored answer and genuine citations remain usable while the answer is retained.

Online feedback follows the original answer's 30-day retention. Local feedback
and its mutation receipts are retained for 30 days after initial server acceptance.
The device persists pending snapshots in account-scoped secure storage and drops
their raw content after acknowledgment. Only committed feedback reaches the API.

## 9. API / Integration Contract

`POST /api/ai/answers/feedback` accepts a common JSON object with `clientFeedbackId`,
`clientMutationId`, positive integer `revision`, `createdAt` (UTC), `inferenceMode`,
`rating` (`USEFUL`, `NOT_USEFUL` or `null`), `reportedUnsafe` and optional `reason`.
`reportedAt` preserves the original Unsafe action time when a pending report is
carried into a later rating revision.

| Mode | Target and evidence |
| ---- | ------------------- |
| `ONLINE` | `answerId` only. The server resolves evidence from the owned, retained answer. |
| `LOCAL` | `installationId`, `localAnswerId`, exact nonblank `question` and `answer`. Optional `modelId`, `modelVersion`, `packageId` and `packageVersion` when actually used. |

IDs are UUIDs. Limits are 2,000 characters for question, 3,000 for answer,
1,000 for reason, and 128 for each model field. The server returns HTTP 200
with `feedbackId`, accepted `revision`, `rating` and `reportedUnsafe`.
401 indicates authentication is required, 403 indicates forbidden access, 404
indicates the Online answer is unavailable, 409 indicates an identity conflict,
and 422 indicates invalid feedback. An operation older than 30 days is no longer
eligible. A temporarily unavailable API retries with exponential backoff capped
at 60 seconds while connected. Pending delivery also resumes on reconnect.
Raw feedback content is stored as text. The downstream review UI must render it
as text.

## 10. Error & Edge Cases

| Case | Expected Behavior |
| ---- | ----------------- |
| Useful or Not Useful selected | Commit and show the selected icon. |
| Picker dismissed | No feedback created. |
| No reason | Feedback remains valid. |
| Unsafe without a rating | Store `rating=null` and `reportedUnsafe=true`. |
| Nullable rating without Unsafe, invalid value, or missing Local Q/A | Reject feedback. |
| Offline or temporary API failure | Preserve exact committed payload for automatic retry. |
| Reconnect or restart | Synchronize only submitted feedback for the active account. |
| Lost acknowledgment or late retry | Preserve one feedback and the latest ordered rating. |
| Switch accounts | Hold the first account's pending feedback for its original session. |
| Other owner's or expired Online answer | Reject as unavailable. |

## 11. Acceptance & Test Matrix

| Source | Scenario | Expected Result | Test Type |
| ------ | -------- | --------------- | --------- |
| BR-252 / AC7 | Long-press, choose either rating, change, dismiss | Two choices, only the selected icon, and no write on dismissal | Flutter widget |
| BR-511 / BR-512 | Unsafe-only without reason or empty feedback | Accept Unsafe-only and reject empty or invalid feedback | Unit / HTTP E2E |
| BR-513 / BR-514 / BR-503 | Local turn selected, unrelated turns, missing Q/A | Preserve the exact selected pair and reject missing evidence | HTTP E2E / Flutter |
| BR-172 / BR-251 | Owned, expired, forged or unowned Online reference | Resolve server evidence only for an eligible owner | HTTP E2E |
| BR-515 / BR-516 | Offline restart, reconnect, API retry and lost acknowledgment | Keep pending until acknowledgment and preserve mutation identity | Flutter integration / E2E |
| BR-178 | Replay, conflict and out-of-order revisions | One authoritative row and no stale overwrite | PostgreSQL integration |
| BR-502 / BR-226 | Account switch with an in-flight send | Account-isolated payload and delivery state | Flutter integration |
| CTMS-069 / CTMS-071 / CTMS-065 | Online RAG, Local inference, citation and safety sync | Existing behavior and safety priority preserved | Regression |

## 12. Open Decisions

CTMS-073 owns moderation transitions and any policy for withdrawing an Unsafe report.
