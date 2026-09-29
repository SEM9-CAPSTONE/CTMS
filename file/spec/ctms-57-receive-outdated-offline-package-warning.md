# CTMS-057 — Receive Outdated Offline Package Warning

## 1. Overview

Story: CTMS-057

Epic: EPIC 8. Offline Package

Use Case: Receive Outdated Offline Package Warning

Priority: Must Have

Goal: Clearly warn users when their downloaded safety package no longer matches the required authoritative source versions.

## 2. Scope

### In Scope

- Display package version.
- Display update time.
- Detect outdated package.
- Route version changes.
- Weather source changes.
- Survival-knowledge changes.
- Medical-consent invalidation.
- Pre-start package update policy.

### Out of Scope

- Package generation.
- Package download implementation.
- Hot-updating an ongoing Trip.

## 3. Actors & Authorization

- Camper.
- Porter.
- System.

## 4. Preconditions & Dependencies

A downloaded package exists.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                                                                                                                                                                                                                |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-235 | The system must display the current package version and last update time and must warn when changes to Route, weather, or survival-knowledge source versions make the downloaded package outdated.                                                                                                                                                                                  |
| BR-230 | When sharing_consent is withdrawn, the server must immediately terminate access to medical data. Any downloaded Offline Safety Package containing medical data must be marked invalid/outdated for the sensitive portion; at the next sync/connectivity opportunity, the client must purge or lock that medical data and must no longer treat the local copy as authorized for use. |

## 6. State & Lifecycle

Downloaded/current
→ authoritative source version changes
→ outdated.

V3 package policy:

- Trip not started: required new package must be downloaded, validated and activated before Start Trip where applicable.
- Trip already started: continue using package version activated at Start Trip; no safety-package hot update during ongoing Trip.

## 7. Business Flow

1. Client knows downloaded package version.
2. Obtain current required package/source version when connected.
3. Compare package context.
4. If unchanged, remain current.
5. If relevant source/version changed, mark/warn outdated.
6. Display package version and update time.
7. For not-started Trip, direct user through required update flow.
8. For ongoing Trip, preserve active package version.
9. If consent revoked, purge/lock sensitive medical section.

## 8. Data & Invariants

- Package version visible.
- Package update time visible.
- Outdated state not hidden.
- Ongoing Trip retains activated version.
- Not-started Trip cannot silently start with disallowed outdated version.
- Consent revocation overrides cached sensitive-data permission.

## 9. API / Integration Contract

TBD — Technical Design.

## 10. Error & Edge Cases

| Case                                  | Expected                                                        |
| ------------------------------------- | --------------------------------------------------------------- |
| Route version changes before Trip     | Outdated warning/update required                                |
| Knowledge source changes              | Outdated according to package policy                            |
| Ongoing Trip gets new package release | Continue active package                                         |
| Consent revoked                       | Sensitive section invalid/purged/locked                         |
| Cannot check server while offline     | Show known local version; do not claim current without evidence |

## 11. Acceptance & Test Matrix

| Scenario             | Expected                       |
| -------------------- | ------------------------------ |
| Current package      | Current state                  |
| Source changes       | Outdated warning               |
| Version displayed    | Correct local version          |
| Trip already started | No hot update                  |
| Trip not started     | Required update policy applied |
| Consent revoked      | Sensitive content unavailable  |

## 12. Open Decisions

No additional hot-update mechanism should be introduced in V3 unless PB/BR is explicitly changed.
