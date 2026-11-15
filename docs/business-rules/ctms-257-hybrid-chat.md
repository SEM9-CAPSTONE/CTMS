# CTMS-257 Business Rule audit

Reviewed against clean `develop` at `fefca4e5`. Jira was read to confirm CTMS-257 AC1–AC10 and the status of CTMS-258, 335–338. CTMS-257 is the Jira key for spec CTMS-069.

## Allocation and reference history

- Searched tracked and untracked text in the checkout with `git grep --untracked -I -o -h -E 'BR-[0-9]+'`, including source, tests, archived specs and planning exports. Also searched reachable history with `git log --all -G 'BR-4(8[6-9]|9[0-9])|BR-[5-9][0-9]{2}'`. The baseline has 432 distinct numeric keys. The highest was BR-485, defined by CTMS-050. No occurrence in the 25-key allocation range was found in the baseline or reachable history. Retired or missing lower numbers are intentionally skipped.
- Active definitions are the current `file/spec` amendments and files under `docs/business-rules`. The two planning reference CSVs are historical exports with the same old Story mapping, including unrelated owners for numbers reused before the current baseline. For example the older import uses BR-216 for credential handling and BR-233 for pagination. Preserve these exports as evidence. [Current mapping](../planning/ctms-257-hybrid-reference.md) supersedes them where applicable.
- BR-248 owns relevance, BR-486 owns context size, BR-487 owns the retrieval-to-generation evidence identity, and BR-251 owns display eligibility. BR-487 consumes the immutable storage provenance of BR-228. BR-249 concerns evidence support, BR-488 concerns synthesis, and BR-489 concerns operational safety, even when the evidence is eligible. Online release latency continues to be governed by BR-279. Package verification and viewing stay with BR-232/233. BR-498 governs the separate chat consumer of that boundary.

## Existing rules

| BR | Before | Decision | Active result | Affected references |
| --- | --- | --- | --- | --- |
| BR-172, BR-202 | Server authorization and active-account eligibility | KEEP | Existing protection on answer creation and source ownership | 069, AI controller/service, E2E |
| BR-212, BR-213 | Maintain contracts and evidence for both rule paths | KEEP | Current spec, data contract and coverage matrix | 069, 071, this audit, data dictionary |
| BR-216 | Advisory AI cannot override authoritative state | KEEP | Same invariant through both inference modes | 068, 069, 075, AI service policy |
| BR-227, BR-228, BR-484 | Current publication, exact chunk provenance and eligible sources | KEEP | Existing retrieval and transactional revalidation | 050, 051, 068, RAG repository, knowledge chunk integration |
| BR-232, BR-233 | Verified package use and exact Trip/version available offline | KEEP | Existing viewer and authorization boundary | 054, 055, 069, Flutter offline package regression |
| BR-248 | Relevance, budget, provenance and unrelated chunk exclusion | UPDATE | Relevance only. Move budget to BR-486 and provenance to BR-487 | 068 defines all three. 069 consumes them. 071 uses BR-487 for traceability |
| BR-249 | Knowledge-base grounding, response latency and safe output | UPDATE | Approved CTMS grounding for online answers. BR-489 owns safety. BR-279 owns release latency | 069, 098, NestJS and Python generation tests |
| BR-250 | Local keyword/full-text search over the downloaded package | RETIRE | Withdraw from active scope with CTMS-258, 337 and 338 | 070 and its sequence diagram retained as history. No current source or test consumer found |
| BR-251 | Cite actual used sources and categories | KEEP | Same provenance requirement. A pretrained reply has no cited source | 069, 071, source ownership and UI tests |
| BR-255 | Signal recognition, priority guidance and SOS/location actions | UPDATE | Signal recognition. Priority response and the two independent UI actions have BR-508, BR-509 and BR-510 | 075, 069, emergency regression plan |
| BR-279, BR-282 | Approved AI release gates and traceable evaluation | KEEP | Thresholds and observational offline coverage are unchanged | 098, shared evaluation stories |

## New keys and acceptance paths

