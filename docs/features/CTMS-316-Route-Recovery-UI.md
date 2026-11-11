# CTMS-316 — View Direction and Distance Back to Route: UI

Parent: Jira CTMS-247 / specification CTMS-062. Backend contract: [CTMS-315](CTMS-315-Route-Recovery-Context.md).

## Scope and single decision table

The Camper's existing embedded/fullscreen offline map shares one account-scoped, Trip-family `RecoveryController`. The controller observes the existing map and route-deviation controllers. It does not record GPS/checkpoint events, change detector navigation, activate packages or mutate a Trip/Route. Porter behavior is unchanged by default.

The pure `decideRecovery` function is the single precedence table used to build the card and control whether map overlays may exist. Conditions below apply in order; a row with no guidance always removes the target and dashed line immediately.

| API/check evidence | Local package | GPS | Existing detector | UI / guidance |
| --- | --- | --- | --- | --- |
| 401/403/404, signed out, or local access denied | Any | Any | Any | Restricted; no guidance |
| Any | Loading | Any | Any | Loading; no guidance |
| Any | Missing/invalid/unsupported | Any | Any | Package unavailable; no guidance |
| Any | Missing identity/checksum/fingerprint binding | Any | Any | Mismatch; no guidance |
| Checking | Verified exact package | Any | Any | Checking; no guidance |
| STALE | Verified exact package | Any | Any | "Dữ liệu tuyến đã cũ"; no guidance |
| MISMATCH | Verified package | Any | Any | Mismatch; no guidance |
| UNAVAILABLE | Verified package | Any | Any | Unavailable; no guidance |
| HTTP 5xx/other unexpected error | Verified package | Any | Any | Server/check error; no offline success fallback |
| Network/timeout, no prior exact AVAILABLE | Verified package | Any | Any | Unverified; no guidance |
| AVAILABLE or network/timeout with exact prior AVAILABLE | Verified exact package | Missing, denied, disabled, invalid coordinates/accuracy | Any | GPS unavailable; no guidance |
| Same | Same | Older than 30 s or future skew over 5 s | Any | Stale GPS; no guidance |
| Same | Same | Accuracy over 20 m | Any | Poor GPS; no guidance |
| Same | Same | Usable | Detector Route ID/ordered coordinates differ | Context mismatch; no guidance |
| Same | Same | Usable | Not active or not confirmed OFF_ROUTE | No confirmed deviation; no guidance |
| AVAILABLE | Same | Usable | Active OFF_ROUTE, matching Route | Current local guidance |
| Network/timeout with exact prior AVAILABLE | Same | Usable | Same | Local guidance with "Chưa xác thực lại với máy chủ", last observation time |

Offline is an explicit client evidence state, not the backend UNAVAILABLE status. A fresh server STALE/MISMATCH/UNAVAILABLE response is persisted and cannot revive an older AVAILABLE record during a later outage. A 5xx check error also invalidates the previously cached success for fallback. Corrupt/unknown cache values fail closed. A new real successful response is required to clear a persisted participation restriction.

## Identity, cache, concurrency

- Secure-storage keys include account, Trip, package UUID/version, archive SHA-256 and Route fingerprint. A per-account in-memory overlay preserves negative decisions during controller recreation in the same session if secure-storage writes fail.
- A server check is repeated after 60 seconds, on explicit retry and resume. A package identity change immediately clears the target and starts another check. A record past the check interval never becomes a fresh server confirmation; network fallback remains visibly unverified-again, with the original observation time.
- First use entirely offline does not fabricate authorization from a local ZIP. It requires a prior AVAILABLE check for that exact binding.
- API geometry/metadata/conventions must match the local verified package point-for-point before accepting AVAILABLE/STALE. Server geometry never replaces local geometry. HTTP permission errors are not converted into network errors.
- Request epochs discard late results after package replacement/disposal. Concurrent panel/fullscreen checks deduplicate against the same controller. Calculations reuse the existing GPS stream, are rate-limited to once per second, and reuse the prior target until movement reaches 3 metres. GPS quality/age and negative state changes bypass calculation throttling and immediately remove guidance.
- Secure storage unavailable across a full app restart cannot guarantee persistence of a denial that failed to reach disk. No current-session denial is bypassed; this device-storage failure is a limitation to address before claiming durable revocation under failing storage.

## Geometry and presentation

Projection candidates use a local equirectangular plane around GPS, unwrapping each segment across the antimeridian. The selected candidate's final distance uses haversine and its initial bearing uses a spherical formula. Bearings are clockwise from true north in `[0,360)`, with one shared eight-direction label table. Device compass/magnetic heading is not used. Near-pole queries (absolute latitude >=89.9 degrees) fail closed because this projection is ill-conditioned; empty/single-point/invalid routes also provide no target.

