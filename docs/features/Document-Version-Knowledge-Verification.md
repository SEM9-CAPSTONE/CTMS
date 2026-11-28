# Implementation and verification report — 2026-11-28

Scope: the approved CTMS-050/051/220/068/069 document version lifecycle amendment. Implementation is present in the working tree. No commit, push, deployment or external Jira change was performed.

## Implemented workflow

An eligible DRAFT is scheduled through the existing outbox, leased worker, full-PDF extraction/quality pipeline and shared exact-input embedding cache. Unconfirmed uploaded sources can be explicitly confirmed for preparation without being published. The current eligible publication remains the retrieval source during replacement preparation, review or failure. READY drafts stay private. Explicit publication checks both revisions, current permissions and complete prepared knowledge, then switches the source and knowledge pointers, supersession, audit and outbox in the same transaction.

Relevant input changes fence stale work through input revision/title binding and the existing leases. Source and embedding configuration checks remain independent. Historical restoration creates a new draft; partial ABCF restoration retains unrelated F content, and full restoration records a same-document source and reason. Restored composed PDFs retain their adaptation and exact-PDF medical approval requirements by following restoration provenance. No previous approval is copied to the restored version. Stop-use remains immediate and cannot select a historical fallback.

Parser, chunker, embedding model, source quality gates and history/orphan-vector cleanup policy were not replaced. No inter-version incremental chunking or similarity cache was added.

## Main changed components

| Files/components | Change |
| --- | --- |
| `services/api/src/modules/survival-documents/survival-documents.service.ts`, controller, DTOs and types | Draft confirmation/preparation, input invalidation, two-revision publication, atomic activation and full restoration. |
| `source-policy.ts`, `survival-source-reader.service.ts` | Separate private preparation eligibility/reader from production publication eligibility. |
| `document-editor.policy.ts`, `document-editor.service.ts` | Preserve existing section restoration; reject content no-ops and retain composition authorization through full-restoration chains. |
| `services/api/src/modules/knowledge-chunks/knowledge-chunks.repository.ts`, worker and types | Draft scheduling, configuration/input identity, lease/checkpoint/completion fencing, private READY completion and complete prepared-set publication validation. Configuration hashes reconstruct a stable key order after JSONB round trips. |
| `content-verification.service.ts` | Verify current draft inputs, retain source-bound review gates and report completion count/time. |
| `services/api/src/modules/rag/rag.repository.ts` | Continue requiring the current publication/active READY pointer; additionally bind source title and input revision. Draft knowledge remains excluded. |
| Web `SourceDetail`, `SourceVersionActions`, `SourceChunkingStatus`, provenance, editor buttons, hooks and service | Prepare separately from publish, gate publication on current READY inputs, display authoritative status/count/time, restore with preview/reason, retain failed restoration input and localize action errors through existing toast components. |
| Unit, integration and E2E tests | Extend existing suites and add draft lifecycle, same-transaction publication, medical restoration, database/reference and migration coverage. Browser fixtures use the existing worker with deterministic parser responses. |

## Database changes

`1799000000000-PrepareDraftKnowledge.ts` adds version preparation/input/restoration provenance, binds chunk sets to input revision and title, extends the existing set uniqueness and outbox idempotency keys, and freezes published preparation/restoration provenance. Backfill retains existing chunk IDs, vector references, source versions and active pointers without corpus re-ingestion. The deferred same-document restoration FK permits whole-document deletion without allowing unrelated restoration sources.

Downgrade refuses restoration records or newer/multiple input revisions that the prior schema cannot represent. It does not delete those histories to force a downgrade. Runtime migration compatibility and rollback still require the PostgreSQL integration run described below.

The pre-existing `1798900000000-RequeueKnowledgeTransportFailures.ts` and the preceding HTTP timeout fix remain intact. Existing in-progress timeout/provider tests, `.env.example`, Compose timeout forwarding, pinned dependency and lockfile changes were preserved. Incidental formatter-only line-ending changes to unrelated files were removed. The final diff was inspected and `git diff --check` passed.

## Actual verification results

