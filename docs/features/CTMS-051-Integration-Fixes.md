# Knowledge ingestion integration fixes — 2026-11-20

The original reported baseline was 56 passing and 8 failing tests across the selected suites. The user's subsequent run reported 57 passing and 8 failing tests, with survival-documents passing. Its failure list no longer includes the earlier SQL, checksum or superseded-version failures; it reveals the fixture issues detailed below. **The final PostgreSQL integration result is still unverified:** the local rerun failed with `connect EACCES 127.0.0.1:55451` during global setup, before any test ran. Container health does not establish socket access from this execution environment.

## Follow-up: eight failures from the user's 57/65 run

All changes in this follow-up are in test fixtures, a provider regression test, and this report. Runtime source storage, OCR validation, eligibility, chunk generation and retrieval behavior are unchanged.

| Failing case | Confirmed cause from the stack and code | Fix |
| --- | --- | --- |
| Historical inline vector reuse | The fixture changes `embedding_text` after its extraction snapshot was captured. Validation correctly rejects the prepare response after one HTTP call, before passage embedding. | Build matching synthetic evidence with `withIntegrity(prepared)` at the response boundary. Retain the two-call assertion and the assertion that only the changed passage is encoded. |
| Outbox exactly once | TypeORM's installed PostgreSQL driver returns raw UPDATE results as `[rows, affectedCount]`. The fixture mistook this tuple for returned rows. | Use `WITH changed AS (UPDATE ... RETURNING id) SELECT id FROM changed`, which returns SELECT rows, and require exact equality with the expected version ID. Keep the one-source assertion. |
| Concurrent reconcile | Same restricted-publication helper and raw UPDATE tuple error. | Same SELECT-returning CTE; keep the two eligible current versions and concurrent enqueue assertions. |
| Replacement retention/dependencies | The replacement fixture changes `embedding_text` while retaining its previous snapshot. | Refresh synthetic evidence after defining the replacement. Preserve retention locks, dependency checks and expected vector counts. |
| Vietnamese answers using English evidence | The shared `ready(doc, content)` helper changes source content and embedding input but keeps stale snapshot text. | Refresh synthetic evidence after the helper finishes defining that source. Preserve generation, citations and withdrawal assertions. |
| Mixed eligible corpus | Same shared `ready(doc, content)` helper with stale snapshot text. | Same evidence refresh; retain global candidate-limit and multilingual source assertions. |
| Withdrawal during tokenization | The second source fixture changes content and embedding input after snapshot creation. | Refresh synthetic evidence before finishing that source; retain whole-snapshot withdrawal assertions. |
| 2,000-vector benchmark | The fixture expands two prepared chunks into 2,000 output chunks, leaving the original two-chunk snapshot. | Build matching 2,000-chunk synthetic evidence; retain vector count, ranking, token and benchmark assertions. |

The earlier attempted fixture update had not been applied at these call sites; they are now explicitly patched. Invalid output tests are not wrapped or repaired. A new provider regression proves that a mismatched prepare response still fails before checkpointing or vector lookup. Existing positive provider coverage verifies encoding of only unique cache misses.

Follow-up validation: **146/146 unit tests passed in 9 suites**, TypeScript passed including both integration files, Biome passed for both edited test files, and `git diff --check` passed. Integration was attempted again but global setup failed with EACCES. All eight PostgreSQL cases therefore still require the rerun command at the end of this report. The `audit unavailable` log in the user's passing survival-documents suite comes from its intentional audit-failure rollback test.

## Failure analysis and changes

