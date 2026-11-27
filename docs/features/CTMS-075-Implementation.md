# CTMS-075 Implementation and Verification

27 November 2026 · CTMS-075 / Jira CTMS-263 · Engineering preview · Policy `ctms-075-safety-v1`

## Implementation

The existing Survival Assistant evaluates each supported turn before it selects an inference engine. The deterministic classifier combines intent, affected person, time, local negation, configured signals and completeness. A credible current serious signal or rescue request takes precedence. WARNING and EMERGENCY do not invoke a model. An unresolved incident survives follow-up and retry in the same mobile conversation. Starting a new conversation or changing accounts clears the mobile incident state.

The existing authenticated `POST /api/ai/answers` boundary independently evaluates requests before repository, retrieval or model work. In engineering preview, an interrupted response returns `SAFETY_ASSESSMENT`, severity, completeness, the policy version, an optional approved protocol and a clarification reference. It has no answer, citations or rateable answer record. A direct API client keeps the latest opaque `emergencyContext` from its current conversation in memory and returns it on follow-up. Omitting it starts an independent assessment. The server authenticates and decrypts it for the same Camper account, rejects invalid supplied context and has no new transcript store or migration. The mobile path keeps local incidents on-device. It uses the API assessment on an eligible online turn if the API detects an incident independently.

An approved protocol can be rendered from bundled mobile assets in airplane mode. The checked-in policy is **pending qualified review**. Its mandatory protocol entries contain metadata slots, with empty content and source references. During engineering preview the UI reports that approved instructions are unavailable and can offer a non-clinical clarification, SOS entry point or location action. Essential assessment and rendering do not wait on model or Trip package loading. Android/iOS production builds and the production API keep the new behavior disabled until the canonical release requirements are met.

An eligible SOS action opens `TriggerSosDialog`. With a selected Trip the online action uses existing SOS list authorization. Without a selected Trip, an online Camper can choose an existing booking and the same authorization check runs before opening confirmation. Offline, the new handoff uses evidence from a verified active Trip package belonging to the current account. Without that evidence the assistant keeps guidance and location available and links to existing Trip entry points where available. The existing SOS API remains authoritative on sync. A locally queued SOS, backend receipt and Host acknowledgment have distinct labels, and the assistant never creates a request. Offline reconnect, idempotency, cancellation, closure and direct SOS stay with their existing owners.

## Files and reuse

| Changed files | Responsibility |
| --- | --- |
| `services/api/src/modules/ai-answers/emergency-safety-policy.json`, `scripts/emergency-safety-policy.cjs`, `apps/mobile/lib/features/camper/data/emergency_safety_policy_data.dart` | Canonical rules, release validation and generated mobile bundle. |
| `services/api/src/modules/ai-answers/emergency-safety-engine.ts`, `emergency-safety-context.ts` in the same directory | Deterministic API assessment, approved content selection and account-bound API continuation. |
| `services/api/src/modules/ai-answers/ai-answers.controller.ts` and `ai-answers.service.ts` | Existing DTO, authorization, inference pipeline and output gate. Existing answer safety, grounding, citation checks, replay and error codes still apply. |
| `apps/mobile/lib/features/camper/data/emergency_safety_engine.dart`, `emergency_sos_status.dart` and `survival_chat_api.dart`, `application/survival_chat_controller.dart` under the same feature | Mobile assessment, SOS state presentation, app-only conversation state, API response decoding and reuse of Hybrid AI Chat routing, local policy and offline eligibility. |
| `apps/mobile/lib/features/camper/presentation/camper_ai_assistant_screen.dart` and `widgets/survival_safety_card.dart` under the same feature | In-chat warning and emergency cards, existing GPS permission source, SOS confirmation, connection and delivery labels. |
| `emergency-safety.engine-fixtures.json`, `emergency-safety-engine.spec.ts`, `ai-answers.service.spec.ts` in the API answers module, and `services/api/test/ai-answers.e2e-spec.ts` | Shared labelled engineering cases, direct service gate and public HTTP expectations. |
| `apps/mobile/test/features/camper/emergency_safety_engine_test.dart` and `survival_chat_test.dart`, `.github/workflows/ci.yml` | Mobile parity, output and delivery states, chat UI, retry, location and SOS handoff tests. CI checks policy generation and Flutter test entry points. |
| `file/spec/ctms-75-detect-emergency-questions.md`, this report | Implementation traceability and the approved CTMS-076 boundary. |

