# CTMS-416 — Monthly Booking demand UI

## Scope and sources

Host web UI for CTMS-297 / CTMS-109, based on merged CTMS-415. The contributor approved the period read API, UI revisions and explicit transient-failure retry in chat on 2026-11-06. No Flutter, Trip/Route business mutations, automatic creation/publishing/repricing, source identities or generated free-form planning advice. Only privacy-released Trip-type/difficulty cells and provider-selected enum suggestions are displayed.

## Final presentation

Menu: “Nhu cầu đặt chỗ”; title: “Nhu cầu đặt chỗ theo tháng”. Subtitle explicitly identifies system-wide Booking data, not the current Host's private demand. The server-owned twelve-period selector prefers the latest existing report; unavailable periods show the server availability date in Asia/Ho_Chi_Minh. Refresh is a GET action with a text label, accessible name and busy/disabled state.

Successful reports show a month/group-count heading, compact taxonomy cards and ten-wide booker intervals. One paragraph explains the privacy intervals and observed demand; an equal-band sentence appears only when every interval matches. No count ranking, bar charts, exact counts or forecast promises. The advisory block renders only AI-selected released groups, in cell order with equal styling, fixed enum explanations and the label “AI chọn nhóm có nhu cầu; câu chữ do hệ thống viết sẵn.” It does not repeat the counts, generic per-cell advice or frozen-report note. No Create Trip button remains.

Next steps link to `/host/campers?from=demand-insights` (“Xem người tham gia & đặt chỗ”) and `/trips` (“Khám phá chuyến đi”). The existing HostCampers back callback returns to demand insights for this allowlisted origin; other origins retain Dashboard behavior. The optional back-label prop changes presentation only. Public exploration is not represented as the report's source or filtered to its groups. Existing destination layouts require desktop; Host remains web-only. The report page stacks controls/cards at narrow browser widths.

Only the footer shows publication time, with a conditional stale suffix. No UUID, hash, model, prompt version or source IDs appear in the Host UI. Secondary text is #526357 (5.92:1 against page #f4f7f2, 6.40:1 against white).

## Read API and lifecycle

GET `/api/host/demand-insights` requires the same active Host authorization and no-store policy as reports. It returns `{periods:[{month,availableAt,canCreate,hasReport}]}` for twelve closed Vietnam calendar months. The server owns stabilization policy; POST remains authoritative and returns 422 with availableAt when necessary. Successful POST 200/202 invalidates authoritative GET queries.

Polling occurs only for pending/running, at five seconds with bounded network-error backoff. It pauses while hidden, resumes when visible, stops at terminal states/unmount and restores via GET after reload. Queries are actor/month scoped with no previous-period placeholder. Submission has an immediate guard against duplicate clicks. 429 uses Retry-After with JSON fallback; creation is disabled during cooldown. No polling policy changed for the retry feature.

| State | UI |
| --- | --- |
| Loading | Loading status, no invented results |
| 404 | No report; create only if the server permits |
| Unsettled / 422 | Server-provided availability date; no client stabilization calculation |
| pending / running | “Đang tạo báo cáo. Trang sẽ tự cập nhật.” |
| succeeded | Released intervals, selected advisory suggestions, next steps, publication time |
| failed, canRetry=true | One explicit retry action and matching failure copy |
| failed, canRetry=false | Final failure message, no unavailable retry promise |
| insufficient_data | Dedicated neutral message and public exploration only |
| withheld | Privacy withdrawal message and public exploration only; no detailed cause |
| stale | Conditional footer suffix; no yellow warning frame |
| 429 | Countdown and disabled submission |
| 401 / 403 | Neutral permission message without provider details |

Restricted/insufficient reports hide cells, technical context and suggestions even if a test injects residual payload. Suggestions are React text, not generated HTML/markdown. No temporary preview/mock page or production mock data remains; HTTP fixtures exist only in tests.

## Explicit transient-failure retry

