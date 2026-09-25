# CTMS-86 Route review follow-up

## Pre-flight and source authority

- Branch: `fix/CTMS-86-route-review-comments`.
- Starting HEAD: `9367af4985cb9da22933a46dc836d695df98d099`.
- HEAD, local `develop`, and locally recorded `origin/develop` matched (0 ahead / 0 behind). No fetch was performed.
- Redesign merge `161e90b` (PR #679) is an ancestor of HEAD; implementation `b19e134` is present. The old merged branch was not modified.
- Initial unrelated work: modified `apps/web/test-results/.last-run.json` and untracked content-reports/create-trip Playwright result directories. These were preserved.
- Reviewed PB v3.1, Business Rules workbook, and Use Case–Database Mapping were not available in this checkout. Their location was requested. This review must not be represented as a completed workbook reconciliation.
- Read current tracked specs: [CTMS-10](../file/spec/ctms-10-create-trekking-route-on-map.md), [CTMS-11](../file/spec/ctms-11-create-checkpoints-on-route.md), [CTMS-13](../file/spec/ctms-13-approve-trekking-route.md), [CTMS-61](../file/spec/ctms-61-automatically-detect-checkpoint-arrival.md), and safety rules in [CTMS-65](../file/spec/ctms-65-reliable-synchronization-after-reconnection.md) and [CTMS-97](../file/spec/ctms-97-evaluate-buffer-and-synchronization-mechanism.md).
- BR-441 in CTMS-65/97 explicitly fixes Route Checkpoint arrival at <=20 m with three valid samples. CTMS-11/61's generic materializations do not repeat that numeric threshold.
- Older `docs/planning` exports conflict with current story numbering (for example, CTMS-10 is a campsite story there). They were not used to override current specs.
- The `.agents` guidance describes an E-Hub Prisma/TanStack/i18next stack. Actual CTMS uses TypeORM, custom typed request hooks, and literal Vietnamese strings. Existing CTMS architecture was preserved; no dependency was installed to adopt the unrelated stack.

## Review matrix

| Comment | Initial classification / implementation | Canonical evidence or limitation | Resolution | Files / backend / tests |
| --- | --- | --- | --- | --- |
| One sidebar | ALREADY SATISFIED. Both Route pages are wrapped once in shared HostLayout; no local sidebar. | Shared Host/app layout is already in use. Desktop/mobile variants are responsive navigation. | Keep layout. Add assertions for one navigation/sidebar on Route navigation. | AppRoutes.trekking-route.test.tsx; no backend change. |
| Automatic duration | NOT APPLICABLE to alleged formula; PRODUCT DECISION REQUIRED for slope-aware estimation. | No formula exists in this checkout. Host enters positive integer minutes; backend stores them unchanged. | Retain manual duration and explain that terrain/rest time must be included. | CreateTrekkingRouteForm; positive-duration DTO tests retained/extended. |
| Integrated checkpoints | PARTIALLY SATISFIED. Existing checkpoint/hazard panel was only on management page; creation ended at success. | Child records need a persisted route ID; backend remains authoritative. | Save draft, then continue on same page with existing checkpoint/hazard/submission panel. Reuse workspace on management page. | RouteDraftWorkspace, useDraftRouteWorkspace, create/management pages; existing child APIs reused. |
| Remove water/shelter checkbox | PRODUCT DECISION REQUIRED. Field exists throughout DTO/entity/repository/API, not just UI. | Nearby water/shelter may differ from the checkpoint's own semantic type. Missing reviewed PB prevents verifying redundancy. | Retained UI, mapping, validation, and database field pending source decision. | No removal or inferred conversion. |
| Checkpoint wording | PARTIALLY SATISFIED. Technical checkpoint terminology was exposed. | UI labels can change without renaming domain/API concepts. | Use Tên điểm dừng, Loại điểm dừng, Thêm điểm dừng and consistent map/list/messages. | Feature components/hooks/schema and related assertions. |
| Route section wording | PARTIALLY SATISFIED. Hình học tuyến đường appeared in editor and preview. | Presentation issue. | Vẽ tuyến đường / Bản đồ tuyến đường; explicit save-draft action. | Geometry editor/preview and route form. |
| Owned draft editing | MISSING for route metadata/geometry. Child checkpoint updates already worked. | Host ownership and draft state required. Never broaden active/closed in-place edits. | Add authenticated draft-only update with route lock, audit, spatial/timing checks. | Controller/service/repository/update DTO; shared Web form/service/hook; unit and real integration test coverage. |
| Fixed checkpoint radius | CONFLICTS WITH SPEC. UI default 30, DTO and approval accepted 10–500. | BR-441 fixes safety radius at 20 m. | Remove radius input/state; client emits 20; DTO rejects other values; service normalizes direct calls to 20. Untouched legacy rows remain eligible for submission/approval until a legacy policy is decided. | Checkpoint form/schema/constants, DTO/service, route integrity/readiness, regression tests. |

## Implemented behavior and API contract

1. Save route information and geometry with the existing POST. Only the returned server ID enables checkpoint/hazard preparation. No temporary/fake IDs or second checkpoint subsystem.
2. The saved draft can be edited in the same workspace. The existing route form is prefilled; preparation/submission is hidden during route edits until save/cancel. Failed edits preserve entered values.
3. `PATCH /trekking-routes/:routeId` accepts a complete replacement of editable route fields using `UpdateTrekkingRouteDto`: name, optional description, 2D LineString geometry, difficulty, positive integer expectedDurationMinutes. Omitting description clears it. IDs, Host, status, length and timestamps remain server-controlled.
4. JWT/role guards require Host. The service locks the route, rejects missing records (404), another Host (403), and non-draft state (409). Revisions returned to draft can be edited.
5. Drafts already referenced by Trips are rejected (409). This is a temporary data-integrity safeguard required by current live-FK architecture, because the current schema lacks route snapshots/versioning and in-place edits would alter data relied upon by linked Trips. It is not a canonical Product business rule and is not expanded here.
6. PostgreSQL recalculates distance. Updates that put an existing checkpoint farther than the existing 50 m placement tolerance or shorten duration below a checkpoint's arrival offset return 422. Checkpoint route positions are recomputed after successful geometry edits, inside the same transaction as the route and audit. Checkpoint locations and IDs are preserved.
7. Existing lifecycle actions (submission, approval, revision, close/reopen) remain intact. Route update never changes status.
8. Checkpoint radius is 20 m in UI mapping and service persistence. API clients sending non-20 radii get DTO validation errors; omitted radius defaults to 20. Update DTO inherits the rule. The schema column and existing broad DB constraint remain; all application checkpoint writes enforce 20 without a migration.
9. Legacy non-20 checkpoint rows are not bulk-modified and do not block submission/approval solely because of their stored radius. Current API create/update writes normalize or enforce 20 m; untouched legacy rows remain unchanged. A migration or explicit normalization workflow remains a PRODUCT DECISION REQUIRED item.
10. Hazard-area radii are separate and remain configurable. The 50 m checkpoint-to-route placement tolerance is also distinct from the 20 m arrival threshold.
11. No operational CHECKPOINT_REACHED detector exists in current API/mobile implementation. This change fixes route configuration; it cannot claim to validate an unimplemented runtime detector. Future detection must use BR-441's fixed threshold and sample rule.

## Duration investigation and pending decisions

- MapLibre displays MapTiler styling; it does not currently request routing-provider hiking durations or elevation.
- Distance preview uses the existing Haversine calculation; backend distance uses PostGIS geography length.
- Geometry is strictly 2D. GPX import discards elevation; GeoJSON route schema accepts two-element positions only. No ascent value is stored or available to duration calculation.
- Actual duration algorithm remains **manual Host input, positive integer minutes**. No distance/speed fallback, Naismith/Tobler formula, fabricated slope, or arbitrary difficulty multiplier was introduced.
- PRODUCT DECISION REQUIRED: approve a reliable elevation source (provider/data contract, licensing/quota/key if relevant) or a reviewed GPX-elevation ingestion contract before implementing terrain-aware time estimation. No external API, dependency, key or schema change was added.
- PRODUCT DECISION REQUIRED: provide reviewed PB/Business Rules and decide whether nearbyWaterOrShelter is still supported. If it is retired, define handling of existing values and old clients before removing mappings.
- PB reconciliation remains open for supplied expectations absent as explicit schema fields: porter_required and route version. Current endpoints derive from geometry and distance is stored in metres. No speculative migration was created.

## Validation

The installed pnpm launcher attempted a network bootstrap of pinned pnpm 9.15.0 and failed signature verification after registry fetch failure. Existing installed binaries were invoked directly; no toolchain or dependency was downloaded.

- Focused Web: 45 files / 283 tests passed (Route feature plus AppRoutes Route navigation).
- Focused API: 14 suites / 185 tests passed.
- Full API: 49 suites / 580 tests passed.
- Web and API TypeScript checks: `node node_modules/typescript/bin/tsc --noEmit --incremental false` passed in each app.
- Web Vite build and API Nest build passed. Vite reports existing large output chunks; ts-jest reports its existing isolatedModules deprecation.
- Initial full Web run: 554 passed / 3 failed. Two failures exposed a shared editor mock leak under repository `isolate:false`; the affected tests now reset module caches and clean mocks. One unchanged Admin test exceeded 5 seconds; rerun uses 15 seconds without changing repository configuration.
- Final Web regression: Route-focused suite passed (45 files / 283 tests). Full Web suite still has 3 unrelated equipment-catalog failures (554 passed / 3 failed); the same temporary `develop` archive reproduced the Route navigation assertion failure that this change corrected, while its junctioned baseline run was not a clean comparison for equipment due the isolated temporary path. No equipment files were changed.
- Real integration: `node node_modules/jest/bin/jest.js --config test/jest-integration.json --runInBand --testPathPattern=trekking-route-checkpoints` blocked during setup with ECONNREFUSED 127.0.0.1:5432. Existing safe `_test` database guard was preserved. Added API integration cases are not claimed as passed.
- Docker daemon unavailable; no containers started or compose files changed.
- Playwright real Route E2E: not run because the backing database/API environment is unavailable. No mocked flow is claimed as real E2E.
- Navigation test correction: unchanged dashboard labels already say Quản lý tuyến on develop, while the prior Route navigation test expected Quản lý tuyến trekking. Only the relevant test assertion was updated.

## Git and scope safety

No add, commit, push, merge, reset, stash, or history rewrite was performed. All intended changes remain unstaged. No environment, manifest, lockfile, migration, mobile, or unrelated production code changed. Canonical specs were not rewritten to hide missing source decisions. Original generated artifacts remain unrelated.

Final review verdict: READY TO COMMIT. Nearby water/shelter semantics, terrain-aware duration, and route versioning remain documented PRODUCT DECISION REQUIRED follow-ups, but this branch preserves their existing contracts. Integration/E2E remain unrun because PostgreSQL/Docker are unavailable.
