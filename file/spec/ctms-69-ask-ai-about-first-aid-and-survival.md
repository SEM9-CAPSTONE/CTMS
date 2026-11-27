# CTMS-069 — Ask AI About First Aid and Survival

## 1. Overview

Story: CTMS-069 ([Jira CTMS-257](https://thuha140105.atlassian.net/browse/CTMS-257))

Epic: EPIC 11. AI Survival Assistant and RAG

Use Case: Ask AI About First Aid and Survival

Priority: Must Have

Goal: Provide first-aid and survival guidance through the existing Camper chat. Online answers are grounded in the configured CTMS knowledge base. A supported device can provide offline guidance without overriding authoritative safety/business rules.

Backlog story: As a Camper, I want to ask the AI assistant about first aid and survival online or offline so I can receive useful guidance during trekking.

Acceptance Criteria:

| Source  | Criterion                                                                     |
| ------- | ----------------------------------------------------------------------------- |
| PB AC-1 | Online AI answers first-aid/survival questions using the configured CTMS knowledge base. |
| PB AC-2 | Applicable RAG context is used for grounded online answers.                   |
| PB AC-3 | Answer follows applicable safety constraints.                                 |
| PB AC-4 | AI does not override authoritative state or hard Business Rules.              |
| PB AC-5 | Response targets the configured operational latency requirement.              |
| PB AC-6 | Source provenance used by the answer remains available for CTMS-071.          |
| Jira AC-1 | Camper can submit first-aid and survival questions in the existing AI Chat interface. |
| Jira AC-2 | Online AI uses the approved CTMS knowledge base and RAG when available. |
| Jira AC-2 / BR-549 | A grounded online answer can use approved foreign-language evidence and is verified in the requested response locale. |
| Jira AC-3 | Offline AI can generate natural-language answers with an installed local model. |
| Jira AC-4 | General offline AI Chat works without a Trip Offline Package. |
| Jira AC-5 | Offline inference does not call remote APIs or cloud LLM services. |
| Jira AC-6 | Verified local knowledge and saved Trip data may be used as additional context when available. |
| Jira AC-7 | Missing models, unsupported devices and inference failures have a clear recovery path. |
| Jira AC-8 | The Camper's conversation history survives online/offline transitions. |
| Jira AC-9 | AI-generated responses must not be falsely presented as verified CTMS guidance. |
| Jira AC-10 | Existing online chat and RAG behavior continue to work. |
| Trace AC-1 / BR-517 | Each completed Online answer keeps the trace of the inference that produced it. |
| Trace AC-2 / BR-518 | A trace resolves exact versioned inputs when available and identifies evidence that cannot be resolved. |
| Trace AC-3 / BR-519 | Each completed Local reply records the conditions of that turn on the device. |

## 2. Scope

### In Scope

- First-aid questions.
- Survival questions.
- Natural-language RAG-grounded AI response.
- On-device inference and local model setup in the existing chat.
- Optional use of a verified active Trip package as local context.
- Conversation continuity during online/offline transitions.
- Safety constraints.
- Source provenance.
- Inference Trace capture for completed Online and Local answers. The trace extension is a design requirement described in §8–9.
- Operational latency target.

### Out of Scope

- Emergency handling policy and SOS activation — CTMS-075 and CTMS-074/076.
- Standalone keyword/full-text search from the retired CTMS-070 scope.
- Model training, fine-tuning or a separate offline chat screen.
- Changing Weather Risk, Route or Trip state.
- Feedback collection and sync (CTMS-072), investigation and evidence retention (CTMS-073), and release evaluation (CTMS-098).

## 3. Actors & Authorization

- Camper.
- AI assistant.
- RAG subsystem.

Chat requires a recognized Camper session. The server checks the account status and role for online requests and the answer owner for source reads. A known authorization denial cannot be bypassed by switching modes.

## 4. Preconditions & Dependencies

Dependency:

- CTMS-068.

Configured knowledge base/RAG is available for online AI operation. Current source eligibility follows CTMS-050/051. CTMS-075 governs emergency handling in both modes.

On-device generation requires an active model installed on a compatible device. A Trip package is optional. When chat reads a saved Trip, it uses the account-scoped active package for the exact Trip and version through CTMS-054/055.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                           |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BR-249 | The AI assistant must answer first-aid and survival questions using the configured CTMS knowledge base within the operational latency target and must comply with applicable safety constraints.                               |
| BR-216 | AI/RAG may provide recommendations and explanations only. It must not override hard rules or authoritative state such as a closed/archived Route, Trip capacity, payment outcome, Weather Risk score/level, or access control. |
| BR-248 | RAG may retrieve only relevant knowledge chunks within the configured context limit, must preserve source references, and must not send unrelated knowledge to the language model.                                             |
| BR-172 | Access control must be enforced by the backend using role, ownership, and business scope. Hiding or disabling functionality in the UI is not a substitute for backend authorization. |
| BR-178 | Operations that may be retried, including payments, refunds, callbacks, and synchronization, must support idempotency so the same request cannot be successfully applied more than once. |
| BR-232 | The client/system must verify the checksum before using a package. An invalid package must transition to failed and support redownload. The system must not invent a corrupted status if the enum does not support it. |
| BR-233 | Downloaded Route, Checkpoint, and survival-guidance data must remain usable in airplane/offline mode without calling an online API and must correspond to the exact Trip/package version. |
| BR-251 | An AI answer must display the actual document/source category present in retrieval metadata and must not invent or cite a source that was not used. |
| BR-255 | Emergency-question detection must recognize configured danger signals in the user's question, provide concise priority guidance, and surface SOS/current-location actions when an emergency is detected. |
| BR-488 | A grounded online answer must synthesize the evidence in natural language. |
| BR-491 | On-device inference requires a supported device. |
| BR-492 | A model artifact must match its trusted release checksum before activation. |
| BR-493 | Local inference may read only an active model artifact. |
| BR-494 | General offline chat must remain usable without a Trip package. |
| BR-495 | An offline inference turn must make no remote requests. |
| BR-496 | A model download must start only on an explicit Camper action. |
| BR-497 | An answer based solely on pretrained knowledge must not be presented as verified CTMS guidance. |
| BR-499 | Automatic fallback after an attempted online request is allowed only when the connection failed before the request could reach the service. |
| BR-500 | Completed turns must be retained when the chat changes inference mode. |
| BR-502 | The local chat transcript must be accessible only to its originating Camper account. |
| BR-503 | Reconnection must not upload local conversation history automatically. |
| BR-504 | A failed model replacement must preserve the previously usable active artifact. |
| BR-505 | A model install may stage a download only when sufficient device storage is available. |
| BR-507 | An AI answer may present operational conditions as current only with live authoritative evidence. |
| BR-517 | Each newly persisted Online answer must record the actual inference conditions that produced that answer. |
| BR-518 | A versioned input referenced by an Inference Trace must resolve to its exact immutable artifact or be marked unavailable. |
| BR-519 | Each completed Local turn must capture its actual inference conditions on-device as part of that turn. |
| BR-549 | A grounded Online response must be verified in the requested response locale. |
| BR-550 | Online citations retain the original locale of the source version cited. |

BR-249's knowledge-base and operational latency requirements apply to the online path.
Its safety requirements apply in both modes. CTMS-098 owns the approved release thresholds.

## 6. State & Lifecycle

Question
→ RAG retrieval
→ AI generation
→ safety-constrained answer
→ display answer/source context.

Offline question
→ local eligibility check
→ on-device inference or supported saved-package lookup
→ safety-constrained reply or recovery state.

Local model setup
→ download to staging
→ verify and probe runtime
→ activate.

A failed install leaves the preceding usable model active.

No authoritative business-state transition occurs.

## 7. Business Flow

1. Camper asks a question in the existing chat.
2. Apply [CTMS-075](ctms-75-detect-emergency-questions.md) before inference selection. Continue this flow only when the safety assessment permits ordinary inference. CTMS-075 owns immediate guidance, safe fallback and eligible SOS handoff. This step preserves the existing retry and engine-fallback constraints.
3. For an authorized online turn, retrieve relevant CTMS knowledge and construct bounded context.
4. Generate a natural-language response and check its claims against the cited evidence. Preserve applicable conditions and warnings.
5. Apply safety constraints and preserve actual source references. Return the answer and make source metadata available for source display/feedback.
6. For an eligible offline turn, use the active on-device model for general questions. If the turn requests supported saved Trip context, use the verified active package for the selected Camper, Trip and version. Keep saved-package facts labeled as snapshot data.
7. Show the reply or a recovery action in the same transcript. A completed turn remains visible when the next turn switches modes.

The trace extension records Online evidence with the successful answer write and Local evidence at turn completion. Online replays return the original result under the existing replay checks. A failed or refused turn without a completed answer remains outside the rateable-answer contract. Emergency handling still runs through CTMS-075.

When a model is missing, the Camper may start the model download while online. Show the download size and progress. Check available storage, verify the staged artifact and test runtime compatibility before activation.

## 8. Data & Invariants

- AI answer is advisory.
- AI cannot reopen Route.
- AI cannot change risk score/level.
- AI cannot change capacity/payment/access rights.
- Sources must come from actual retrieval.
- Lack of grounding must not be hidden with fabricated source.
- Model artifacts are stored separately from Trip packages. The device transcript is scoped to the current Camper session and does not sync automatically on reconnect.
- Saved Trip metadata identifies the snapshot. Live route, hazard, weather and SOS status remain with their authoritative workflows.
- Reuse the accepted question, displayed answer, retrieved evidence and cited IDs as the trace's answer link. Record the actual provider/model and revision when exposed, generation and verification prompt artifacts, effective settings, retrieval configuration and safety policy versions. Use immutable version references and record missing evidence explicitly. `created_at` is the existing persistence time. Capture inference time separately in the trace extension.
- A Local trace is bound to the selected account and turn. Capture the active model and observed runtime/configuration on the inference path. A verified package lookup records the package ID/version only if it was used. Lookup-only replies have no model invocation. Pretrained-only replies carry no CTMS citation.
- Reproducibility means reconstructing the recorded conditions and attempting a rerun. Hosted revisions, removed artifacts and nondeterministic generation may limit what can be reconstructed or reproduced.

## 9. API / Integration Contract

An active Camper submits `{ question, locale, requestId }` to `POST /api/ai/answers`.
CTMS-068 provides current eligible evidence, including evidence in other supported languages.
The server-side model synthesizes an answer in the requested locale and identifies the chunks used.
The service verifies grounding, language and retention of material warnings against the original passages.
The API checks the cited IDs and revalidates the
retrieval snapshot before storing and returning the answer. Replaying a request uses
the same request ID and remains subject to the source and ownership checks. The
Flutter client updates the same chat turn when the retry completes.

`ANSWERED` contains the answer ID and cited source snapshots. `INSUFFICIENT_CONTEXT`
and `REFUSED` return empty sources and no answer. Operational failures use stable HTTP
error codes. The answer owner can read recorded source metadata for 30 days through
`GET /api/ai/answers/:answerId/sources`.

The [source panel in CTMS-071](ctms-71-view-knowledge-sources-for-ai-answers.md)
uses the citations returned with the completed chat reply. The source endpoint reads
historical snapshots for the owner and omits entries with unavailable provenance.
A citation keeps the source's original locale, title, exact version, page and chunk references.
A POST replay with incomplete cited provenance returns `INSUFFICIENT_CONTEXT`.

A local reply uses the local turn identity and has no server answer ID. Pretrained-only
replies carry no CTMS citation. Answers using verified snapshot evidence may show
only provenance for content actually used. Local answers do not call the server's
source endpoint. When the Camper submits feedback under [CTMS-072](ctms-72-rate-ai-answers.md),
only the selected turn's question, answer and permitted trace metadata are eligible for feedback delivery.
BR-503 continues to apply to the chat transcript. New Online answers retain the
question with their existing, time-limited server answer record for authorized review.

The Online public response and source endpoints keep their existing shape. CTMS-072 resolves the Online trace internally by `answerId`. The [Inference Trace data contract](../../docs/features/CTMS-069-Implementation.md#inference-trace-extension-design) distinguishes current fields from planned additions and specifies the 30-day Online boundary, Local compatibility and handoff to CTMS-073.

See the [implementation and verification contract](../../docs/features/CTMS-069-Implementation.md).

## 10. Error & Edge Cases

| Case                        | Expected Behavior                                     |
| --------------------------- | ----------------------------------------------------- |
| No relevant knowledge       | Do not fabricate grounded source                      |
| AI conflicts with hard rule | Hard rule wins                                        |
| AI service unavailable      | Return safe failure/fallback                          |
| Emergency-like question     | Use CTMS-075 emergency handling before choosing an engine     |
| Model invents source        | Must not expose invented source as retrieval evidence |
| Missing model or unsupported device | Keep prior turns and offer download or online recovery as applicable |
| Corrupt, interrupted or failed model update | Do not activate the replacement. Keep the working model available |
| Wrong account, Trip or package version | Do not use the snapshot as chat context |
| No connection can be established | Use local inference if the session and model are eligible |
| 401, 403, explicit refusal or ambiguous timeout | Preserve the original outcome and online retry identity |
| Historical answer, opaque provider revision or expired artifact | Use valid retained evidence and identify what is missing. Preserve the stored answer and existing source visibility. |

## 11. Acceptance & Test Matrix

| Source  | Scenario                                | Expected Result                  | Test Type    |
| ------- | --------------------------------------- | -------------------------------- | ------------ |
| BR-249  | Survival question                       | Grounded answer                  | AI E2E       |
| BR-249  | First-aid question                      | Safety constraints applied       | AI Safety    |
| BR-216  | Prompt asks AI to override closed Route | No override                      | Safety       |
| BR-248  | Answer uses chunks                      | Provenance preserved             | Traceability |
| PB AC-5 | Normal request                          | Evaluated against latency target | Performance  |
| Jira AC-1 | Signed-in Camper submits a first-aid question in the existing chat | The existing chat accepts the question | Flutter widget |
| Jira AC-1 / BR-172 | Unauthenticated or unauthorized caller submits a question | Reject the request | HTTP E2E |
| Jira AC-2 / BR-488 | Current approved chunks support a survival answer | Natural-language synthesis retains the approved evidence and warnings | API E2E / Python |
| BR-549 | Vietnamese answer with English evidence, or a draft whose translation loses a material warning | Accept the supported Vietnamese answer or withhold the unverified draft | PostgreSQL integration / Python |
| BR-550 | Retrieve historical citations for a Vietnamese answer supported by an English document | Preserve the recorded English locale, exact version and page references | HTTP E2E |
| Jira AC-2 / BR-249 | Evidence is withdrawn or the draft adds an unsupported claim | Withhold the grounded answer | PostgreSQL integration / Python |
| Jira AC-3 / BR-493 | A compatible device has an active model | Generate an eligible answer in airplane mode | Device trial |
| Jira AC-3 / BR-492 | The downloaded model has the wrong checksum | Reject activation | Flutter unit |
| Jira AC-4 / BR-494 | No Trip package has been downloaded | General offline inference remains available | Device trial |
| Jira AC-4 / BR-507 | An offline question requests current hazards without live evidence | No guessed live hazards | Safety |
| Jira AC-5 / BR-495 | Block network access during local inference | Answer succeeds without remote calls | Device trial |
| Jira AC-5 / BR-503 | Reconnect after offline turns | No earlier local conversation is uploaded | Flutter widget |
| Jira AC-6 / BR-232 / BR-233 | Read the current Camper's verified active Trip package | Return its saved checkpoint count and label the snapshot version | Flutter integration |
| Jira AC-6 / BR-232 / BR-233 | Wrong account, Trip or version, or a corrupt ZIP | Do not use the package as chat context | Flutter integration |
| Jira AC-7 | Camper installs a supported model and retries a failed turn | The same turn can succeed without losing prior messages | Flutter widget / device trial |
| Jira AC-7 / BR-491 / BR-504 | Model missing, unsupported or fails a replacement probe | Show recovery without claiming success. Keep a previously working model available | Flutter unit / device trial |
| Jira AC-8 / BR-500 | Alternate online and offline turns | Completed turns remain in one transcript | Flutter widget |
| Jira AC-8 / BR-178 / BR-502 | A response arrives late after retry or account switch | No duplicate reply or prior-account history | Flutter widget / API integration |
| Jira AC-9 / BR-497 | A pretrained-only question is answered | Display a general AI suggestion | Flutter widget |
| Jira AC-9 / BR-251 | An unused source is offered for citation | Display only the sources used | API / Flutter widget |
| Jira AC-10 / BR-178 | Replay the same online request ID | Return a single stored result under the existing contract | PostgreSQL integration |
| Jira AC-10 / BR-499 | The server returns 401 or 403, refuses, or times out ambiguously | Keep the online outcome without automatic fallback | Flutter widget |
| BR-255 | Configured emergency signal with either engine unavailable | Prioritize CTMS-075 handling independently of generation | Flutter widget |
| BR-517 | New Online answer, request replay, or persistence failure | Write trace with the original answer using actual conditions. Replay keeps that trace and a failed write leaves no partial trace. | PostgreSQL integration / provider contract |
| BR-518 | Artifact changes, source is withdrawn, or a legacy reference cannot resolve | Resolve the original immutable artifact when permitted. Record unavailability and reject a different revision as evidence. | Contract / integration |
| BR-519 / BR-495 / BR-503 | Native inference, checkpoint lookup, missing runtime metadata and reconnect without feedback | Bind observed facts to the exact turn. Track only a used package, omit unavailable model/runtime facts and make no inference call or transcript upload over the network. | Flutter integration / device trial |

The [BR audit](../../docs/business-rules/ctms-257-hybrid-chat.md#active-hybrid-specific-keys)
records a valid and violation case for each hybrid-specific rule.

## 12. Open Decisions

Configure an approved OpenAI or Gemini model on the server. The production release gates,
including online P95 of 5 seconds, are in [CTMS-098](ctms-98-evaluate-ai-survival-assistant.md).

Before enabling on-device inference by default, verify native builds and inference with
network access blocked on physical iOS and Android. Record model version, download
size, memory, latency, throughput, Vietnamese response quality and safety results under
CTMS-098. The current Trip lookup covers checkpoint count. Open-ended synthesis and
citations from saved Survival Guidance remain outside the verified behavior.

Confirm which exact revision, seed, runtime build and effective parameters each provider or native runtime exposes. Choose artifact storage and disappearance handling under existing source rights. See the technical contract for the remaining decisions.