Migration `1794200000000-AddDemandReportRetry` adds `manual_retries`, constrained to 0..1. A repeated POST can requeue the same failed frozen report only for transport/unavailable errors, unchanged source/config/privacy gates and unused manual allowance. It resets per-round attempts and consumes the allowance atomically under the existing global control lock. At most three automatic attempts plus one manually requested round of three further attempts; no new source snapshot/version or successful publication is created. Concurrent submissions reuse the pending report. Persisted global 60-second cooldown plus next_attempt_at apply; 429 carries Retry-After. Permanent errors, changed sources and exhausted allowance return the terminal report unchanged with 200. GET exposes only `canRetry`, not provider error detail or internal counters.

Demand-only timeouts: Python SDK 40 seconds, Nest HTTP 45 seconds; SDK retries remain disabled and existing lease renewal/fencing remains in place. Review-analysis timeout is unchanged. A diagnostic call outside the sandbox with synthetic released cells succeeded in 1.67 seconds; sandbox network restrictions caused the preceding local 504s. The development September report received one explicit operator recovery after the infrastructure problem, without deleting/changing its source snapshot. That local operator action is not a product endpoint or a claim of unlimited retries.

## Development data and evidence

Synthetic sources are added only by `services/api/src/seeds/main.seed.ts`, never by the default destructive seed command during this task. No AI output is seeded. Existing successful report sources are not changed by varied-volume seeding.

- Standard closed-month scenario: twelve distinct bookers and three Hosts per cell.
- September alternative: day/moderate and overnight/hard.
- August varied scenario: 24 distinct bookers for day/moderate and 36 for overnight/hard, three Hosts per cell; released intervals 20–29 and 30–39. Run `node -r ts-node/register src/seeds/main.seed.ts --demand-insights-only --demand-month=2026-08 --demand-alternative --demand-varied` from services/api on a fresh local month without a report.

The contributor recorded real UI creation/polling and navigation evidence in `2026-11-06 22-33-12.mp4`. Video is attached to the PR separately, not committed. Automated Playwright real-local coverage reads persisted results and navigates with a real Host login; it does not make new billable provider calls. Other E2E cases explicitly mock HTTP.

## Verification

- API unit regression: 165 suites / 1,974 tests passed.
- Real PostgreSQL integration (isolated ctms_test, fake provider): 25 passed, including period authorization/availability, retries/cooldown/concurrency, lease fencing, source changes and privacy withdrawal.
- Python demand/review/provider-route regression: 48 passed; one dependency deprecation warning.
- Dedicated Playwright: 7 passed, including six mock-HTTP cases and one real local API/database stored-report and navigation case. Polling pause/resume/terminal stop/reload, 422/429/403 and restricted residual payload are covered. The real case also clicks the contextual back button.
- Full web regression: 242 files / 1,592 tests passed with `vitest run --pool=threads --reporter=verbose` (706.30 seconds). No failures; early quiet output was not proof of a hang.
- Focused demand/HostCampers/menu/routes regression: 23 files / 165 tests passed after the final back-navigation change.
- `lint:all` passed with 12 warnings and zero errors; `build:all` passed (API and web). The web build reports the large-chunk warning.
- A related review-analysis title E2E case passed after updating its expected heading to the contributor-approved copy.
- Changed-scope Biome and Git whitespace checks passed; branch-name validation passed.
- `test:all` reached API success but was interrupted before a web summary. Earlier quiet full-web invocations were also interrupted; lack of reporter output alone does not establish a hang. A complete verbose full-web run is reported separately. Do not mark the interrupted aggregate gate passed.
- Remote CI has not run. No commit/push is implied by these results.


### Reproducible commands

From the repository root (the package manager may require normal network access to verify the pinned version):

```powershell
pnpm run lint:all
pnpm run build:all
pnpm --filter @ctms/api exec jest --runInBand
pnpm --filter @ctms/api exec jest --config test/jest-integration.json --runInBand demand-insights.integration-spec.ts
pnpm --filter @ctms/web exec vitest run --pool=threads --reporter=verbose
pnpm --filter @ctms/web exec playwright test --config playwright.demand-insights.config.ts
```

