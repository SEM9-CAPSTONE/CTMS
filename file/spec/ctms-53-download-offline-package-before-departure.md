# CTMS-053 — Download Offline Package Before Departure

## 1. Overview

Story: CTMS-053

Epic: EPIC 8. Offline Package

Use Case: Download Offline Package Before Departure

Priority: Must Have

Goal: Allow an eligible Trip participant to reliably download the required Offline Safety Package before departure.

## 2. Scope

### In Scope

- Package download.
- Package size.
- Download progress.
- Storage check.
- Resume interrupted download.
- Package/version context.
- Sensitive-data invalidation.

### Out of Scope

- Package generation.
- Checksum validation logic — CTMS-054.
- Offline rendering.

## 3. Actors & Authorization

- Camper with valid Trip participation.
- Porter with valid Assignment where applicable.
- System.

## 4. Preconditions & Dependencies

Dependency:

- CTMS-052.

Package exists for the Trip.

## 5. Business Rules

| BR         | Rule                                                                                                                                                                                                                                                                                                                                                                                |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-231     | When downloading an offline package, the UI must show package size and download progress, support resume after interruption, and verify that the device has sufficient storage before completion.                                                                                                                                                                                   |
| BR-230     | When sharing_consent is withdrawn, the server must immediately terminate access to medical data. Any downloaded Offline Safety Package containing medical data must be marked invalid/outdated for the sensitive portion; at the next sync/connectivity opportunity, the client must purge or lock that medical data and must no longer treat the local copy as authorized for use. |
| BR-212     | Any change to a Business Rule, enum, state transition, or API contract must be reflected in the specification, test cases, and data documentation before the work is considered Done.                                                                                                                                                                                               |
| BR-213     | Every Business Rule must have at least one valid-path test and one violation-path test. Concurrency, idempotency, and transaction rules require integration or E2E coverage.                                                                                                                                                                                                        |

## 6. State & Lifecycle

Not downloaded
→ downloading
→ downloaded
→ integrity validation handled by CTMS-054.

Interrupted:
downloading → interrupted → resumed.

Insufficient storage must not become completed.

## 7. Business Flow

1. User opens Offline Package action.
2. Verify Trip/package access.
3. Fetch package metadata and size.
4. Check available device storage.
5. Begin download.
6. Display progress.
7. Persist resumable download state.
8. Resume after recoverable interruption.
9. Complete byte transfer.
10. Pass package to integrity verification.

## 8. Data & Invariants

- UI shows package size.
- UI shows progress.
- Download supports resume.
- Storage sufficiency checked.
- Download completion alone does not prove package integrity.
- Package remains associated with correct Trip/version.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                   | Expected                                     |
| ---------------------- | -------------------------------------------- |
| Insufficient storage   | Warn/fail before valid completion            |
| Connection interrupted | Preserve resumable state                     |
| App restarted          | Resume where supported                       |
| Access revoked         | Reject further authorized download           |
| Consent revoked        | Sensitive content must not remain authorized |

## 11. Acceptance & Test Matrix

| Scenario             | Expected                                            |
| -------------------- | --------------------------------------------------- |
| Normal download      | Progress displayed                                  |
| Large package        | Size displayed                                      |
| Insufficient storage | Completion prevented                                |
| Network interruption | Resume supported                                    |
| Retry                | No unrelated duplicate package state                |
| Consent revoked      | Sensitive content purged/locked according to BR-230 |

## 12. Open Decisions

Exact partial-download protocol and storage-reservation implementation belong to Technical Design.
