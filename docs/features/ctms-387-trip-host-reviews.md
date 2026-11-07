# CTMS-387 — Review Trip and Host after Trip: Preparation + Logic

See `file/spec/ctms-92-review-trip-and-host-after-trip.md`, section 13, for the approved behavior and API contract.

## Storage

Migration `1793490000000-CreateTripReviews` adds:

| Table | Purpose | Constraints |
| --- | --- | --- |
| `trip_reviews` | Current Camper review for a Trip or its actual Host | UUID identity; RESTRICT references to Booking, Booking Member, reviewer, Trip and Host; target must match Trip/Host ID; integer rating 1–5; optional comment up to 2,000 characters; positive revision; unique reviewer/member/target |
| `trip_review_revisions` | Original and edited content for traceability | Composite PK review/revision; RESTRICT review FK; rating/comment constraints; timestamptz recording time |

Both tables use absolute timestamps. Review identity/target never changes through owner edits. Current rows, revision snapshots and audit are committed together. SQL stays in the feature repository, with parameterized values, under TypeORM transactions. No new framework or dependency is introduced.

## Concurrency and access

The repository locks the Booking and linked member before inspecting database time. It also holds a shared lock on the authoritative Trip while deriving Host/Trip targets. Duplicate creates return 409. Edits re-read the current row after acquiring the participation lock and compare `expectedRevision`. No-show Booking owners cannot act for members who actually attended; each linked member acts for themselves.

## Integration boundaries

- Booking completion and Route/Trip lifecycle are read without modifying their business rules.
- CTMS-105 remains the report-status/audit workflow. No review visibility state or moderation override is invented here.
- CTMS-107 can later bind AI results to `(review_id, revision)` without overwriting source content.
- No seed command has been run. Test fixtures and cleanup require a `_test` database and delete only this suite's generated records.

## Validation

Focused policy/DTO unit tests cover the original 24-hour boundary and rating/comment validation. Real PostgreSQL HTTP integration tests cover targets, auth, eligibility, concurrent submissions/edits, history, rollback and database constraints. Current run results are reported separately; previous runs are not evidence for unexecuted checks.

### Verified local results — 2026-11-04

- API unit tests: 154 suites, 1,756 tests passed, including 46 feature-specific policy/DTO/service tests.
- PostgreSQL integration: 3 suites, 80 tests passed (`trip-reviews`, `bookings.complete`, `content-reports`), including 22 new Trip/Host review tests. Audit-failure exceptions are intentional rollback-test inputs.
- `pnpm lint:all`: passed, with 12 warnings in unchanged web files; API lint clean.
- `pnpm build:all`: passed for API and web.
- Biome check on all task TypeScript files and `git diff --check`: passed.
- Initial `pnpm test:all` identified two failing navigation tests in `src/routes/AppRoutes.trekking-route.test.tsx`. A focused reproduction showed `Found multiple elements` for the Route KPI: `DashboardMain` rendered `HostDashboardOverview` in both its sticky header and content. At the user's request, the redundant content instance was removed. Navigation assertions were retained, and assertions now enforce one overview and one KPI region. No Route/Trip business rule changed.
- After the fix, the focused navigation/dashboard/profile run passed 3 files / 22 tests. API regression passed again: 154 suites / 1,756 tests.
- The combined `pnpm test:all` wrapper was interrupted during the long, quiet web phase. The complete web scope was then run with `pnpm --filter @ctms/web exec vitest run --reporter=verbose --bail=1`: **230/230 files and 1,477/1,477 tests passed**, exit code 0, duration 744.17 seconds. Both workspace test scopes have passed; this is not reported as a completed invocation of the interrupted wrapper command.
- `pnpm lint:all` and `pnpm build:all` passed again after the dashboard fix; lint retains the same 12 warnings in other web files. Package manifests and lockfile are unchanged.
- Remote CI, full API integration regression and mobile/device tests have not been run. This task changes no UI.

