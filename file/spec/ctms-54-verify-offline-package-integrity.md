# CTMS-054 — Verify Offline Package Integrity

## CTMS-052 archive handoff — 2026-11-06

BR-232 uses SHA-256 over the complete ZIP, obtained from authenticated server metadata outside the artifact. Validate schemaVersion 1, Trip/package identity, exact required entries and per-payload hashes in manifest.json before activation. Reject unknown schemas, duplicate/unexpected paths, traversal paths, missing/truncated files or byte mismatch; apply extraction size limits. The manifest cannot contain the digest of its containing ZIP. Freshness of hazard/weather sources is separate from integrity; a matching hash does not establish current safety. Acceptance: valid bytes activate only for the expected Trip/version; tampered/absent/malformed content becomes `failed` and can be re-downloaded. No client decoder is implemented in 052.

## 1. Overview

Story: CTMS-054

Epic: EPIC 8. Offline Package

Use Case: Verify Offline Package Integrity

Priority: Must Have

Goal: Prevent an invalid Offline Safety Package from being used for offline safety operation.

## 2. Scope

### In Scope

- Checksum verification.
- Valid/failed outcome.
- Retry/re-download.

### Out of Scope

- Package generation.
- Download transport.
- Package outdated detection.

## 3. Actors & Authorization

- Client/System.

## 4. Preconditions & Dependencies

Dependency:

- CTMS-053.

Package has been downloaded.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                   |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-232 | The client/system must verify the checksum before using a package. An invalid package must transition to failed and support redownload. The system must not invent a corrupted status if the enum does not support it. |

## 6. State & Lifecycle

Downloaded
→ checksum verification
→ valid/usable

or

Downloaded
→ checksum mismatch
→ `failed`
→ re-download.

## 7. Business Flow

1. Read downloaded package.
2. Read authoritative checksum.
3. Calculate checksum locally.
4. Compare.
5. If match, allow package to continue activation/use.
6. If mismatch, mark `failed`.
7. Prevent invalid package use.
8. Offer/retry download.

## 8. Data & Invariants

- Integrity verified before use.
- Checksum mismatch cannot be treated as success.
- Failed package cannot be silently activated.
- Status `corrupted` must not be invented.

## 9. API / Integration Contract

- CTMS-223 verifies the account-scoped ZIP automatically after a complete transfer and on local recovery. The client uses the exact artifact metadata pinned by CTMS-053.
- Schema 1 uses the stored ZIP entries emitted by CTMS-052. The verifier checks the whole ZIP size and SHA-256, ZIP entry names and CRC, manifest identity, and exact payload paths, sizes and SHA-256 values. It runs off the UI isolate and bounds the archive read to 20 MiB plus one byte.
- An active reference is separate from both the transfer journal and the verification result. A replacement requires a matching, freshly authorized metadata response with `activationAllowed: true`. An ongoing Trip retains its active reference. The previous ZIP is retained.
- CTMS-055 reads via the account-scoped `PackageDownloadController.openActive(packageVersion)` boundary. It returns only the checked snapshot of the selected Trip's active version. Known access denial blocks activation and reads. Failed verification also blocks reads.

See [CTMS-223 business flow and local records](../../docs/features/CTMS-223-Business-Flow.md).

## 10. Error & Edge Cases

| Case                     | Expected              |
| ------------------------ | --------------------- |
| Checksum matches         | Valid                 |
| Checksum mismatch        | failed                |
| Package truncated        | failed                |
| Verification interrupted | Do not mark valid     |
| Retry download succeeds  | Verify new copy again |

## 11. Acceptance & Test Matrix

| Scenario           | Expected            |
| ------------------ | ------------------- |
| Correct checksum   | Package accepted    |
| Wrong checksum     | failed              |
| Missing bytes      | failed              |
| Verification error | No false success    |
| Re-download        | Verification reruns |

## 12. Open Decisions

Checksum algorithm belongs to Technical Design unless already fixed by the Data Dictionary.
