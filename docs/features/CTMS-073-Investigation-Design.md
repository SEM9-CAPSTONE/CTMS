# CTMS-073 — AI Feedback Analysis & Investigation design

[CTMS-073](../../file/spec/ctms-73-review-ai-answers-reported-as-dangerous.md) defines the investigation workflow for Jira CTMS-261. CTMS-072 stores feedback, initializes Unsafe `review_status` to `pending`, preserves its acceptance receipts and cleans up expired rows. The backend contract below describes how CTMS-343 extends that transaction and exposes the investigation workflow to authorized Admins.

## Feedback intake and processing

| Input | Handling |
| --- | --- |
| Newly accepted feedback or meaningful change to the authoritative row | Publish a durable internal acceptance event. Process it per feedback with priority Unsafe, then Not Useful, then Useful-only. Use the accepted state after CTMS-072 revision and ownership checks. |
| Unsafe or Not Useful | Preserve the minimum investigation snapshot and create or update the case report. A case may start from one report. Unsafe with a Useful rating still takes the Unsafe path. |
| Useful-only | Process the effective feedback as an aggregate signal. Use only authorized live evidence as needed and do not retain case text or create a case solely because of the rating. A later rating change does not erase an existing case or withdraw an Unsafe report. |
| Replay, rejection or no effective change | Keep CTMS-072 response semantics. Acknowledgment replays and stale no-op revisions do not emit new analysis work or duplicate counts. An accepted older revision that newly sets Unsafe is an effective change. |

Record the actionable evidence and durable work reference at acceptance or in an atomic mechanism that makes the same evidence recoverable before original cleanup. The feedback endpoint acknowledges a durable commit without waiting for a model or external service. Asynchronous processing starts on intake without a feedback-count or age threshold. Key work by the authoritative accepted event and serialize or version its effects per feedback to prevent stale workers from overwriting a newer outcome. Reuse the committed snapshot on retry. Technical failures may retry within bounded limits and surface a failed-processing state for operations. A valid inconclusive report ends the analysis attempt.

For Online, resolve the authorized answer and stored trace through `answerId`. For Local, use the immutable selected-turn evidence accepted by CTMS-072. Mark Local evidence as client-reported and show any unsupported or unavailable metadata as such. Process the question, answer and source material as untrusted data. Source excerpts must come from the execution evidence and be available under the applicable access and rights policy. Treat a rating as a signal and distinguish evidence from analyst inference. Check generated hypotheses against independent evidence, such as the recorded source, deterministic validation, a controlled reproduction or a qualified human review. A model repeating its own reasoning does not verify it.

## Investigation records and grouping

| Logical record | Required data or relationship |
| --- | --- |
| Investigation case | Internal case identity tied to the original `feedbackId`, original answer target, intake event, most recent applicable signal, report/snapshot references, review and technical history. The case remains traceable when the original row is gone. |
| Investigation Report | Issue type, submitted question and displayed answer, trace facts and availability, genuine relevant sources, related feedback and issue group references, cause hypothesis or `UNDETERMINED`, supporting/refuting evidence, confidence and unknowns, suggested remediation and optional test case. Cite original evidence and identify observations, hypotheses and independently verified findings. |
| Issue group | Group identity and suspected shared mechanism with evidence supporting the grouping. Each membership retains the original feedback reference. Uncertain or theme-only matches remain separate and may be listed as candidates. One-case groups are valid. A status change for a group does not silently complete its member cases. |
| Admin review record | On Unsafe cases, preserve the logical `pending → reviewing → actioned` lifecycle, reviewer, server timestamp, resolution note on completion and audit reference. The case retains the history after raw expiry. If the current `ai_answer_feedback.review_status` is projected from this workflow while the original exists, keep it consistent in the same transition. Not Useful-only cases have no Unsafe review state. |
| Technical disposition | Handoff reference, scope of verification, results and fix or documented no-fix rationale as applicable. Keep technical progress independent of Admin review status. A newly opened ticket is handoff evidence. A verified fix or substantiated alternative disposition is completion evidence. |