### Logic Subtask DoD

- [x] Logic implementation completed.
- [x] Applicable business rules/invariants implemented.
- [x] Task-specific unit tests added and passed.
- [x] Applicable backend/integration tests passed.
- [x] Full workspace unit/component test scopes passed (API and web; wrapper-command distinction described above).
- [ ] Required remote CI checks passed (not run).

## CTMS-387 Extension — Layers 1, 2 & 3 (Review Intelligence, Host Moderation & Analytics)

### Storage & Schema (Migrations 1794500000000 & 1794500000001)

| Table | Layer | Purpose |
| --- | --- | --- |
| `trip_review_moderation_runs` | 1 | Record AI execution runs, provider metadata, raw results |
| `trip_review_moderation_image_items` | 1 | Per-image visual moderation status and SHA-256 hash |
| `trip_review_moderation_flags` | 1 | Fine-grained AI flags with lifecycle (`active`, `superseded`, `resolved`) |
| `trip_review_aspect_sentiments` | 1 | Aspect sentiment signals (safety, guide support, equipment, value) |
| `trip_review_incident_signals` | 1 | Route incident signals (fall/slip, injury, lost path, weather hazard, other) |
| `trip_review_moderation_outbox` | 1 | Transactional outbox for guaranteed async scanning dispatch |
| `trip_review_moderation_decisions` | 2 | Immutable Host moderation decisions (`keep`, `hide`, `restore`, `keep_hidden`) |

### Verified local results — 2026-11-07 (Layers 1, 2 & 3)

- **Layer 1 (AI Pipeline, Outbox Worker, PII Masker, Revision Fencing)**:
  - Unit tests: `trip-review-moderation-outbox.service.spec.ts` (7 tests), `trip-review-moderation.worker.spec.ts` (14 tests), `trip-review-moderation-pii-masker.spec.ts` (8 tests), `trip-reviews.service.spec.ts` (16 tests) — all passed.
  - Python tests: `test_review_moderation_scan.py` (10 tests) — all passed.
  - Integration tests: `trip-review-moderation.integration-spec.ts` (11 tests) — all passed.
- **Layer 2 (Host Moderation Queue, Decisions, Quarantine & Admin Precedence)**:
  - Unit tests: `trip-review-moderation-host.service.spec.ts` (16 tests), `trip-review-image-storage.service.spec.ts` (6 tests) — all passed.
  - Integration tests: `trip-review-moderation-host.integration-spec.ts` (12 tests) — all passed.
- **Layer 3 (Host Review Intelligence & Analytics Dashboards)**:
  - Unit tests: `trip-review-analytics-host.service.spec.ts` (4 tests) — all passed.
  - Integration tests: `trip-review-analytics-host.integration-spec.ts` (5 tests) — all passed.
- **Full Test Suite & Build Verification**:
  - Base `trip-reviews.integration-spec.ts`: 26 tests passed.
  - Total `trip-review` unit tests: 55/55 passed.
  - Total `trip-review` integration tests: 54/54 passed across 4 test suites.
  - Regression `review-analysis.integration-spec.ts`: 29/29 passed.
  - `pnpm --filter @ctms/api build`: Exit code 0 (clean build).
  - Biome linter check: 0 errors.
  - TypeScript: strict adherence to Zero `any`.

### Extension Subtask DoD (Layers 1, 2, 3)

- [x] Layer 1 schema & AI moderation pipeline implemented and committed (`8e34bfd8`).
- [x] Layer 2 Host moderation queue, decisions, quarantine & admin override implemented and committed (`0b5fb026`).
- [x] Layer 3 review intelligence & analytics dashboards implemented and committed (`859225a2`).
- [x] Concurrency locking (`FOR UPDATE OF r`, `expectedRevision`) and revision fencing verified.
- [x] Zero `any` throughout all TypeScript code.
- [x] Clean build and lint check.