The earlier scope restoration edits are still in the worktree. This implementation retains the BR definitions and their IDs. It adds no chat service, model, payment service, transport mechanism, health-profile access or safety payload logging.

## Functional requirements and rule traceability

| Requirement | Implementation | Applicable Business Rules |
| --- | --- | --- |
| FR-01 | `SurvivalChatController._request` evaluates submit and retry. `AiAnswersService.ask` independently gates authenticated online requests. | BR-255, BR-551 |
| FR-02 | Both engines normalize tokens and apply the canonical intent, temporal, person, signal and clarification policy. The previous assessment is part of the next decision. | BR-551, BR-553 |
| FR-03 | Deterministic severity ordering, explicit incompleteness and unresolved-incident continuity. No generation on WARNING or EMERGENCY. | BR-216, BR-255, BR-552, BR-553 |
| FR-04 | Generated mobile policy bundle and `SurvivalSafetyCard` deliver the essential path without network, package, GPS or model. Content loading checks approval and provenance. | BR-495, BR-554 |
| FR-05 | Existing grounding, refusal and local output checks plus the shared configured restriction screen before saving or display, including replays. Approved fallback is available through the existing result or error path when present. | BR-249, BR-497, BR-499, BR-507, BR-554, BR-555 |
| FR-06 | Existing GPS source and confirmation dialog, same participation check, independent actions and truthful SOS status labels. | BR-172, BR-186, BR-216, BR-244, BR-254, BR-255, BR-256, BR-257, BR-258, BR-261, BR-507 |
| FR-07 | Canonical revision and protocol version, qualified-review metadata and evaluation reference required by the release check. Context is account-bound and new safety telemetry carries no raw sensitive data. | BR-186, BR-187, BR-192, BR-212, BR-213, BR-279, BR-282, BR-554 |

UC-01 uses the existing Hybrid AI Chat workflow. UC-02 presents the warning and reassesses a follow-up. UC-03 interrupts for the emergency card and eligible SOS and location actions. UC-04 uses the same bundled assessment in disconnected and degraded conditions. The availability of medically reviewed guidance for UC-02, UC-03 and UC-04 remains a release dependency.

## Acceptance and verification evidence

| Acceptance | Test evidence |
| --- | --- |
| AC-01 | Shared ordinary, prevention and educational fixtures. API normal-flow regression suite. |
| AC-02 | Shared Vietnamese, ASCII Vietnamese, English, decomposed Unicode, fullwidth, configured typo, mixed-accent, past, hypothetical, scoped negation and third-person cases. |
| AC-03 | Shared possible-incident, one-word ambiguity and non-additive severity cases. Flutter warning explicitly tested in the widget suite. |
| AC-04 | Shared credible serious and third-person cases. API direct service test shows zero retrieval, model or database calls. Under review, the assertion is that the protocol remains absent. |
| AC-05 | Shared warning → emergency → short follow-up and explicit update sequences. Mobile conversation isolation in the widget suite. |
| AC-06 | Shared user-override case, API invalid/account-mismatched context and direct service safety gate. HTTP and mobile retry tests added. |
| AC-07 | Existing API empty and invalid evidence, failure and refusal tests. Existing mobile tests cover retry and mode fallback. Code preserves the HTTP error and existing retry policy. |
| AC-08 | New API refusal-before-persistence for configured unsupported advice, claims about rescue and current conditions. Shared output-screen assertions and widget assertion that the withheld reply is not shown. |
| AC-09 | Dart assessment executed in isolation with no Flutter imports or services. Widget cases cover mocked offline chat, no package, no inference and absent reviewed content. Physical airplane-mode evidence is outstanding. |
| AC-10 | Added mobile denied-location and stale-position widget tests, with timestamp and accuracy. Policy screen covers unsupported location and live-condition claims. |
| AC-11 | Added mobile ineligible handoff and abandoned confirmation tests. Existing SOS UI remains independently reachable. |
| AC-12 | Existing SOS controller and sync tests cover explicit initiation, persistence and retry. Added status parity for pending and failed, and an offline chat handoff test that verifies no send from assessment or an abandoned confirmation. |
| AC-13 | New Flutter status test distinguishes active, acknowledged, cancelled and closed. Existing API SOS regressions passed. |
| AC-14 | Structural and bundle consistency checks passed. The unapproved release check returns a nonzero exit. API tests cover private/account-bound context and pending content. |