Admin reads the authorized queue and report, starts review, documents the technical handoff when necessary, and records the verified outcome or a justified disposition. An accepted Unsafe report is available for authorized review while analysis is still pending or has failed. Reject a stale or out-of-order review update. Persist the review state, reviewer/time, resolution note where required and audit atomically. Keep output as plain text and keep raw feedback out of audit and operational telemetry. The Developer performs technical verification and remediation in the existing engineering workflow. Jira issue keys, GitHub issue/PR references or the corresponding verification records can be added manually. Admin records outcomes and does not edit prompts, RAG, sources, code or models from this workflow. No Admin-triggered analyzer rerun is required.

## Investigation snapshot and retention

| Record | Retention and cleanup |
| --- | --- |
| Online answer and Online feedback | 30 days from the Online answer's persistence timestamp. Online feedback uses the answer's existing expiry. Deleting the Online answer cascades to its feedback under the current schema. |
| Local feedback | 30 days from initial server acceptance. Later feedback mutations do not extend the deadline. |
| Mutation receipts | Follow original feedback deletion through the existing cascading relationship. |
| Investigation Snapshot | Capture only case evidence needed for diagnosis. Preserve it while the case is open and apply the separately approved post-disposition retention and hold policy. The duration and exceptions remain open. |

The immutable snapshot freezes the reported question/answer, signal and relevant reason, observed times and internal linkage, available trace fields and the minimum genuine source evidence. Prefer exact digested artifact references. Retain a narrowly scoped excerpt only when necessary and permitted. Record artifact absence, legal/access restrictions and legacy gaps explicitly. A snapshot does not restore access to withdrawn or deleted source material or extend the public answer/citation endpoint. Keep snapshot lineage as durable references independent of the original feedback/answer cascade. Use evidence version references to avoid duplicating the same question, answer and source content for replays or related cases. Maintain only the report's needed copies after the original data expires.

Enforce backend case permissions for Admin and a scoped service identity for automation. Include only case-specific, minimized evidence in Developer handoffs. Limit investigation data to the reported turn and relevant technical facts. Avoid unrelated conversation, personal profile/health fields, credentials and raw location. Capture access and critical actions in audit with record references and minimal context. Render submitted text without interpreting markup. Access restrictions, permitted source copies and deletion/rights obligations still apply to snapshots and attachments.

Use a dedicated, retryable cleanup for closed evidence once eligible under an approved policy. Preserve evidence required by an open case or an approved hold. Delete eligible content, staging copies and obsolete artifact links, respecting other authorized references. Maintain an independent expiry review so inactive files do not result in indefinite raw retention. When content is removed, the remaining lineage or audit must indicate evidence is unavailable under its applicable policy. Open cases are not closed by a timer or by original-record expiry.

## CTMS-098 evaluation boundary

The case report may submit a candidate regression scenario containing minimized inputs, expected behavior, applicable evidence and the hypothesis it exercises. CTMS-098 independently approves case labels and sources and versions the benchmark dataset. CTMS-073 may reference an approved case ID or resulting run ID for technical verification. An investigation case or raw rating cannot set release Pass/Fail, mutate the benchmark, require a run or change a gate. The release benchmark can run with zero feedback. The current CTMS-051 embedding recall harness provides a retrieval baseline for future evaluation.

## Implementation handoff

| Owner | Checklist |
| --- | --- |
| CTMS-069 | Capture actual inference details at answer/turn completion. Resolve immutable artifacts, preserve the cited subset and keep the answer/source API unchanged. Test legacy records, replay and device-only inference. |
| CTMS-072 | Keep Online `answerId` resolution and the existing rating/Unsafe UI. Add only the optional allowlisted Local trace gap in the existing endpoint when the metadata can be captured. Keep legacy payloads, frozen evidence and idempotent offline queue behavior. |
| CTMS-073 | Design durable accepted-event capture, restricted snapshots, prioritized idempotent analysis, evidence-based grouping, audited review, manual Developer references and approved cleanup. Test expiry/cleanup races, missing evidence, conflicting findings, duplicate or reordered events, authorization and handoff without premature closure. |
| CTMS-098 | Accept independently validated candidate scenarios through dataset versioning. Reference benchmark versions and reports for a verified disposition when applicable. Run baseline/candidate comparison under existing gates without a feedback prerequisite. |

## Backend contract

The feedback transaction writes the accepted state, receipt, work item and first actionable snapshot together. Each work item is keyed by the original feedback and client mutation. Superseded work cannot replace the latest report. Useful-only work increments a UTC-day count of effective changes and clears its work item atomically. `CreateAiInvestigations1796500000000` creates the investigation tables independently from the 30-day answer and feedback relationships.