| Check | Result |
| --- | --- |
| Biome on changed/new TypeScript, TSX and JSON files | Passed. |
| API TypeScript, including affected HTTP/integration fixtures | Passed. Used the existing cached `undici` package as the compiler resolver. |
| Web `tsc -b --pretty false` | Passed. |
| API unit suites: survival documents, policies/readers, knowledge ingestion, draft lifecycle, publication, verification and RAG | **243 passed, 16 suites.** Includes resolving the production document/knowledge module graph to one shared repository instance without a second pipeline. |
| Web survival-document suites | **52 passed.** |
| PostgreSQL integration command | Blocked in global setup: `connect EACCES 127.0.0.1:5432`; scenario bodies did not execute. |
| Playwright survival-document command | Blocked before browser tests: its API web server failed at the same PostgreSQL connection. |

Executed test commands from repository root, unless a working directory is stated:

```powershell
node services/api/node_modules/jest/bin/jest.js --config services/api/jest.config.js --modulePaths D:/Capstone/CTMS/node_modules/.pnpm/undici@7.29.0/node_modules --runInBand survival-documents source-policy survival-source-reader knowledge-chunks knowledge-draft-lifecycle document-publication content-verification rag- --json --outputFile=D:/Capstone/CTMS/node_modules/.cache/ctms-lifecycle-api-tests.json

node services/api/node_modules/jest/bin/jest.js --config services/api/test/jest-integration.json --modulePaths D:/Capstone/CTMS/node_modules/.pnpm/undici@7.29.0/node_modules --runInBand document-version-lifecycle.integration-spec.ts survival-documents.integration-spec.ts knowledge-chunks.integration-spec.ts
```

Executed from `apps/web`:

```powershell
node node_modules/vitest/vitest.mjs run src/features/survival-documents/ --reporter=json --outputFile=D:/Capstone/CTMS/node_modules/.cache/ctms-lifecycle-web-tests.json
node node_modules/typescript/bin/tsc -b --pretty false
node node_modules/@playwright/test/cli.js test --config playwright.survival-documents.config.ts
```

Biome was run through its local Node entrypoint against the union of changed/new `.ts`, `.tsx` and `.json` files. API checking used TypeScript `createProgram` with `noEmit`, the API compiler configuration, the affected test files and the cached `undici` resolver. Corepack could not download the requested pnpm version in this environment, so verification used the installed tools directly rather than claiming a successful package installation or container build.

## Evidence and remaining limits

| Capability | Evidence available | Not yet verified here |
| --- | --- | --- |
| Historical embedding reuse | Existing provider boundary tests check distinct embedding-generation misses and retained exact inputs. Code inspection confirms same-document historical shared/legacy cache lookup, exact input/hash/configuration and vector validation. New integration cases inspect generation calls and actual `embedding_id` references for ABCD → ABED → ABCD, missing C and changed boundaries. | The new database reference assertions have not executed because PostgreSQL setup was blocked. |
| Atomic publication | Unit tests exercise the actual publication service and require the document lock, prepared-set validation, lifecycle/outbox writes and activation to use the same transaction manager. Code inspection confirms validation before supersession. | Actual PostgreSQL rollback, concurrent publication and committed snapshot behavior are covered by new integration cases but not executed here. |
| Draft isolation | Unit tests complete a draft READY set without either publication pointer write and reject draft retrieval eligibility. RAG SQL continues to join only the current PUBLISHED version and its active READY set. | End-to-end production repository queries and browser publication flow are pending the database-enabled run. |
| Restoration approval | Unit tests prove ABCF ordering/provenance and current adaptation/specialist rejection for restored compositions. Source policy and UI tests pass. | Full persisted historical restoration and migration down/up need the integration database. |

Affected specifications and implementation documents were synchronized: CTMS-050, CTMS-051, CTMS-068, CTMS-069, the explicit CTMS-220 editor contract, and [the workflow/API/schema/diagram document](Document-Version-Knowledge-Lifecycle.md). Existing BR identifiers were extended in place; no new BR IDs were invented.

The code and unit verification are complete for this working-tree change. Acceptance criteria requiring real database concurrency, persisted embedding references, migration execution and browser E2E remain unverified and must pass before calling the complete scope verified or deploying it. Normal switching continuity does not imply infrastructure availability or override intentional safety withdrawal.