Python focused regression from services/ai with its configured Python environment:

```powershell
python -m pytest app/test_demand_insight.py app/test_main.py app/test_review_analysis_service.py -q
```

Integration uses guarded local ctms_test and a fake provider. The dedicated E2E config needs localhost API and an existing local Host plus the persisted August report; its live case does not submit an AI generation request. Video evidence separately captures real generation. Generated logs and Playwright output stay in the OS temporary directory; artifacts/evidence are not staged or committed.


## Grounded planning UI extension — 2026-11-07

Based on merged CTMS-415 PR #824 / 441730d8 (local base 54f5260f). This extension is Host web presentation only; it does not modify the API, schema, authorization or Trip/Route business rules. The planning API contract is documented in ctms-415-demand-planning-contract.md.

- A separate action is available only after a monthly report succeeds and planning GET returns not_requested. The action does not run automatically with report generation. All other planning states, including failed, have no manual job-retry action.
- Actor/month-scoped TanStack Query keys and no-store service requests read the authoritative planning state. POST sends an empty object; 202 active and 200 terminal responses are reconciled via GET. A synchronous submission guard prevents double clicks; cooldown is enforced before another POST.
- Pending/running poll at five seconds with bounded exponential backoff on transient errors. Polling stops at terminal states, permanent authorization/validation errors, hidden tabs and unmount; visible tabs/remounts recover by GET without recreating work. There is no artificial 150-second cutoff or numeric progress estimate. Loading is indeterminate because the API supplies no completion percentage.
- 429 prefers Retry-After over JSON fallback and retains its countdown across month navigation/remounts in the same application session. 422/401/403 messages are safe Vietnamese text; provider detail is never rendered. Creation errors are shown for the submitted month only.
- Planning cards separate observed interval evidence from server-authored general advice. Null evidence is omitted; price is per person, capacity is the offered maximum at Booking time (not an optimum), and area is a Host-confirmed catalog value. No generated HTML/markdown, source identity, model/prompt/hash or automatic Trip action is displayed.
- Withheld/unavailable/failed branches never render residual recommendations. Existing monthly advisory tips are suppressed when detailed planning succeeds. Next-step cards retain their existing two routes and support normal modifier-key link behavior.
- The user's 104.87-second recording predates the review correction: numeric progress visible there has been replaced by an indeterminate spinner in the final code. The uploaded copy only moves MP4 metadata for streaming; content/audio are unchanged.

### Extension verification

- Existing/new presentation tests: 36 passed in 3 files. Direct planning-hook tests: 16 passed, covering visibility, unmount, remount, polling beyond 150 seconds, completion, bounded backoff, duplicate submit, active/terminal POST reconciliation, terminal-state guards, permanent HTTP errors and global planning cooldown.
- Dedicated Playwright: 15 passed in 46.3 seconds, comprising 13 mocked HTTP cases and 2 real local API/database read cases. The new planning case reads existing July output, verifies evidence presentation and reload, and asserts no planning POST. It does not claim a new Gemini generation call.
- TypeScript project build and Vite production build passed (12.25 seconds for Vite, bundle-size warning retained). Complete web ESLint passed with 0 errors / 12 existing warnings. Changed-file Biome passed.
- Complete web regression passed: 245 files / 1,630 tests in 710.44 seconds. No backend code changed; backend-wide tests were not rerun for this UI-only extension. Previously reproduced backend baseline failures are referenced from the CTMS-415 contract, not claimed as freshly reproduced on this UI branch. Aggregate pnpm lint:all/build:all/test:all and remote CI are not claimed as passed.
- Playwright was run against an already-running dedicated Vite server using a temporary configuration outside Git to avoid the previously observed Windows managed-server teardown hang. Application/test assertions were not disabled; no mock preview page or evidence media is committed.
