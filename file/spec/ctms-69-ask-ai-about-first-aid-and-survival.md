# CTMS-069 — Ask AI About First Aid and Survival

## 1. Overview

Jira [CTMS-257](https://thuha140105.atlassian.net/browse/CTMS-257), Epic 11. A Camper can use the same AI chat with or without Internet connectivity. Online replies use approved RAG evidence. On-device replies can use the installed model independently of a Trip package. Implementation evidence and outstanding verification are tracked in [CTMS-069 implementation](../../docs/features/CTMS-069-Implementation.md).

## 2. Scope

General first-aid and survival guidance, natural-language synthesis, source attribution, local model management and continuity across modes. CTMS-075 owns emergency detection behavior and CTMS-074/076 own SOS creation and delivery. CTMS-055 owns the independent offline viewer. Model training, a separate offline chat screen, the retired CTMS-070 keyword search and business-state changes are outside scope.

## 3. Actors and prerequisites

An active authenticated Camper uses the screen. The server independently checks role, account state and answer ownership. A locally recognized Camper session may use the verified active compatible model without a server round trip. A known session denial requires reauthentication or correction. The device shares public model bytes across its app installation and keeps transcripts and Trip context account-scoped. Online generation depends on CTMS-068 and current eligibility under CTMS-050/051. Trip context is optional and must be obtained through the active package access boundary of CTMS-054/055.

## 4. Business Rules and acceptance matrix

The [canonical BR audit](../../docs/business-rules/ctms-257-hybrid-chat.md) defines each new rule and its valid and violation tests. The Jira ACs map to those independent rules here. CTMS-098 owns the existing online release gates.

| AC | Criterion | Applicable BRs | Valid path | Violation path |
| --- | --- | --- | --- | --- |
| AC1 | Use the existing Camper chat for first-aid and survival questions. | BR-172, BR-202, BR-490 | An eligible Camper sends a question in the existing screen. | A signed-out or non-Camper session cannot submit. |
| AC2 | Use approved CTMS RAG for online answers. | BR-227, BR-228, BR-248, BR-249, BR-484, BR-486, BR-487, BR-488 | A grounded natural-language response uses current eligible evidence. | Unrelated, withdrawn or unsupported evidence cannot produce an answer. |
| AC3 | Generate a natural answer with the installed local LLM. | BR-489, BR-491, BR-492, BR-493, BR-494, BR-495, BR-497, BR-504 | A verified model answers a permitted general question in airplane mode. | A staged, corrupt or incompatible model cannot infer. |
| AC4 | Allow general offline chat without a Trip package. | BR-233, BR-494 | A Camper with a model and no package gets general guidance. | Missing Trip facts cannot be invented to answer a Trip-specific question. |
| AC5 | Keep offline inference local. | BR-495, BR-496, BR-503 | A network-denied device completes an inference. | Any remote request attributable to the offline turn fails the test. |
| AC6 | Use verified local knowledge or Trip context when applicable. | BR-232, BR-233, BR-251, BR-498, BR-507 | A matching active Trip snapshot can support eligible claims. | Invalid ZIP, wrong account, Trip or version never supplies context. |
| AC7 | Handle missing models, unsupported devices and inference failures. | BR-202, BR-255, BR-489, BR-491, BR-492, BR-493, BR-496, BR-499, BR-504, BR-505, BR-506, BR-508, BR-509, BR-510 | Setup or retry guidance permits recovery. | OOM, missing model or an incompatible runtime never shows a successful answer. |
| AC8 | Preserve chat across inference modes. | BR-490, BR-499, BR-500, BR-501, BR-502, BR-503 | Existing turns remain through online → offline → online. | A late response or account switch cannot add a duplicate or expose another account’s turns. |
| AC9 | Represent the verification status of generated guidance accurately. | BR-216, BR-228, BR-249, BR-251, BR-255, BR-487, BR-489, BR-497, BR-498, BR-502, BR-507, BR-508, BR-509, BR-510 | Only evidence actually used appears as sources. | Pretrained-only output cannot claim Admin approval or live operational facts. |
| AC10 | Preserve existing online chat and RAG behavior. | BR-172, BR-202, BR-212, BR-213, BR-216, BR-227, BR-228, BR-233, BR-248, BR-249, BR-251, BR-279, BR-282, BR-484, BR-486, BR-487, BR-488, BR-489, BR-499, BR-501 | Authorized clients can retry idempotently and open existing source snapshots. | Access rejection and source withdrawal continue to block serving the affected answer. |

## 5. Business flow and lifecycle

1. Validate the current Camper and input. Evaluate configured emergency signals ahead of ordinary generation in either mode. Offer the existing emergency actions where applicable.
2. Prefer the authorized online path. Retrieve bounded current eligible chunks, then synthesize natural-language claims supported by that evidence. Retain material conditions and warnings. Validate provider output against its evidence allowlist, safety policy and the current source snapshot before storing it. Policy refusal and insufficient context remain explicit outcomes.
3. Local inference may serve a turn when the device is offline or transport could not establish a connection while the local session and model are eligible. Authentication and policy outcomes, ambiguous timeouts and responses from a reachable service stay on their original path. A turn keeps its request identity. Switching modes does not replay transcript content to the server.
4. Local model lifecycle is absent → downloading → verified → active. Staging checks release identity, file size, SHA-256 and runtime support before activation and preserves the previous artifact if a replacement fails. Expose download size and progress in the existing screen and require explicit user action when online. Incompatible devices, storage shortages and failed inference display a recovery state.
5. The local model can give general guidance without a package. Apply the local safety policy before showing generated text. Local answers may consume an eligible verified/active snapshot through the existing reader for the selected Camper, Trip and version. Snapshot content has its historical source and date. No snapshot or pretrained inference establishes current weather, hazards, location, SOS or operational state.
6. Keep completed turns in account scope. Mark a turn complete once and preserve the identity of an online retry. Never submit offline transcript history on reconnection. Logout, account change and stale replies must not expose the prior account's transcript.

## 6. Integration contract

- `POST /api/ai/answers` retains `{question, locale, requestId}`, `ANSWERED` with `answerId`, `answer` and `sources`, plus existing refusal, insufficiency, errors and idempotency.
- `GET /api/ai/answers/:answerId/sources` retains owner scope and 30-day retention. Previously stored answers retain their original text and cited provenance, subject to existing replay rules.
- Online worker output records its prompt contract version. Validate each cited identifier against supplied evidence and resolve document metadata on the server. An answer without sufficient support cannot be stored as grounded.
- A device reply is identified by its local turn, carries its inference provenance and has no server `answerId`. A general pretrained reply carries no CTMS citations. Optional snapshot citations use only verified evidence demonstrated to have been used and retain the exact source version. Local turns do not call the server source or feedback endpoints.
- Operational state, including SOS delivery, remains owned by the corresponding workflow. Chat output is advisory.

## 7. Failure behavior

| Condition | Result |
| --- | --- |
| Airplane mode with active compatible model | Eligible general inference runs on device |
| No model or failed download | Keep the question in the chat and offer recovery. Stage the next download only on user action |
| Bad digest or interrupted upgrade | Keep the previous verified model eligible |
| Unsupported device or resource exhaustion | Show a concise localized failure. Keep completed turns |
| Incorrect account, Trip or package version | Omit the snapshot. Use general guidance only when independently safe |
| Disconnect, late response or repeated retry | Retain the turn identity and show at most one reply |
| 401, 403, provider refusal or ambiguous timeout | Preserve the original outcome without automatic fallback |
| Emergency or unverified live status | Use established emergency actions or direct the user to the authoritative screen |

## 8. Release validation

Confirm native builds and blocked-network inference on physical iOS and Android. Record model revision, download size, peak memory, first-token latency, throughput, Vietnamese quality and safety-corpus results in CTMS-098. Eligibility to ship on specific devices requires measured evidence. See the [rule matrix](../../docs/business-rules/ctms-257-hybrid-chat.md#new-keys-and-acceptance-paths) for the per-rule cases.
