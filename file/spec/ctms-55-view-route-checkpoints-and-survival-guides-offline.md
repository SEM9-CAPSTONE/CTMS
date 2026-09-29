# CTMS-055 — View Route, Checkpoints and Survival Guidance Offline

## 1. Overview

Story: CTMS-055

Epic: EPIC 8. Offline Package

Use Case: View Route, Checkpoints and Survival Guidance Offline

Priority: Must Have

Goal: Make the downloaded Trip safety information usable without Internet access.

## 2. Scope

### In Scope

- Offline Route.
- Offline checkpoints.
- Offline survival guidance.
- Correct Trip/package version.

### Out of Scope

- Current GPS location — CTMS-058.
- Off-route detection.
- Online content refresh.

## 3. Actors & Authorization

- Eligible Camper.
- Eligible Porter.

## 4. Preconditions & Dependencies

Dependencies:

- CTMS-052.
- CTMS-053.
- CTMS-054.

A valid downloaded package exists.

## 5. Business Rules

| BR     | Rule                                                                                                                                                                                      |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-233 | Downloaded Route, Checkpoint, and survival-guidance data must remain usable in airplane/offline mode without calling an online API and must correspond to the exact Trip/package version. |

## 6. State & Lifecycle

Valid local package
→ offline view
→ Route/checkpoint/guidance rendered locally.

## 7. Business Flow

1. Device loses Internet or enters airplane mode.
2. User opens Trip offline data.
3. Client loads active local package.
4. Verify Trip/package association.
5. Render Route.
6. Render checkpoints.
7. Render survival guidance.
8. Do not call online API as a requirement for this content.

## 8. Data & Invariants

- Data comes from downloaded package.
- Package belongs to selected Trip.
- Correct package version used.
- Core offline view cannot depend on network availability.

## 9. API / Integration Contract

No online API is required for core offline rendering.

Package schema: TBD — Technical Design.

## 10. Error & Edge Cases

| Case                | Expected                                 |
| ------------------- | ---------------------------------------- |
| Airplane mode       | Content remains usable                   |
| Package absent      | Show unavailable/download-required state |
| Package invalid     | Do not use                               |
| Wrong Trip package  | Do not render as current Trip            |
| Network unavailable | No fabricated API dependency             |

## 11. Acceptance & Test Matrix

| Scenario           | Expected                   |
| ------------------ | -------------------------- |
| Airplane mode      | Route visible              |
| Airplane mode      | Checkpoints visible        |
| Airplane mode      | Survival guidance visible  |
| Wrong Trip package | Rejected                   |
| Valid package      | No online request required |

## 12. Open Decisions

Offline map rendering library belongs to Technical Design.