### Commands and actual results

| Command | Result |
| --- | --- |
| `node scripts/emergency-safety-policy.cjs` | Passed. Canonical source and mobile bundle agree. |
| `node scripts/emergency-safety-policy.cjs --release` | Blocked activation as expected. Qualified review, production evidence and mandatory approved content are pending. |
| `node node_modules/jest/bin/jest.js --runInBand src/modules/ai-answers src/modules/sos --silent` from `services/api` | 8 suites, 138 tests passed. |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false` and `node node_modules/@nestjs/cli/bin/nest.js build` from `services/api` | Passed. The Nest build emitted the canonical JSON in the API distribution. |
| ESLint on changed API runtime files and Biome on changed JavaScript, TypeScript and JSON | Passed. The installed tools were used directly after Corepack attempted an unavailable registry download. |
| Dart format and Dart analyze on changed mobile Dart files | Passed. Analyzer reported no issues. |
| Dart SDK direct execution of the mobile evaluator against the shared engineering fixture JSON and SOS presentation assertions | 26 scenarios, 32 turns, 0 assessment mismatches. All six SOS status assertions passed. |
| `node node_modules/jest/bin/jest.js --config ./test/jest-e2e.json --runInBand ai-answers.e2e-spec.ts` from `services/api` | Blocked before tests by sandbox access to PostgreSQL at `127.0.0.1:5432`. |
| `flutter test --no-pub --reporter expanded test/features/camper/emergency_safety_engine_test.dart test/features/camper/survival_chat_test.dart test/features/sos` and `flutter pub get --offline --enforce-lockfile` from `apps/mobile` | Full Flutter execution was blocked by the missing existing Google Sign-In dependency and Flutter tester loopback connectivity. Offline dependency resolution also failed with an incomplete package cache. Widget and device results are unverified. |
| `git diff --check` | Passed. |

### Measurements and release state

| Metric | Evidence |
| --- | --- |
| Emergency recall / false negative rate | 14/14 and 0/14 respectively on the engineering fixture turns. |
| Emergency false positive rate | 0/18 on the non-emergency engineering fixture turns. |
| Unsafe response rate | No release-rate estimate. Targeted unsupported-output cases passed on the API. |
| Groundedness | Existing API grounding and citation regressions passed. No new versioned corpus measurement. |
| Emergency response latency | 82 μs P95 for Dart assessment only in a warmed desktop sample of 500 runs across the 32 turns. This excludes rendering, device behavior, context IO and transport. |
| Offline reliability | Deterministic evaluation with no model, Trip package, network or GPS passed in the Dart runner. Flutter widget and physical-device verification remain open. |
| SOS status accuracy | Existing SOS API tests and all six Dart mobile status mapping checks passed. End-to-end delivery and status accuracy remain unmeasured. |

CTMS-050 documentation distinguishes publication permissions and processing eligibility from qualified medical approval of an exact version. The inspected repository documentation, source examples and proposals did not establish protocol-specific qualified approval or bundling rights. The running knowledge database could not be inspected from the sandbox. No reviewer, source grant, clinical instruction or approval date was invented. CTMS-098 numerical release gates remain in force.

**Engineering status:** code and traceability implemented for the preview. Full engineering sign-off remains open until Flutter widget flow and database-backed HTTP verification can run. **Production readiness:** blocked on qualified content approval, validated labels and mandatory release and offline-device verification. No commit or push was made.
