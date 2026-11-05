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
