# CTMS-075 — Detect Emergency Questions

## 1. Overview

Story: CTMS-075 · Jira: [CTMS-263](https://thuha140105.atlassian.net/browse/CTMS-263)

Epic: EPIC 12. SOS and Emergency Management

Use Case: Detect Emergency Questions

Priority: Must Have

Scope status: In product scope. Implementation and release verification are pending.

Goal: Recognize potentially dangerous incidents described in Survival Assistant conversations and surface approved safety guidance and eligible emergency actions in time, including when disconnected.

Backlog story: As a Camper, I want the assistant to recognize a potentially urgent incident in my questions so I can find immediate guidance and access SOS when eligible.

Acceptance Criteria:

| Source | Criterion |
| --- | --- |
| PB AC-1 / AC-01–05 | Classify approved danger signals in context, including incidents affecting another person, uncertainty and follow-up information. |
| PB AC-2 / AC-04, AC-07–10 | Prioritize concise, approved emergency guidance before ordinary answer generation, including offline and degraded conditions. |
| PB AC-3 / AC-11–13 | Surface an accessible SOS entry point when eligible and retain independent access to the existing SOS flow. |
| PB AC-4 / AC-10 | Surface current location when available and authorized. Otherwise show last-known information with its age where applicable, or show that location is unavailable. |
| PB AC-5 / AC-11–13 | Require separate Camper initiation through the existing SOS workflow and distinguish assessment from delivery and acknowledgment. |
| Jira AC-5 / AC-03, AC-05, AC-07 | Handle missing or uncertain context explicitly. |

## 2. Scope

### In Scope

- Emergency detection for supported Survival Assistant inputs in both connected and disconnected use.
- Intent, severity, assessment completeness, reassessment, approved Emergency Protocol content and safe fallback.
- Safety checks before inference and before generated content is shown.
- An accessible handoff to existing SOS and location capabilities.

### Out of Scope

- SOS transport, a new offline queue, replay eligibility, new expiry/reconfirmation policy, idempotency changes, cancellation, acknowledgment and other SOS lifecycle changes.
- Satellite communication, SMS or any new rescue transport. GPS supplies location only.
- New health-profile, location, terrain or weather integrations and expanding the accounts, roles or consent under which context can be accessed.
- Medical diagnosis, prescribing, safety certification, a new chatbot, general RAG changes and unrestricted offline medical advice.

## 3. Actors & Authorization

- Camper, who can describe their own situation or someone else's, request guidance and independently initiate an eligible SOS.
- Survival Assistant, which applies the safety assessment and selects the applicable response path.
- Approved safety-content owners and qualified reviewers, who approve protocol and policy versions before release.
- Existing SOS workflow, which owns Trip eligibility, confirmation, persistence, sync and lifecycle. Authorized Host acknowledgment remains under CTMS-080.

## 4. Preconditions & Dependencies

A Camper submits a supported question through the existing assistant. The assessment and essential guidance require no connectivity, model, saved Trip package, GPS fix or medical profile. Existing chat access and account-scoping checks still apply.

| Story | Integration |
| --- | --- |
| [CTMS-069](ctms-69-ask-ai-about-first-aid-and-survival.md) | Existing mobile and API assistant surfaces invoke CTMS-075 before normal Hybrid AI Chat inference. The normal path retains existing grounding, refusal, retry and mode-fallback contracts. |
| [CTMS-050](ctms-50-manage-survival-documents.md), [CTMS-051](ctms-51-split-documents-into-knowledge-chunks.md), [CTMS-068](ctms-68-use-retrieval-augmented-generation-rag.md), [CTMS-071](ctms-71-view-knowledge-sources-for-ai-answers.md) | Own source eligibility, provenance, retrieval and citations for existing generated answers. Essential approved protocol content is available independently. |
| [CTMS-074](ctms-74-send-sos-alert-in-an-emergency.md), [CTMS-076](ctms-76-create-sos-alert-while-offline.md), [CTMS-077](ctms-77-cancel-accidental-sos-alert.md), [CTMS-080](ctms-80-acknowledge-and-close-sos-handling.md) | Own SOS initiation, offline persistence and sync, cancellation and Host acknowledgment respectively. Chat consumes the existing handoff and status contract. |
| [CTMS-009](ctms-09-store-important-health-information.md) | Existing health privacy rules apply. This story requires no health-profile lookup or new sharing. |
| [CTMS-098](ctms-98-evaluate-ai-survival-assistant.md) | Owns existing AI release metrics and thresholds. CTMS-075 adds story-level acceptance evidence. |

## 5. Business Rules

| BR | Rule |
| --- | --- |
| BR-255 | Emergency-question detection must recognize configured danger signals in the user's question, provide concise priority guidance, and surface SOS/current-location actions when an emergency is detected. |
| BR-216 | AI/RAG may provide recommendations and explanations only. It must not override hard rules or authoritative state such as a closed/archived Route, Trip capacity, payment outcome, Weather Risk score/level, or access control. |
| BR-551 | Supported assistant turns must be assessed before inference selection. Assessment uses available intent, timing, negation, affected person and relevant conversation context. A keyword match alone cannot determine severity. Apply the assessment before a mobile submit or retry can initiate inference and at the online API before generation. |
| BR-552 | A credible approved serious danger signal takes precedence over scoring, clarification and generation. Show the applicable emergency response immediately. User instructions and model output cannot override the safety policy or independently downgrade an emergency. |
| BR-553 | Record assessment completeness separately from severity. Missing or ambiguous incident evidence must not default to NORMAL. Reassess on relevant follow-up information and escalate immediately when a serious danger signal is established. |
| BR-554 | Emergency Protocol and warning/fallback guidance must use fixed, versioned approved content with traceable source and qualified review. The essential Emergency Protocol must be available on the device without connectivity, inference or a Trip package. Generated text cannot rewrite its core instructions. |
| BR-555 | When eligible evidence is missing, inference fails, or the output fails the safety check, withhold the unsupported reply and show an applicable approved safe fallback. This guidance does not authorize another inference attempt or override the normal mode-fallback contract. |

Shared rules applied by reference:

| BR | Owner or consumer | Application |
| --- | --- | --- |
| BR-172, BR-186, BR-187, BR-192 | CTMS-009 and relevant access/audit specs | Enforce access and consent within existing boundaries. Minimize sensitive data and exclude raw health/location details from CTMS-075 telemetry. |
| BR-227, BR-228, BR-248, BR-251 | CTMS-050, CTMS-051, CTMS-068, CTMS-071 | Preserve approved source eligibility, provenance, grounded retrieval and actual citations on the existing answer path. |
| BR-249, BR-495, BR-497, BR-499, BR-507 | CTMS-069 | Apply answer safety before display, preserve offline network isolation, identify unverified answers accurately, respect mode-fallback eligibility and require authoritative live evidence for current operational claims. |
| BR-254, BR-256, BR-257, BR-244, BR-258, BR-261 | CTMS-074, CTMS-076, CTMS-077, CTMS-080 | Use the existing SOS authorization, location, offline queue, idempotency, cancellation and Host acknowledgment behavior. |
| BR-212, BR-213, BR-279, BR-282 | Shared documentation/verification rules and CTMS-098 | Maintain valid and violation evidence and observe the existing release gate and versioned evaluation contract. |

## 6. State & Lifecycle

| Severity | Decision and response |
| --- | --- |
| NORMAL | Knowledge or prevention question with no evidence of an unresolved incident, or another question eligible under approved policy. Continue the existing assistant flow. This classification is never a safety certification. |
| WARNING | A possible ongoing incident with uncertain severity. Show approved cautious guidance, ask a short clarifying question and reassess when the Camper responds. |
| EMERGENCY | A serious approved signal or credible imminent danger. Show the applicable protocol immediately. Offer eligible SOS and location actions through their owning workflows. |

Assessment completeness is independent. A clear serious signal may coexist with incomplete information. For an unclear incident without a serious signal, present the uncertain WARNING path and use approved fallback if classification or content selection cannot finish. Emergency guidance remains available while the user reviews or initiates SOS.

SOS delivery state is independent of this assessment. A local `pending` record is queued on the device. A confirmed server `active` record has been accepted by the system. The authoritative `acknowledged` state establishes Host acknowledgment. Honor `failed` as a local sync outcome and `cancelled` or `closed` as existing authoritative outcomes. An unconfirmed timeout is unresolved until the owning workflow confirms the outcome.

## 7. Business Flow

| Use case | Main and alternate flow |
| --- | --- |
| UC-01 — Knowledge or prevention | Assess the turn. If NORMAL, hand it to CTMS-069. Validate generated content before display. Show approved fallback when evidence, inference or output checks fail. |
| UC-02 — Unclear incident | Present a WARNING or explicitly uncertain assessment with approved guidance. Ask a concise question if clarification can help. Reassess on follow-up. Escalate immediately if a credible serious signal appears. |
| UC-03 — Current emergency | Present the applicable fixed protocol immediately, independently of model output. Offer an accessible SOS action when eligible and current location when available and authorized. Opening SOS leads to the existing confirmation workflow. Only the Camper's separate initiation can create a request. |
| UC-04 — Disconnected or degraded | Apply the same essential assessment and device-resident guidance. Recover safely if the model, network, location or Trip package is unavailable. Present approved local guidance and available contact options. If the Camper confirms an eligible offline SOS, hand off to the existing queue and show its actual state. |

The [sequence diagram](../../docs/sequence-diagrams/CTMS-75-Detect-Emergency-Questions.drawio) illustrates the flow. Existing SOS can also be opened directly from its current entry points.

## 8. Data & Invariants

- The assessment needs intent, severity, completeness, an explainable reason, the selected protocol reference when applicable and the evaluated policy version. These are business semantics. Public fields, enums and persistence are deferred to technical design.
- Use only available, permitted context. When using existing operational context, preserve source, timestamp and location accuracy when available. Mark saved data as historical or last known. An unavailable fix is explicit. Cached evidence alone cannot establish current conditions, a safe evacuation route or drinking-water suitability.
- Existing account boundaries apply to conversation context. Release evidence should use approved, labelled fixtures. Any diagnostic evidence must be minimal, with no raw symptoms, coordinates or medical-profile payloads in safety telemetry.
- Verify the protocol source, version and approval before presenting it as approved. Missing approval is a release blocker. Normal chat replies retain existing answer/source/feedback semantics.

## 9. API / Integration Contract

- FR-01 — Assess supported client submits and retries before inference routing. Assess eligible direct online requests before generation at the API boundary. A client-supplied classification is advisory to the server.
- FR-02 — Recognize knowledge, prevention, current incidents affecting self or others, rescue requests and unclear intent. Evaluate Vietnamese with and without diacritics and representative spelling errors using approved fixtures. Reassess relevant follow-ups.
- FR-03 — Route NORMAL, WARNING, EMERGENCY and incomplete assessments as specified in §6. Preserve serious-signal precedence under input attempts to override policy and under model failure.
- FR-04 — Deliver accessible, concise Emergency Protocol and warning content from approved versions. The essential device-resident path works in airplane mode with no model or Trip package.
- FR-05 — Apply the existing AI safety constraints before displaying generated output, including any future streaming presentation of this path. Withhold unsupported or protocol-conflicting output, diagnoses, prescriptions, safety assurances and advice to continue dangerous activity. Use approved fallback without broadening local inference or bypassing refusal, authorization or the existing transport-fallback rules.
- FR-06 — Use the present SOS and location entry points and their authorization. Chat performs no SOS creation or sync. Display only supported contact options and confirmed state. Keep direct SOS available. User-facing wording and accessible labels support natural Vietnamese.
- FR-07 — Record policy/protocol versions in verification evidence. Apply qualified review and the story-level release checks before deployment.

This story changes no SOS contract, schema or lifecycle. Specific assistant response fields and protocol distribution details remain technical design decisions after audit acceptance.

## 10. Error & Edge Cases

| Case | Expected Behavior |
| --- | --- |
| Prevention, hypothetical, negated or resolved context mentions a danger term | Interpret in context. Continue normal chat only when eligible. |
| Missing or ambiguous incident context | Surface uncertainty and approved guidance. Avoid a NORMAL default. |
| Credible serious signal while information is missing | Show the protocol immediately. |
| Model, network, Trip package or optional location unavailable | Essential safety path still works. Show missing context explicitly. |
| No approved eligible evidence, unsafe output, inference error or timeout | Withhold unsupported output and offer approved guidance. Preserve existing retry and mode restrictions. |
| SOS ineligible or no supported connection | Display existing eligibility and delivery state. Continue showing approved guidance. |
| SOS queued, delivery timeout or backend acceptance without Host acknowledgment | Report known state only. Existing SOS owns retry and acknowledgment. |

## 11. Acceptance & Test Matrix

| Source | Scenario | Expected Result | Test Type |
| --- | --- | --- | --- |
| AC-01 / FR-01–03 / BR-255, BR-551 | Knowledge or prevention, including an emergency word | Eligible NORMAL enters CTMS-069 with no SOS side effect. | Unit / mobile |
| AC-02 / FR-02 / BR-551 | Negated, hypothetical, past and third-person contexts. Vietnamese with/without diacritics and spelling errors | Match labelled intent, timing and affected person. Never use keywords alone to declare an emergency. | Labelled unit / mobile |
| AC-03 / FR-02–03 / BR-553 | Mild, ambiguous or incomplete incident | WARNING or explicit uncertainty with approved guidance and a concise follow-up. | Unit / mobile |
| AC-04 / FR-01, FR-03–04 / BR-255, BR-551, BR-552, BR-554 | Approved emergency fixture with a single serious signal and other inputs missing | Immediate fixed guidance before generation, independently of further answers, including for another person. | API integration / mobile |
| AC-05 / FR-02–03 / BR-552, BR-553 | WARNING followed by corroboration of a serious signal | Reassess and escalate immediately. | Multi-turn integration / mobile |
| AC-06 / FR-01, FR-03 / BR-216, BR-551, BR-552 | Override request, model downgrade, retry or direct API call | The safety decision cannot be bypassed or downgraded by user content or generation. | API integration / mobile |
| AC-07 / FR-05 / BR-249, BR-499, BR-554, BR-555 | Empty or invalid evidence, failed inference or refusal | Withhold unsafe/unsupported content. Use approved guidance without initiating an unauthorized model fallback. | API integration / mobile |
| AC-08 / FR-05 / BR-249, BR-497, BR-554, BR-555 | Generated content conflicts with approved instructions or claims unsupported advice | Block before display. Use approved fallback and keep the core protocol intact. | Safety evaluation / UI |
| AC-09 / FR-04 / BR-495, BR-554 | Airplane mode, unavailable model and absent Trip package | Essential protocol remains available with no remote call. An unapproved protocol cannot pass release checks. | Offline device / content verification |
| AC-10 / FR-06 / BR-172, BR-186, BR-255, BR-507 | Authorized current GPS, denied or missing GPS, or stale operational data | Show supported context with freshness/accuracy as available. No fabricated coordinates or live claims. | UI / contract |
| AC-11 / FR-06 / BR-216, BR-254, BR-255 | Open emergency guidance and SOS, abandon confirmation, or start SOS directly | Accessible eligible handoff. Assessment or navigation alone creates nothing. Direct SOS remains usable. | UI / E2E |
| AC-12 / FR-06 / BR-244, BR-256, BR-257 | Explicit confirmation while offline, timeout or existing queue reconnect | Pending or unresolved stays distinct from confirmed delivery. Existing idempotent sync retains the same request identity. | Offline integration / E2E |
| AC-13 / FR-06 / BR-258, BR-261 | Backend accepts, then Host acknowledges or SOS is cancelled/closed | Display server acceptance and acknowledgment separately. Respect later authoritative status. | Contract / UI |
| AC-14 / FR-07 / BR-186, BR-187, BR-192, BR-212, BR-213, BR-279, BR-282, BR-554 | Approved rule, protocol and labelled regression set with authorized or withdrawn context access | Record source, versions and evidence. Limit sensitive data. Block release on an unapproved protocol or critical mandatory-suite failure. | Review / privacy / evaluation |

Report emergency recall, false-negative and false-positive rates, unsafe-response rate, groundedness, latency, offline reliability and SOS status accuracy with dataset and policy versions. Story release requires no critical failures in the approved mandatory scenarios. CTMS-098 retains its existing numerical gates. Other thresholds require agreement before use as release gates.

## 12. Implementation and Release Dependencies

- The [implementation evidence](../../docs/features/CTMS-075-Implementation.md) describes policy versioning, app-bundled protocol distribution, the transient assessment contract and the test results.
- Qualified reviewers must approve the danger-signal policy, protocol and fallback content and mandatory regression suite before production activation.
- The approved CTMS-075 scope preserves CTMS-076 reconnect behavior, including existing retries and request identity. Expiry, mandatory reconfirmation and automatic cancellation remain separate CTMS-076 decisions.