| BR | Invariant | Owner | Valid path | Violation path | CTMS-257 |
| --- | --- | --- | --- | --- | --- |
| BR-486 | Online retrieval context stays within its configured budget. | 068 | A bounded context reaches the provider. | An oversized context is excluded. | AC2 AC10 |
| BR-487 | Each retrieved chunk retains its exact document-version and location provenance. | 068 | A candidate carries its original version and location. | A candidate with missing source identity is rejected. | AC2 AC9 AC10 |
| BR-488 | A grounded online response is synthesized in natural language. | 069 | A paraphrase preserves the meaning of approved evidence. | A provider response containing only IDs cannot produce a new answer. | AC2 AC10 |
| BR-489 | An answer that fails the applicable safety policy is withheld. | 069 | Allowed general guidance is returned. | Unsafe treatment advice is withheld. | AC3 AC7 AC9 AC10 |
| BR-490 | Both inference modes use the existing Camper chat screen. | 069 | Alternating modes renders two turns in one transcript. | Changing mode does not route to a second chat. | AC1 AC8 |
| BR-491 | Only a compatible device can use the installed model. | 069 | A supported native runtime loads the candidate. | An unsupported platform cannot infer. | AC3 AC7 |
| BR-492 | A local model may be activated only when its artifact matches the trusted release digest. | 069 | An exact digest permits activation. | A truncated or tampered artifact cannot activate. | AC3 AC7 |
| BR-493 | Local inference uses only the currently active model. | 069 | An active verified artifact produces a reply. | An incomplete staged artifact cannot be used. | AC3 AC7 |
| BR-494 | General offline answers are available independently of the Trip package. | 069 | A general question works with an installed model and no package. | Fail the case if the same question is blocked after removing the Trip package. | AC3 AC4 |
| BR-495 | A local inference turn operates without remote requests. | 069 | A turn completes in airplane mode. | The test fails if it observes remote API, RAG or telemetry calls for the turn. | AC3 AC5 |
| BR-496 | A model download starts only after an explicit user action. | 069 | The download begins after the Camper requests it. | A mode change or offline question cannot start a download. | AC5 AC7 |
| BR-497 | Pretrained-only replies are represented as general AI guidance. | 069 | The transcript marks the answer as general guidance. | A pretrained-only turn has no verified CTMS label. | AC3 AC9 |
| BR-498 | Optional Trip grounding is consumed through the verified active package boundary. | 069 | The selected account and Trip receive their active snapshot. | A wrong account, Trip or version yields no Trip context. | AC6 AC9 |
| BR-499 | Automatic offline fallback is limited to a confirmed transport failure. | 069 | A connection failure before acceptance can select local inference. | 401, 403, policy results and ambiguous timeouts do not trigger local fallback. | AC7 AC8 AC10 |
| BR-500 | A completed turn survives a change in network availability. | 069 | An online answer remains when the next question runs offline. | Reconnection cannot clear completed local turns. | AC8 |
| BR-501 | A submitted turn has at most one displayed answer. | 069 | Retry updates the existing turn. | A late response cannot append a second answer. | AC8 AC10 |
| BR-502 | The chat transcript is scoped to the authenticated Camper account on the device. | 069 | The same active account retains its transcript across modes. | Another account and a signed-out session cannot see the transcript. | AC8 AC9 |
| BR-503 | Device conversation history is never automatically uploaded. | 069 | A separately entered online question is sent on demand. | Reconnection cannot resend offline questions or replies. | AC5 AC8 |
| BR-504 | A failed model replacement preserves a working active model. | 069 | An intact replacement becomes active. | A corrupt or interrupted replacement leaves the working model usable. | AC3 AC7 |
| BR-505 | A model install requires sufficient free device storage for staging. | 069 | The device stages the candidate alongside its active model. | Insufficient space fails before creating a usable artifact. | AC7 |
| BR-506 | Unavailable local inference returns a recoverable chat state. | 069 | The Camper can retry after addressing a transient failure. | An absent model, unsupported runtime or OOM cannot produce a fake successful turn. | AC7 |
| BR-507 | An AI reply may assert current operational conditions only with live authoritative evidence. | 069 | Live data is attributed to its authoritative workflow. | A Trip snapshot or model memory cannot establish current weather, hazards, location, Trip state or SOS delivery. | AC6 AC9 |
| BR-508 | A detected emergency receives priority guidance before ordinary inference. | 075 | Configured danger signals receive immediate priority guidance. | An ordinary question follows normal inference and a slow engine cannot delay an emergency response. | AC7 AC9 |
| BR-509 | A detected emergency surfaces the existing SOS action when available. | 075 | An eligible Trip shows the SOS action. | Without eligible Trip context the interface never offers to send SOS directly. | AC7 AC9 |
| BR-510 | A detected emergency surfaces the current-location action when applicable. | 075 | An available location action is offered for a detected emergency. | An unavailable location cannot be presented as known. | AC7 AC9 |

