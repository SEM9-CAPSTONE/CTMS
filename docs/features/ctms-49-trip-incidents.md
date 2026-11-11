# CTMS-49: Trip incident reporting

Porters report from the assigned Trip's **Sự cố** tab on the web, or **Thêm → Sự cố** on Flutter and select an assigned Trip. New reports require an ongoing Trip. The server independently checks the caller's role, assignment and original event time. Reports captured during a completed Trip's operating window may synchronize late.

Both clients save the event before sending it. The UUID, original UTC event time, coordinates, accuracy and fix timestamp remain unchanged on retries. Missing GPS is explicitly unavailable; the server classifies stale fixes. Web storage uses IndexedDB, including photo blobs, and waits for transaction completion before confirming a save. Flutter uses flushed files in private application support storage, separated by account, and caches assignments for offline capture after restart.

The outbox continues while the application is running, across navigation, and retries on reconnect/resume. Browsers must keep the application open, or reopen it when connectivity returns. Mobile synchronization resumes when the application runs; no operating-system background execution is promised. A Porter must have loaded their assignment before going offline. An assignment revoked while offline is rejected by the server and remains visibly failed on the device.

On web, a temporary server/network failure retains the previously authorized Trip context and marks it stale so incident capture remains accessible. Explicit 401/403/404 responses hide that context. The server rechecks authorization on every synchronization.

## API and persistence

- `POST /trips/:tripId/incidents`: client UUID creation or reconciliation; returns `created` or `duplicate` with the authoritative incident.
- `GET /trips/:tripId/incidents`: an assigned Porter sees their own reports; the Trip's Host sees all reports.
- `PUT /trips/:tripId/incidents/:incidentId/media`: optional image upload after creation. JPEG, PNG and WebP, at most 5 MB; server checks content signatures. Concurrent uploads cannot overwrite the selected image's bytes.

The `CreateTripIncidentsTable1787240000000` migration adds the incident table and indexes. The API's configured migration runner applies it on startup. Incident insertion and its audit entry share a transaction; the UUID primary key prevents duplicate authoritative records, including concurrent requests. Media has its own delivery state and audit entry. A media failure leaves the parent incident intact. This implementation uses the idempotent incident endpoint for synchronization; the shared `sync_batches` transport described in BR-162 is not currently implemented in this repository.

Network errors, 401, 408, 429 and server errors retain pending work with capped exponential retry delays. Business/validation refusals become failed and require explicit user action. A successful local write is never displayed as server-synced. If local storage cannot commit, the form keeps its values and reports the failure.

## Verification

Automated checks cover authorization, event time/location, stale/unavailable GPS, duplicate synchronization, Host visibility, separate image failure, lost acknowledgements, durable Flutter restart recovery and account isolation. Web regression tests cover offline capture/reconnect, storage failure, Trip navigation and background outbox processing.

Device smoke test: load an ongoing assigned Trip online, disable networking, save a report with a photo, restart the Flutter application, restore networking, then verify one incident and one selected image appear on the server. Repeat with GPS denied and with the assignment revoked before reconnecting. Native GPS permission and gallery interactions still require an Android/iOS device check.

The iOS project uses Swift Package Manager. For a when-in-use-only iOS build, run `BYPASS_PERMISSION_LOCATION_ALWAYS=1 flutter build ios` from `apps/mobile` on macOS. This is the geolocator Apple package's documented SPM switch; it removes the unused always-location permission code. The app requests only the location needed for the report.

If Windows reports Kotlin incremental-cache errors between the C: package cache and D: workspace, native verification can use `gradlew.bat assembleDebug "-Pkotlin.incremental=false" "-Pkotlin.compiler.execution.strategy=in-process"` from `apps/mobile/android`. These are verification-time settings; project Gradle configuration is unchanged.

## Task-only E2E commands

Start dependencies from the workspace root:

```powershell
docker compose up -d postgres redis
```

Run the real Chromium UI/API/database suite (7 scenarios):

```powershell
pnpm --filter @ctms/web test:e2e:incidents
```

This dedicated configuration starts the API on port 3002 and Vite on port 5175. It always uses `TEST_DATABASE_URL` (default `ctms_test`) and refuses databases whose names do not end in `_test`. It creates unique accounts and Trips, and cleans up only that fixture's rows and uploaded images. Other E2E suites are not selected. The API is real; browser networking is interrupted only to simulate offline mode or a lost acknowledgement.

For native Android, start a test emulator/device, then run this separately from the web suite:

```powershell
pwsh -File apps/mobile/scripts/run-incident-e2e.ps1 -DeviceId emulator-5554
```

The native runner starts the isolated API and a test-only transport proxy on port 3003, installs the app if necessary, grants location permission on the test device, seeds a unique fixture, and drives `integration_test/report_trip_incident_test.dart` twice. Authentication is setup through the real AuthRepository, API and secure storage; the login screen's regression suite is outside this task. The capture phase navigates the real UI, interrupts API connections and saves pending work. The recover phase starts a new application process using the same captured APK, verifies the event and session still exist on disk, restores API connectivity, observes the synced UI state, and replays the UUID to verify one authoritative incident. `flutter drive` stops the application without uninstalling it; default `flutter test` uninstall behavior must not erase the outbox between phases. Runtime scenario data comes from the test-only proxy, so changing phase does not require recompiling the APK. There are no provider, repository or business-response mocks. The proxy drops connections; it does not switch the device's airplane-mode setting. By default, `adb reverse` forwards device localhost ports 3002/3003 to the host; the runner removes only mappings it created. This works for connected emulators and physical Android devices. To use a direct LAN connection instead, pass `-DeviceHost` with the development machine's reachable address. These runs replace the session of the app installed on the chosen test device.
