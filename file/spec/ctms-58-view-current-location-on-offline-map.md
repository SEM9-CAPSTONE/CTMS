# CTMS-058 — View Current Location on Offline Map

## 1. Overview

Story: CTMS-058

Epic: EPIC 9. GPS Navigation and Route Deviation

Use Case: View Current Location on Offline Map

Priority: Must Have

Goal: Allow Camper to see current GPS location relative to downloaded Route/checkpoints while offline.

Acceptance Criteria:

- Current GPS position is visible offline.
- Downloaded Route is visible.
- Downloaded checkpoints are visible.
- GPS accuracy is shown when available.

## 2. Scope

### In Scope

- Current device GPS.
- Offline Route.
- Offline checkpoints.
- GPS accuracy.

### Out of Scope

- Breadcrumb persistence — CTMS-059.
- Off-route detection — CTMS-060.
- Return-to-route guidance — CTMS-062.

## 3. Actors & Authorization

- Camper.
- Device location subsystem.

Location permission is required.

## 4. Preconditions & Dependencies

Dependency:

- CTMS-055.

Valid Offline Safety Package is available locally.

## 5. Business Rules

| BR     | Rule                                                                                                                                                    |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-236 | When offline, the map must display the user's current GPS position together with the downloaded Route/checkpoints and show GPS accuracy when available. |

## 6. State & Lifecycle

Local package + GPS permission
→ obtain GPS position
→ render position on offline map.

## 7. Business Flow

1. Camper opens offline map.
2. Load Route/checkpoints locally.
3. Request/read device GPS.
4. Display current position.
5. Display GPS accuracy when available.
6. Update position from new GPS samples without requiring Internet.

## 8. Data & Invariants

- GPS position originates from device measurement.
- Route/checkpoints originate from active local package.
- GPS accuracy is displayed when available.
- Current position must not be fabricated from old coordinate without freshness/quality context.

## 9. API / Integration Contract

No Internet API required for core offline display.

Device-location integration: Technical Design.

## 10. Error & Edge Cases

| Case                       | Expected                      |
| -------------------------- | ----------------------------- |
| No Internet                | Map still works               |
| Location permission denied | Explain location unavailable  |
| GPS unavailable            | Do not fabricate location     |
| Poor accuracy              | Display accuracy context      |
| Package unavailable        | Route/checkpoints unavailable |

## 11. Acceptance & Test Matrix

| Scenario            | Expected                |
| ------------------- | ----------------------- |
| Airplane mode + GPS | Current position shown  |
| Airplane mode       | Route/checkpoints shown |
| GPS accuracy exists | Accuracy shown          |
| Permission denied   | No fake position        |

## 12. Open Decisions

Map SDK/cache implementation belongs to Technical Design.

## 2026-11-10 — Per-package raster integration

The base layer is an optional independently validated local MBTiles sidecar bound
to the active core package UUID/version. Route and checkpoint geometry always
comes from that same core, and GPS comes from device measurements. Basemap
publication must not rewrite automatic checkpoint visit history. Without a valid
sidecar, render the existing vector fallback and explain that the base layer has
not been downloaded. Never substitute a tile containing provider/key errors.

The backend prepares raster asynchronously after core publication; opening a map
is not a generation trigger. Both map readiness and the absence of approved
upstream safety inputs are described in the [backend integration contract](../../docs/features/CTMS-307-Offline-Basemap-Backend.md).
