# CTMS-257 Business Rule audit

CTMS-257 extends story spec CTMS-069. The pre-hybrid baseline is commit `fefca4e5`. The [current planning reference](../planning/ctms-257-hybrid-reference.md) identifies live consumers. The historical planning CSVs retain their original mappings.

The later Inference Trace design adds BR-517–BR-519 in [CTMS-069 §5](../../file/spec/ctms-69-ask-ai-about-first-aid-and-survival.md#5-business-rules), with valid and violation cases in §11. CTMS-072 reuses its existing answer linkage and selected-turn feedback rules. [CTMS-073 §5](../../file/spec/ctms-73-review-ai-answers-reported-as-dangerous.md#5-business-rules) limits BR-253 to Unsafe moderation authorization, defines the separate transition requirements and reuses BR-191/192 for audit. BR-279 and BR-282 continue to govern CTMS-098 evaluation.

## Shared rules and consumers

Compare definitions with the baseline before adding a key. In particular, CTMS-068, CTMS-069 and CTMS-071 all use the full BR-248 wording. CTMS-075 owns the full BR-255 emergency flow and CTMS-069 uses it in both modes. Citations under BR-251 and how a reply represents its verification status under BR-497 are separate checks.

| BR | Scope and impact | Valid path | Violation path |
| --- | --- | --- | --- |
| BR-172 | CTMS-006 and its API access consumers. Referenced by CTMS-069. | Allow a Camper to read their own answer sources. | Reject protected source access by another user. |
| BR-178 | Shared retry invariant in CTMS-033/034/035 and other consumers. CTMS-069 applies the same invariant to an answer request. | An online retry with the same request ID returns the stored result. | A late response or repeated submission cannot create a second visible answer for the same request. |
| BR-216 | Advisory behavior in CTMS-068/069/075. Authoritative workflows keep their existing ownership. | Explain a rule using approved evidence. | An AI reply cannot reopen a route or initiate SOS. |
| BR-227 / BR-228 / BR-484 | CTMS-050/051 source eligibility and chunk provenance consumed by CTMS-068/069. | Retrieve a currently eligible source with traceable chunk identity. | Reject withdrawn sources or mismatched document/chunk identity. |
| BR-232 / BR-233 | CTMS-054/055 package verification and exact Trip/version. CTMS-069 uses the same account-scoped reader. | Use the selected Camper's verified active snapshot. | Do not read a corrupt package or a mismatched account, Trip or version. |
| BR-248 | Defined by CTMS-068 and used by CTMS-069/071. Keep relevance, context limit and source references together under the existing definition. | Retrieve bounded, relevant evidence with intact provenance. | Exclude unrelated or over-limit evidence and reject missing provenance. |
| BR-249 | Original CTMS-069 wording. Apply the knowledge-base and latency clauses online and the safety clause in both modes. CTMS-098 owns release gate measurement. | Return an online answer grounded in approved evidence. Apply safety policy before showing either mode's reply. | Withhold unsafe output even when evidence is available. |
| BR-251 | Defined by CTMS-071 and consumed by CTMS-069. Covers actual used sources and categories. | Show the source actually used by the answer. | Exclude an unused or invented source. Pretrained-only replies have no source. |
| BR-255 | [CTMS-075](../../file/spec/ctms-75-detect-emergency-questions.md#5-business-rules) retains signal detection, priority guidance and SOS/location actions. CTMS-069 invokes that flow before selecting an inference engine. CTMS-075 defines the expanded assessment, protocol and fallback rules. | A configured serious danger signal triggers priority guidance and the applicable emergency actions in either mode. | An unavailable engine must not suppress emergency handling. Ordinary questions remain eligible for the normal path. |
| BR-279 / BR-282 | CTMS-098 owns AI release thresholds. BR-282 remains shared with other evaluation specs. | Store results with the approved thresholds and versions. Record offline coverage as observational. | An out-of-range gate fails. An observational metric alone cannot fail the release. |
| BR-212 / BR-213 | Documentation and validation requirements in CTMS-071 and other consumers. | Spec, contract and verification cover the changed behavior with valid and violation cases. | Missing or stale coverage keeps the changed behavior unverified. |

## Active hybrid-specific keys

The baseline has 432 distinct numeric BR keys with BR-485 as the highest. The earlier allocation scan covered tracked and untracked text and reachable Git history. This review keeps 15 of the 25 allocated IDs. Withdrawn IDs stay reserved. CTMS-069 §5 defines the active rules and §11 keeps the existing test matrix format.

| BR | Invariant | CTMS-257 | Valid path | Violation path | Test type |
| --- | --- | --- | --- | --- | --- |
| BR-488 | A grounded online answer must synthesize the evidence in natural language. | Jira AC-2, AC-10 | A generated paraphrase preserves the meaning and warnings of approved evidence. | A provider response containing only evidence IDs cannot produce a new answer. | API unit / Python |
| BR-491 | On-device inference requires a supported device. | Jira AC-3, AC-7 | A supported device can use the local engine. | An unsupported device is excluded before inference. | Device trial |
| BR-492 | A model artifact must match its trusted release checksum before activation. | Jira AC-3, AC-7 | A matching file passes checksum verification. | A tampered file is rejected. | Flutter unit |
| BR-493 | Local inference may read only an active model artifact. | Jira AC-3, AC-7 | Inference opens the active artifact. | A verified file still in staging cannot be opened for inference. | Flutter unit / device trial |
| BR-494 | General offline chat must remain usable without a Trip package. | Jira AC-4 | An eligible general question is answered without a saved Trip. | Removing a Trip package cannot disable general local inference. | Flutter widget / device trial |
| BR-495 | An offline inference turn must make no remote requests. | Jira AC-5 | Offline inference completes with outbound connectivity blocked. | A network trace with a remote request attributable to the turn fails this check. | Device trial |
| BR-496 | A model download must start only on an explicit Camper action. | Jira AC-7 | Tapping the download action starts staging online. | Changing modes or submitting an offline question does not start a download. | Flutter widget |
| BR-497 | An answer based solely on pretrained knowledge must not be presented as verified CTMS guidance. | Jira AC-9 | An on-device answer is shown as a general AI suggestion. | A pretrained-only reply is rejected if labeled as CTMS-verified guidance. | Flutter widget / content evaluation |
| BR-499 | Automatic fallback after an attempted online request is allowed only when the connection failed before the request could reach the service. | Jira AC-7, AC-10 | A confirmed connection failure routes an eligible new turn to the local engine. | An HTTP error, a refusal or an ambiguous timeout cannot route that turn to the local engine. | Flutter widget |
| BR-500 | Completed turns must be retained when the chat changes inference mode. | Jira AC-8 | Online and offline replies remain visible across connectivity changes. | A mode switch must not clear previous answers. | Flutter widget |
| BR-502 | The local chat transcript must be accessible only to its originating Camper account. | Jira AC-8 | The same Camper can view existing turns throughout a session. | After logout or account change, prior turns and late replies are hidden. | Flutter widget |
| BR-503 | Reconnection must not upload local conversation history automatically. | Jira AC-5, AC-8 | A newly submitted online question is sent on demand. | Reconnection does not send earlier offline questions or answers. | Flutter widget / device trial |
| BR-504 | A failed model replacement must preserve the previously usable active artifact. | Jira AC-7 | The current model stays active while a replacement is staged. | A failed or interrupted update cannot invalidate the current working model. | Flutter unit |
| BR-505 | A model install may stage a download only when sufficient device storage is available. | Jira AC-7 | With sufficient space the candidate is staged. | Insufficient space prevents the download from starting. | Flutter unit |
| BR-507 | An AI answer may present operational conditions as current only with live authoritative evidence. | Jira AC-6, AC-9 | A reply with live authoritative evidence may state the supported status. Without that evidence, direct the Camper to its authoritative screen. | Model memory or a saved snapshot cannot establish live weather, hazards or SOS status. | Content evaluation |

The matrix records acceptance scenarios. See the [implementation evidence](../features/CTMS-069-Implementation.md) for what was executed and the remaining device and integration checks.

## Retired and withdrawn keys

`BR-250` remains retired with CTMS-070/CTMS-258. The retired spec and its diagram retain the old keyword-search requirement. CTMS-055 still owns the independent offline viewer.

| Key | Earlier allocation | Active requirement |
| --- | --- | --- |
| BR-486 | RAG context size | Already required by BR-248 in CTMS-068/069/071. |
| BR-487 | Retrieved chunk identity and source location | Use BR-248 to preserve references and BR-228 for immutable chunk provenance. |
| BR-489 | Withhold answers that fail safety policy | BR-249 already requires compliance with the answer safety policy. Its relevant safety checks apply in both inference modes. |
| BR-490 | Use one Camper chat screen | Keep the existing-screen obligation in CTMS-069 Jira AC-1 and the flow. It does not need another BR key. |
| BR-498 | Read the verified active Trip package | Use the existing account-scoped CTMS-054/055 boundary under BR-232 and BR-233. CTMS-069 describes the consumer in prerequisites and flow. |
| BR-501 | Show one answer per retryable turn | Apply the shared BR-178 retry invariant and keep single-turn rendering in the CTMS-069 contract and test matrix. |
| BR-506 | Show recovery when local inference fails | Keep recovery behavior in CTMS-069 Jira AC-7 and its error matrix. Eligibility and activation have separate rules. |
| BR-508 | Show priority guidance in an emergency | BR-255 covers guidance. Running the handler before engine selection belongs to the CTMS-075 integration contract. |
| BR-509 | Offer the eligible SOS action | BR-255 already covers surfacing SOS. CTMS-074/076 retain ownership of SOS creation and delivery. |
| BR-510 | Offer the applicable current-location action | BR-255 already covers the current-location action. |