Repeated points and shared vertices are deterministic. A target within 1 mm of the GPS point has zero distance and null bearing; no north direction is invented. The movement threshold is only a computational throttle, not an arrival or ON_ROUTE threshold. Existing CTMS-060 detection thresholds/state transitions are untouched.

The card prioritizes a large distance, clear true-north direction, combined accessibility label and a focus button. A purple diamond/turn symbol and dashed white-outlined connector distinguish recovery from circular numbered checkpoints and the solid green Route. The connector is a straight-line direction cue, not a traversable walking path. Both raster and vector views receive the same computed target.

## Review and validation phase

New geometry, state, cache/contract, controller and narrow-width card tests run during UI iteration. Related offline-map regression runs before preview. Full Flutter/root regression and authenticated device/API end-to-end evidence are deliberately deferred until the user approves the UI, as required by the task workflow.

`test_driver/route_recovery_preview.dart` is a manual visual harness using production widgets and explicitly labelled test fixtures; it is not imported by the product entry point and does not demonstrate live API integration. Preview screenshots must not be described as authenticated end-to-end evidence.
# Real basemap visual review

## Error classification and review corrections

Missing/malformed local recovery identity and API `UNAVAILABLE` with reason
`ARTIFACT_UNAVAILABLE` use the dedicated artifact-invalid presentation. API
`MISMATCH` retains the distinct package/Trip identity mismatch presentation;
other `UNAVAILABLE` reasons remain generic route unavailability. Every negative
state suppresses the target and distance. Cached artifact-invalid decisions
also remain negative during a later network outage.

Retry is an outlined button with minimum height 48 logical pixels. A compact
warning on both map views explains why guidance is suppressed. The in-map
route icon fits the route to the viewport; the separate fullscreen action opens
another screen. These actions are distinct and must remain distinguishable.

The original demo Trip's GPS context reported `eligible=false` with
`TRIP_NOT_ONGOING`. Existing checkpoint logic pauses when `gps.isTracking` is
false. There was no checkpoint-record baseline before the earlier manual run,
so that observation does not prove that all historical checkpoint/deviation
records were unchanged. Capture a before/after baseline for subsequent runs.

The 315 fixture integration was rerun against `ctms315_test`: 27 tests passed.
Its artifact is built with the production builder and verified via the real
private-artifact reader. The suite uses a minimal isolated schema and test
authentication, not a complete mobile test environment. No fixture has yet
been downloaded by the emulator, and no official-pipeline `AVAILABLE` E2E
claim is made. A separate full API test environment is still required for that.

## Real API integration blocker (2026-11-11)

The existing local CTMS-308 demo package lacks `manifest.route` and carries a
noncanonical demo fingerprint. A real authenticated request returned HTTP 200,
`UNAVAILABLE / ARTIFACT_UNAVAILABLE`, with null geometry. The request left Trip
status and `updatedAt` unchanged. The legacy artifact was preserved without edits.

The existing `OfflinePackagesService.requestInitial` was invoked for the published
demo Trip. Its durable job became `BLOCKED` with `CORE_INCOMPLETE`,
`GUIDANCE_APPROVAL_UNAVAILABLE`, `GUIDANCE_POLICY_UNAVAILABLE`, and
`HAZARD_FEED_UNAVAILABLE`. The module currently binds `UnavailableOfflineSafetySources`;
authoritative upstream data/integration is required before producing a usable package.
Do not override that provider with demo approvals or relax verification to unblock UI.

Compatibility note for the PR/BE owner: legacy artifacts without the required route
identity cannot support recovery. Users need a newly generated valid package;
downloading the same invalid version again does not repair it. The UI instructs
users to download a valid package and contact the trip leader if none is available.
Full emulator `AVAILABLE`/off-route/offline-cache verification remains pending.

Independent distance check (GeographicLib 2.1, WGS84 ellipsoid; tool installed
only under ignored artifacts): origin latitude/longitude
`16.1042493, 108.2809359`, target `16.103260312259984, 108.28184391706372`.
Client spherical calculation: 146.6408265 m / 138.5843163 degrees.
Independent WGS84 calculation: 146.3328335 m / 138.4079725 degrees.
The 0.308 m difference is consistent with the documented spherical approximation;
it does not support a 115–120 m distance. The camera projection/scale test also passes.

ADB screenshots confirmed the real Camper app renders the legacy v2 package on
the original demo Trip and hides return guidance with a local mismatch notice.
That is a client-side identity rejection, not a captured API `UNAVAILABLE` UI:
the separately recorded authenticated API response is for the ongoing demo Trip.
These two observations must be described separately in the PR evidence.

