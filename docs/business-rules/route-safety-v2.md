# Route Safety v2 Business Rules

Effective change: 2026-10-29. Source: `CTMS_Route_Safety_Spec_v2.docx`, supplied for implementation. This supplement governs CTMS-010 safety analysis and its consumers; it does not change the reporting actor or workflow of CTMS-049, the DRAFT restriction of CTMS-014, or the approval/closure policies of other stories.

User-requested amendment, 2026-10-30: fetch current NCHMF warnings during Host analysis. This supersedes the earlier stored-only ingestion choice.

## Rule changes

| Rule | Decision | Current wording |
| --- | --- | --- |
| BR-027 | Clarify the implemented route contract | A Route belongs to `host_id`. It stores name, optional description, a valid non-zero WGS84 LineString, computed positive `length_meters`, difficulty, positive Host-entered `expected_duration_minutes`, status and timestamps. Start and finish are derived from the first and last coordinates. Creation produces an internal DRAFT route. Route Safety does not introduce mandatory persisted start/end fields, route version or porter-required flags. |
| BR-172 and BR-202 | Retain | Backend role/ownership remains authoritative. An active Route remains an internal operational resource and gains no Camper browse/detail access. |
| BR-191 and BR-212 | Retain | Critical changes remain auditable; implementation, specification, test cases and data documentation change together. |
| CTMS-014 rules | Retain | Host-defined danger zones keep ownership, DRAFT-only creation, validation and audit behavior. |
| CTMS-049 rules | Retain | Assigned Porter remains the incident reporter. Safety reads existing incident identity, location and authoritative status without creating a duplicate observation or new lifecycle. |

The older CTMS-010 specification's generated BR-027 wording and its exclusion of automatic safety analysis are superseded by this revision. External ingestion is separate from Host danger-zone creation and never writes those records automatically.

## Added rules

| ID | Rule | Valid path and violation evidence |
| --- | --- | --- |
| BR-472 | Only an authenticated Host may analyze a route. If `routeId` is present, it must exist and belong to that Host. Unsaved geometry is permitted for preview. Incident access must also pass the existing Trip Host scope. | Unit ownership tests; HTTP integration tests for unauthenticated, Admin-only role and another Host. |
| BR-473 | Provider validity takes precedence. `validUntil <= analyzedAt` is EXPIRED; future validity is SCHEDULED; closed/resolved records remain RESOLVED. BASE_HISTORICAL remains HISTORICAL. Without provider expiry, use issued/observed time with a configured age, yielding STALE or UNKNOWN. `fetchedAt` never renews an observation. | Lifecycle tests cover active, exact deadline, future time, absent time, stale fetch and history. |
| BR-474 | Every returned feature retains source type/name/reference, hazard type, severity, geometry role, independent observation/issue/fetch/validity times, verification and optional position accuracy. No combined accuracy percentage may replace these attributes. Raw provider payload remains server-side. | Canonical response integration and unit tests; provider fields do not pass through the analysis contract. |
| BR-475 | GeoJSON uses `[longitude, latitude]` in EPSG:4326. Analysis requires a non-zero LineString with 2 to 10000 positions. Point proximity uses geography meters; LineString and Polygon/MultiPolygon use intersection. Distance is measured to the whole line. Thresholds are configurable product parameters, not scientific safe distances. | Real PostGIS tests for a crossing area/segment, near/far points, invalid input; service boundary tests. |
| BR-476 | Safety is decision support and cannot block route create/update/approval by itself. Empty evidence returns UNKNOWN rather than declaring the route safe. Only ACTIVE non-resource evidence contributes to the observed risk maximum. Missing coverage or truncated results remain explicit. | Service tests for empty/expired/historical/resource data; UI non-blocking error test and existing create-route regressions. |
| BR-477 | Host-defined danger zones are merged only from the selected owned route. Their source identity remains separate from external hazards, and their existing DRAFT/audit/ownership rules remain unchanged. | PostGIS merge test; existing danger-zone service tests. |
| BR-478 | External records may be imported only by Admin from a configured approved source with a permission reference. Stable `(source, externalId)` is unique; older issue/observation data cannot overwrite newer data. Invalid records are quarantined independently, preserving valid records. Storage or transaction failures must be surfaced, not mislabeled as invalid input. | Integration tests for repeated import, invalid records and forbidden actor/source; import service error-path tests. |
| BR-479 | Trip incidents remain in the Incident domain. Only incidents on the requesting Host's Trips are exposed; with a saved route, also require that Trip's `route_id`. Missing incident positions are not fabricated. Verification is UNVERIFIED unless a separate authoritative review exists. | PostGIS tests for own/other Host and absent location; CTMS-049 regressions. |
| BR-480 | The UI debounces geometry changes, isolates cache by Host/route/geometry and discards old geometry responses. After authorization and geometry validation, analysis collects current NCHMF warnings before spatial queries. Finished warning snapshots are not reused for later checks; only concurrent in-flight requests may share collection. Source availability, source data time and collection time remain distinct. Stored OFFICIAL_CURRENT records cannot substitute for live collection. A stable MapLibre source is updated with `setData`; only up to 500 features are returned, with truncation flagged. | Adapter freshness/failure tests, PostGIS live geometry and no-stored-fallback tests, hook race tests and browser preview/retry tests. |
| BR-481 | Resource data is independent of active hazard risk. A mapped spring, stream or water point never establishes current water availability or potability. Historical and unverified observations must be labeled accordingly. | Resource risk exclusion test and UI disclosure test. |

## Configured defaults

Point proximity 300 m, current-data fallback age 360 minutes, field-incident fallback age 1440 minutes, preview debounce 500 ms, UI refresh 60 seconds. These defaults are technical policy choices, not provider guarantees. Provider `validUntil` is not replaced with a fallback age or fetch timestamp. A historical source classification cannot be promoted merely by re-importing it.

## Production source enablement

NCHMF live collection is enabled by default through server-side configuration. Each valid Host analysis contacts the public warning source and retrieves administrative geometries for the route area; there is no provider request for an unauthorized/invalid route. The source may publish on an hourly cycle, so its original forecast time and six-hour validity are shown rather than implying publication at the moment of drawing. Empty, disabled, unavailable and partial collection states are explicit. Source failure cannot turn old imported warnings into current evidence. Controlled Admin import and its configured source/permission rules remain unchanged for the separate stored-data workflow. VNDMS event search is collected in parallel, preserving ended/ongoing state and representative coordinates. OpenStreetMap supplies nearby mapped water in a separate unverified group. Each provider has its own source status.

User-confirmed scope, 2026-10-30: the route preview includes dangerous areas, nearby dangerous/event points and nearby water. Live points, lines and polygons are filtered by meter distance to the entire route. Historical/ended events remain labeled context; mapped water has no implied current availability or potability. VNDMS risk levels are preserved without inventing CTMS severity.

Scope clarification, 2026-10-30: Route supplies reusable geometry with automatic nearby hazard and water context. Route creation/editing/submission/approval neither requires nor generates start/finish checkpoints or waypoints. Those belong to Trip planning, whose refactor is deferred. Existing ownership and lifecycle restrictions still apply.