| Method and path | Contract |
| --- | --- |
| `GET /api/admin/ai-investigations` | Paginated `items`, `pagination` and optional `group` classification. Filters are `scope=ALL/UNSAFE`, optional `reviewStatus`, `groupId`, `page` and `limit`. The Unsafe queue prioritizes `pending`, then `reviewing`, then `actioned`. |
| `GET /api/admin/ai-investigations/:id` | Case, feedback and answer identifiers, processing/review/technical status, review version, selected-turn evidence, permitted source references, report, observation of recorded citation divergence, groups and review history. It indicates withdrawn evidence, absent legacy fields and evidence removed by policy. Detail reads record a case access audit. |
| `PATCH /api/admin/ai-investigations/:id` | `START_REVIEW` requires `version`. `HANDOFF` adds `reference` and `verification` (the work to verify). `RESOLVE` adds `disposition` (`VERIFIED_FIX` or `JUSTIFIED_NO_FIX`), the independent verification scope and result in `verification`, a nonblank `resolutionNote` and optional engineering `reference`. A successful write returns the case ID, new version and statuses. The server derives reviewer and time. |

Admin requests use the existing active-account JWT and Admin role guard. Unknown cases return `404`, malformed commands return `422`, and stale or invalid transitions return `409`. A resolution reference is a Jira issue key or issue URL, or a GitHub issue/PR URL. CTMS records the Admin's substantiation and provenance without calling those sites. The audit payload contains actor, target, timestamps and state changes. Reference, verification and resolution notes are available in the restricted case history.

CTMS sends a bounded investigation payload to the existing AI service through `POST /internal/feedback-investigation`. The service uses `AI_SURVIVAL_PROVIDER` (`openai` or `gemini`) and `AI_SURVIVAL_MODEL`. It sends the instruction and evidence in separate message roles, validates structured output and checks referenced evidence IDs against the actual inputs. Model output is stored as observations and hypotheses. An absent, weak or conflicting basis yields `UNDETERMINED`. Recorded citation divergence can be checked independently by comparing the saved retrieved and cited sets. Cases share a group only for the same deterministic divergence signature (recorded retrieval/prompt versions and the same unmatched citation identity). Other findings have singleton groups. Candidate regression scenarios remain part of the report.

The provider configuration is opt-in through `AI_INVESTIGATION_PROVIDER_ENABLED` on the API and AI services. Actionable jobs stay pending with the configuration off. With it on, a failing attempt can retry up to three total attempts. Current, exact chunk references resolve under the existing publication and rights rules. Sending bounded excerpts of eligible current sources requires `AI_INVESTIGATION_SOURCE_EXCERPTS_ENABLED`. Historical source text is never copied into the snapshot. A report derived from a source that subsequently becomes unavailable is withheld in the detail response.

`AI_INVESTIGATION_CLOSED_RETENTION_DAYS` has no default. An approved value enables cleanup of closed snapshots, report text and feedback reasons for eligible cases without a retention hold. Cleanup leaves the technical disposition, lineage and audit intact. Management of holds, account erasure, historical source access and rollout backfill remain subject to the open decisions below.

| Verification | Test suites |
| --- | --- |
| Feedback effect, priority, output validation, grouping and review policies | `ai-investigation.spec.ts`, `test_feedback_investigation.py` |
| PostgreSQL commit/rollback, replay, lease fencing, grouping, expiry, holds and audited review | `ai-investigations.integration-spec.ts` |
| HTTP authorization, Unsafe queue, legacy evidence, handoff, conflict and completion | `ai-investigations.e2e-spec.ts` |

## Open decisions

- Snapshot and referenced artifact retention duration after closure, holds and review cadence for long-open cases, person/account deletion handling and approved audit lineage after content removal.
- Approved scope for historical source excerpts and provider processing, including withdrawn or deleted content and case-specific disclosure to Developers.
- Runtime/provider visibility of verified revisions, stage parameters, build IDs and seeds. Trace shape, bounds and resolver implementation after capability checks.
- Final schema and internal event/admin API shapes, analyzer execution limits, independent verification policy for safety-critical findings and a compatible backlog approach for retained feedback accepted before rollout.
- Manual handoff remains sufficient. Jira/GitHub automation, authentication, permissions, data export and status sync require approval and implementation. Unsafe withdrawal and specific downstream remedies remain open.
