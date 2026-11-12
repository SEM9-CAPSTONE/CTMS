# Unified offline trip download (CTMS-308 extension)

One download action transfers the existing schema-1 safety ZIP, validates and activates it under the existing pre-start policy, then transfers an independently hashed raster basemap. Only the exact active core package plus verified basemap can display “Sẵn sàng sử dụng ngoại tuyến”. A failed/missing basemap leaves the usable core intact and presents a single retry action. Pausing the raster discards its partial bytes; retry restarts raster only. No changes to the core ZIP whitelist/schema/20 MiB limit.

## API and storage

- `GET /api/trips/:tripId/offline-packages/:version/tiles`: authenticated Camper/Porter metadata; packageId, tripId, packageVersion, SHA-256, sizeBytes, WGS84 bounds [west,south,east,north], minZoom/maxZoom, attribution/licenseUrl.
- `GET /api/trips/:tripId/offline-packages/:version/tiles/download`: private/no-store streamed MBTiles. Membership is checked on every request using the core package download policy. Unknown participation is 404; missing raster is 409 BASEMAP_NOT_READY. No arbitrary URL/path in metadata; filenames are SHA-256 addressed.
- DB migration `1794900000000`: immutable association from exact core package UUID to raster metadata. Multiple package bindings may reference identical content-addressed bytes. Changing basemap requires a new core package version; ongoing trips retain their active version.
- Server `OFFLINE_BASEMAP_STORAGE_ROOT`: private directory outside public uploads. Limit 100 MiB per raster. Server checks size/hash before streaming. Mobile bounds streaming bytes and hashes the temporary file before atomic publication. SQLite quick_check/metadata are checked at download; SHA-256 is checked again when reopening.
- Mobile paths are account/trip/core-package scoped. Core denial markers prevent reopen and purge local tiles; server denial during transfer purges and blocks the core as well. Offline revocation is observable only at the next successful contact. Cached raster image lifetime follows the screen; no background tile network provider is used.

## Prepare a region before offering a trip offline

From repository root, supply bounds covering the route plus the desired buffer (example Sơn Trà):

```powershell
python scripts/build_osm_raster.py --download --bounds 108.225 16.065 108.335 16.165
python scripts/build_osm_raster.py --validate --bounds 108.225 16.065 108.335 16.165
cd services/api
node scripts/publish-offline-basemap.cjs 30800000-0000-4000-8000-000000000001 2 ../../artifacts/osm-offline/son_tra.mbtiles
```

Another destination requires another extract and output path (`--source`, `--output`, `--bounds`). The operator publisher validates tile coverage/hash/format/license and checks all route vertices against bounds before inserting an immutable binding. It does not run an automatic map-generation worker, and there is no new Host upload UI. Missing assets explicitly remain not-ready; never substitute Sơn Trà for another destination. Large areas over 5,000 tiles are rejected by the local renderer. Rendering remains ways-only, without DEM/contours; see the spike document for limitations and source license.

## Deliberate limits

This change does not enforce departure/check-in gating; it changes the offline readiness indicator and download workflow. It does not add Web file storage. It does not alter GPS tracking eligibility. Basemap retry is bounded by explicit user action/connectivity retry, not a resumable Range transfer. No binary map is committed to Git. Android native evidence is still required after this integration; earlier demo-path video is not evidence of the authenticated download path.

## Checks executed

Checkpoint consistency follow-up: automatic arrival now requires an authoritative context matching the verified active package (Trip/package/version/route/checkpoint IDs, names and coordinates). Offline reuse only accepts an exact matching context in account-scoped cache; auth errors do not fall back. The runtime no longer uses the fabricated Hải Vân debug context. The local demo authoritative context was republished from core v2. Context refresh failures clear the detector context. Basemap proximity uses “Trong vùng trạm”, not “ĐÃ TỚI”, and requires fresh/good GPS. Arrival confirmation remains exclusively the automatic detector (3 valid samples / 20 m); map checkpoint radii are navigation information. 116 checkpoint/map tests passed and analyze was clean after this follow-up; Android debug APK built and installed for manual verification.

- Flutter analyze: no issues; full mobile suite: 454 passed.
- Backend basemap/core download suites: 39 passed; TypeScript noEmit passed.
- Python renderer validation: 4 passed.
- Windows Android debug APK build succeeded without OFFLINE_MBTILES_DEMO_PATH.
- Local migration applied; immutable binding published for demo trip `30800000-0000-4000-8000-000000000001`, core v2.
- Real authenticated API download: 2,162,688 bytes, SHA-256 matches metadata. Unauthenticated metadata request: 401.
- Manual single-button Android download + offline reopen after this integration: pending.


## UI checkpoint integration — 2026-11-10

Camper route tab now embeds the existing automatic checkpoint panel below the map
and removes its previous separate duplicate placement. There is one checkpoint
list for this flow. Selecting a row focuses the matching package checkpoint on
the map; it does not create a visit. Existing detector thresholds, three-sample
evidence and sync rules are unchanged. Fullscreen uses the same list with one
dialog owner in the underlying route panel, avoiding duplicate reached dialogs.
The Porter map retains its existing proximity list.

Distance labels retain stale/poor GPS context; unavailable GPS hides distances.
When core is valid but raster is missing, the action says “Tải nền bản đồ”.
Progress accessibility uses the raster transfer percentage while raster downloads.

Final Windows checkpoint: `flutter analyze --no-pub` PASS; full
`flutter test -r expanded --no-pub` PASS, **456 tests**. Android debug APK built
with `API_BASE_URL=http://10.0.2.2:3000/api`. No new video or screenshot visual
verification claimed: native emulator capture timed out. User should record the
current build and confirm the combined layout at their emulator dimensions.

Evidence sequence: open “[UI TEST CTMS-308] Sơn Trà - Nền mới”, download core and
basemap to ready, open route and select a checkpoint, open fullscreen and try
pan/zoom/fit/recenter, disable Wi-Fi and mobile data, return to map, obtain an
emulator GPS fix and verify position/accuracy, background and resume, then
restore network. Demo coordinates/route are fixtures, not navigation guidance.


### Offline GPS controller recreation correction

The previous controller kept eligibility only in memory. Leaving the tab and
reopening offline discarded that decision, stopping breadcrumb recording and
therefore automatic checkpoint detection. GPS API now stores server-confirmed
eligibility in secure local storage keyed by account and trip. Only network or
timeout failures can reuse it, within the server-provided start/end window.
A server denial/ineligible result clears approval; no decision is inferred from
package or existing logs. Sampling stops at the known trip boundary. Offline
revocations cannot be discovered until reconnect; server-side sync validation
remains authoritative. This cache improves foreground tab recreation, not
background location collection.

GPS/checkpoint regression: 84 tests passed, including recreated offline controller
recording pending local logs, account isolation, expiration and observed denial.
Analyze clean. A new emulator recording is still needed to confirm runtime GPS
fixes after leaving/reopening offline.