| Reported failure | Code-level cause | Change and correctness | Remaining verification |
| --- | --- | --- | --- |
| Content verification SQL | `ContentVerificationService.verify` used `$4` in a varchar status assignment and an untyped CASE comparison, creating conflicting PostgreSQL parameter inference. | Cast both uses to `$4::varchar`. The document lock, expected revision, request replay, authorization and transactional audit remain in place. | Execute the existing real-DB audit/access/replay/conflict integration case. Unit tests do not establish PostgreSQL parameter compatibility. |
| Original checksum, legacy `ctms-hybrid-v1` reprocessing | Test cleanup removed derived sets but retained published source documents. Reconciliation could legitimately enqueue prior cases' documents; `claim` was not guaranteed to return the case's PDF. The assertion compared that different source's bytes to the earlier claim. | Isolate source documents and their outbox between cases in the guarded test database. Assert both claims' version and checksum, then byte-for-byte equality with the actual upload and the reader manifest. Keep the SHA-256 assertion. No production reader or storage behavior changed. | Rerun the real-DB case; the prior reported checksum failure could not be reproduced locally because socket access is blocked. |
| Original checksum, legacy `ctms-hybrid-ocr-v2` reprocessing | Same cross-case reconciliation/claim contamination. | Same isolation and stronger immutable-source assertions. | Rerun the corresponding parameterized real-DB case. |
| Original checksum, legacy `ctms-hybrid-ocr-v3` reprocessing | Same cross-case reconciliation/claim contamination. | Same isolation and stronger immutable-source assertions. | Rerun the corresponding parameterized real-DB case. |
| Extra outbox ingestion | The negative fixture was a published FIRST_AID source with NOT_REVIEWED medical status. Existing CTMS-050 eligibility permits that status; explicit medical rejection or restricted rights block processing. | Replace the negative fixture with explicitly RESTRICTED rights while still DRAFT, then publish through the real API. Keep the expected one eligible document. Add a positive case for concurrent consumption of the permitted NOT_REVIEWED source. Do not tighten production source eligibility. | Execute concurrent consume/replay and the added positive case on PostgreSQL. |
| Extra reconcile enqueue count | Same obsolete negative fixture, compounded by published documents retained from earlier tests. A reconcile scan intentionally finds all eligible current publications missing derived work. | Use the restricted fixture and isolate case data. Keep the expected total of two queued versions, current A3 and B1, plus one skipped restricted source on rerun. Remove the earlier dummy-derived-set workaround. | Execute concurrent reconciliation to verify aggregate counts and unique-set behavior. |
| Supersede during generation | The interim RAG policy treated an explicit pointer to SUPERSEDED V1 as eligible. Final evidence checks reused that permissive selection. | `RagRepository.publications` now joins the exact document current version and set source version, requires PUBLISHED and READY, and calls strict source eligibility with the actual current version ID. Existing final `withCurrentEvidence` locking and provenance checks use that same selection. The unchanged integration assertion requires INSUFFICIENT_CONTEXT after supersession. | Execute the provider-callback supersession integration case, including the final persistence fence. |
| V1 during V2 rebuild | The retained publication pointer was treated as retrieval authority even after V1 was superseded. | Deny superseded versions regardless of retained history pointers. A status summary is active only when its set belongs to the current published PDF. Preserve old rows without retrieving them; activate only the complete current V2 atomically. | Execute pending/review/complete V2 cases and confirm V1/V2 isolation. |

## Source and integrity boundaries

`SurvivalSourceReader.readPublished` already locks the source document, requires the exact current PUBLISHED version and reads its stored immutable file reference. `SourceFilesService.read` checks both byte length and SHA-256 against that version. New reader tests use real temporary filesystem bytes and cover repeated reads, rejection of modified source bytes, and denial of superseded/non-current sources before file reading. The repository and database transaction are test doubles in these unit tests; they do not replace the PostgreSQL integration coverage.

The v5 evidence comparison now compares canonical JSON values instead of JavaScript object prototypes. HTTP response objects and JSONB may have different prototypes or property order. Content, order, locations and all other prepared values must still match. Tests explicitly reject changed instructions and source coordinates, accept harmless key reordering, and reject malformed null chunks. Valid synthetic provider fixtures that deliberately change prepared text or locations are refreshed with matching fixture evidence; negative fixtures remain invalid. No runtime OCR verification is bypassed.

