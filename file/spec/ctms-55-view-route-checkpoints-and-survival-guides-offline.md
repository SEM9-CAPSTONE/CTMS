# CTMS-055 — View Route, Checkpoints and Survival Guidance Offline

## CTMS-052 archive handoff — 2026-11-06

Schema 1 ZIP contains route.geojson, checkpoints.json, waypoints.json, hazards.geojson and guidance.json plus manifest.json. Render only a verified and activated package for the selected Trip/version; full guidance includes source attribution and exact-version/page/chunk provenance. No personal medical data is included. An ongoing Trip retains its locked version. `routeVersion` used for GPS is distinct from `packageVersion`; offline basemap assets are not part of 052. Acceptance: airplane-mode content uses these local payloads, mismatched identity/schema is rejected and source freshness labels survive offline. See [052 implementation](../../docs/features/CTMS-052-Implementation.md).

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

CTMS-223 supplies the schema 1 ZIP through `PackageDownloadController.openActive(packageVersion)` for the current account and Trip. The returned bytes are the locally verified snapshot. A caller must select the active version and handle an unavailable result.

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