The manual web harness can display the existing Son Tra style-v2 MBTiles as
locally extracted XYZ tiles. The debug-only tile-provider seam is not used by
the production application: production continues to open verified local MBTiles
and never falls back to a remote tile service. The harness labels the OSM Hoang
Sa polyline as an illustrative route and its GPS samples as simulated; this is
not evidence of an authenticated Trip or offline device integration.

Preview modes refresh the GPS sample and badge from the same clock. Selecting
stale GPS supplies a sample older than 30 seconds and removes both the return
connector and guidance. Route styling is solid dark green, current GPS blue,
and the return target a white-bordered purple diamond.

### Reviewer setup using the existing development database

Run these commands from `services/api`, with its normal development `.env`.
Existing active `camper@ctms.local` and `host@ctms.local` accounts are required.
The seed never creates users or changes passwords. Optional environment variables
`RECOVERY_DEMO_CAMPER_EMAIL` and `RECOVERY_DEMO_HOST_EMAIL` select other existing
accounts. Do not use `pnpm seed`: that existing alias passes `--fresh`.

```powershell
pnpm exec ts-node src/seeds/main.seed.ts --route-recovery-only
```

This opt-in path runs before the master seed and refuses production or destructive
flags. It adds one `[DEMO CTMS-316]` Trip, route, three checkpoints, booking and a
builder-generated verified package. Repeating it retains package identity, account
data and visits. It uses synthetic demo policy metadata and contains no safety
guidance or live hazard claims; it is not output from the official safety pipeline
and must never be used for real navigation. It does not bind a fake source provider
to the running API. The regular master seed behavior is unchanged.

Build the background map locally (Python and Pillow required; downloads OSM data):

```powershell
python -m pip install Pillow
python ../../scripts/build_osm_raster.py --download --source ../../artifacts/ctms316-demo-osm.json --output ../../artifacts/ctms316-demo.mbtiles --bounds 108.225 16.065 108.335 16.165
node scripts/publish-offline-basemap.cjs 316de000-0000-4000-8000-000000000001 1 ../../artifacts/ctms316-demo.mbtiles
```

The publisher verifies actual tiles, coverage and the immutable package binding.
Do not commit the generated map or downloaded data. If the source download fails,
the vector route remains available but background-map evidence is incomplete.
Use the normal API on port 3000 and build mobile with
`--dart-define=API_BASE_URL=http://10.0.2.2:3000/api` for Android Emulator.
Sign in with the existing Camper account, open the demo Trip and download both
the package and background before starting it:

```powershell
pnpm exec ts-node src/seeds/main.seed.ts --route-recovery-start
```

Reopen the Trip to refresh eligibility. Simulated GPS latitude/longitude
`16.101,108.277` is on-route; `16.1045,108.280` is approximately 167 m off-route.
In Emulator Location, press **Set Location** after selecting the coordinate.
`--route-recovery-prepare` returns only this named demo Trip to a future published
state for another download recording; it preserves packages, memberships and visits
and does not clear installed files on the device. These phase switches intentionally
change only demo Trip status/dates. They are operator demo tools, not product APIs.

### Isolated native fixture review

The card's offline notice can be dismissed with its close button for the current
display episode. The map retains its offline notice; dismissal changes no API
validation or cache state. Entering a new offline display episode shows it again.
Return targets below 0.5 m are withheld to avoid displaying a rounded zero distance
with a meaningless bearing while the existing detector settles. This presentation
guard does not confirm that the user has returned or modify the detector state.

The native Camper app now runs against the real Nest application on port 3001,
using only `ctms316_mobile_test`. This is fictional test data, not an officially
approved package. The fixture uses the production artifact builder and verifier;
production safety-source approval gates remain unchanged.

Test login: `camper316@ctms.local` / `Camper@123`.
The Trip title starts with `[TEST FIXTURE CTMS-316]`.
Package download, SHA-256 validation, activation and local MBTiles rendering
were exercised on Android. Initial activation requires the prepared, future
published Trip; the test-only phase helper then starts it for GPS recording.
The helper refuses any database other than `ctms316_mobile_test`.

Native observations: on-route GPS hides return guidance; simulated GPS at
longitude `108.280`, latitude `16.1045` shows approximately 167 m south (180°)
with the return connector and target in both embedded and full-screen maps.
These observations use the actual API/package reader, not the web preview.
With Wi-Fi and cellular disabled, the full-screen map retained the local tiles
and 167 m guidance, displaying both the map notice and card warning that the
previously verified route had not been revalidated with the server. Connectivity
was restored after this check.
TypeScript validation of the isolated harness passed. Full regression remains
pending UI acceptance. No Jira notes or comments were posted.