Superseding a PDF version differs from rebuilding a derived generation of the same PDF. A compatible complete active generation can remain eligible during a derived rebuild only if its source is still the current PUBLISHED version. There is no fallback to a superseded source. Historical citation records remain historical; they do not authorize new retrieval or generation.

## Files changed for these failures

- `services/api/src/modules/knowledge-chunks/content-verification.service.ts`: typed SQL parameter.
- `services/api/src/modules/knowledge-chunks/knowledge-chunks.policy.ts` and its spec: JSON evidence comparison and regression cases.
- `services/api/src/modules/knowledge-chunks/knowledge-chunks.repository.ts`: exact-current-version active summary.
- `services/api/src/modules/rag/rag.repository.ts` and `rag-publication.policy.spec.ts`: strict current-source fencing.
- `services/api/src/modules/survival-documents/survival-source-reader.service.spec.ts`: real filesystem integrity regressions.
- `services/api/test/knowledge-chunks.integration-spec.ts`: case isolation, source-byte assertions, accurate eligibility fixtures and strict version fencing.
- `docs/features/CTMS-051-Content-Integrity.md`, `CTMS-051-Implementation.md`, and `file/spec/ctms-51-split-documents-into-knowledge-chunks.md`: remove the superseded-V1 policy and distinguish same-source derived rebuilds.

No migration, production source-reader change, Admin UI change, deployment or production-data update is required by this eight-failure fix. The nullable extraction-cache migration from the wider content-integrity feature remains separate.

## Executed validation

- **145/145 tests passed, 9/9 suites:** content verification, chunk policy, ingestion provider, worker, RAG publication policy, RAG retrieval, source policy, immutable source reader, and AI answers service.
- **TypeScript passed:** API compilation and an additional compiler run including both `knowledge-chunks.integration-spec.ts` and `survival-documents.integration-spec.ts`.
- **Biome passed:** seven directly edited SQL/policy/RAG/reader/integration files.
- **`git diff --check` passed.** Git emitted line-ending notices, without whitespace errors.
- **Integration attempted, blocked before test execution:** both affected suites were selected against `ctms_pdf_integrity_test` on port 55451. Global database setup failed with EACCES. The previously reported survival-documents pass belongs to the user's earlier run; it is not a new passing result from this session.

The unit suites were executed with the installed Jest binary to avoid a Corepack download. Full command, from `services/api`:

```powershell
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath `
  src/modules/knowledge-chunks/content-verification.service.spec.ts `
  src/modules/knowledge-chunks/knowledge-chunks.policy.spec.ts `
  src/modules/knowledge-chunks/knowledge-chunks.provider.spec.ts `
  src/modules/knowledge-chunks/knowledge-chunks.worker.spec.ts `
  src/modules/rag/rag-publication.policy.spec.ts `
  src/modules/rag/rag-retrieval.service.spec.ts `
  src/modules/survival-documents/source-policy.spec.ts `
  src/modules/survival-documents/survival-source-reader.service.spec.ts `
  src/modules/ai-answers/ai-answers.service.spec.ts
```

Run the remaining integration verification from the project root, against the isolated test container only:

```powershell
docker compose -f docker-compose.test.yml up -d --wait postgres
$env:TEST_DATABASE_URL = 'postgresql://ctms:ctms@127.0.0.1:55451/ctms_pdf_integrity_test'
pnpm --filter @ctms/api run test:integration --runTestsByPath `
  test/knowledge-chunks.integration-spec.ts `
  test/survival-documents.integration-spec.ts
```

The remaining risk is unexecuted PostgreSQL behavior, especially parameter inference, CAS/audit rollback, concurrent claim/reconcile counts and final generation fencing. No claim that all eight integration failures have passed is made until that command completes successfully.