## Existing rule acceptance paths

| BR | Active meaning in this story | Valid path | Violation path | CTMS-257 |
| --- | --- | --- | --- | --- |
| BR-172 | Backend authorization checks role, ownership and business scope. | Active Camper reads their own sources. | Other account or invalid role cannot read the sources. | AC1 AC10 |
| BR-202 | Inactive accounts are ineligible for protected features. | Active Camper session can submit. | Suspended session cannot submit. | AC1 AC7 AC10 |
| BR-212 | Keep specifications, tests and data contracts synchronized. | Contract change has corresponding spec, tests and data description. | A change lacking one of those is incomplete. | AC10 |
| BR-213 | Exercise every rule with valid and violation paths at the appropriate test level. | An isolation rule is exercised in integration. | A success-only case does not demonstrate the violation path. | AC10 |
| BR-216 | AI output is advisory and cannot override authoritative rules or state. | An answer explains a documented rule. | A prompt cannot reopen a closed route or dispatch SOS. | AC9 AC10 |
| BR-227 | Read current eligible document publications. | Published current source is retrieved. | Superseded or withdrawn version cannot ground a new reply. | AC2 AC10 |
| BR-228 | Knowledge chunks retain versioned extraction provenance. | A current chunk references its original source item. | A wrong checksum, version or set is rejected. | AC2 AC9 AC10 |
| BR-232 | Verify a package before use. | A matching verified ZIP opens. | Corrupt ZIP is rejected. | AC6 |
| BR-233 | The exact Trip/package version remains usable offline in the viewer. | The verified viewer works with AI absent. | Wrong version cannot be displayed. | AC4 AC6 AC10 |
| BR-248 | Online RAG selects only relevant evidence. | A relevant chunk is selected. | An unrelated chunk is excluded. | AC2 AC10 |
| BR-249 | Published online answers must be grounded in the approved CTMS knowledge base. | The generated claims are supported by cited approved excerpts. | An unsupported claim or withdrawn evidence prevents publication. | AC2 AC9 AC10 |
| BR-251 | Only actual sources used can be displayed as citations. | The used source is displayed. | Unused, fabricated or pretrained-only references are excluded. | AC6 AC9 AC10 |
| BR-255 | Recognize configured danger signals in chat questions. | Known danger text is detected in both modes. | Ordinary question is not classified as an emergency. | AC7 AC9 |
| BR-279 | Keep approved release metrics and observational package coverage. | Online metrics pass and offline coverage is recorded. | A gate outside its range fails while coverage alone does not decide release. | AC10 |
| BR-282 | Retain traceable evaluation reports. | Versioned report stores values and decisions. | An unversioned report cannot establish a gate result. | AC10 |
| BR-484 | Only CTMS-050 eligible sources feed downstream retrieval. | Approved eligible publication becomes retrievable. | Restricted or unapproved material is excluded. | AC2 AC10 |

Test location and level: online rules use `test_survival_answers.py`, `ai-answers.service.spec.ts`, `rag-retrieval.service.spec.ts`, HTTP `ai-answers.e2e-spec.ts` and PostgreSQL `knowledge-chunks.integration-spec.ts`. Chat, model lifecycle and emergency behavior use the Flutter controller, model-store and widget suites. Verify real inference, transport isolation, compatibility, memory and Vietnamese quality on physical iOS and Android devices. The table specifies expected acceptance evidence, not results.

