# CTMS-054 — Verify Offline Package Integrity

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

TBD — Technical Design.

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
