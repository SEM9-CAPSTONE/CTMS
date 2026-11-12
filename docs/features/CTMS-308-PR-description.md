# feat(CTMS-308): display current location on offline map

Display the verified active package route and checkpoints with real GPS position and accuracy in the Camper trip view and Porter map view. Show explicit missing/invalid package, access-denied, permission, GPS-unavailable, poor-accuracy and stale-location states.

- The map draws vector route, checkpoints and GPS overlays locally. It does not include background map tiles or turn-by-turn navigation.
- The controller provider uses autoDispose. When switching tabs removes its last listener, returning creates a new controller, reads and verifies the active package (including SHA-256), and initializes location again. Canvas zoom/pan can reset. This is not merely restoring a cached view.
- The panel owns the app-resume observer; the full-screen screen shares the same controller. Package reload and location refresh have a two-second debounce in the controller. The lifecycle test advances its injected clock and verifies that a second resume 500 ms later performs no additional read or GPS request.
- The controller receives packageReaderFuture from the reader provider, which constructs DefaultOfflineMapPackageReader. Reader failures become packageInvalid instead of leaving loading indefinitely.
- Remove the Porter placeholder map, sample checkpoints and mock action buttons that only displayed SnackBars.
- Vietnamese display strings follow the existing adjacent GpsTrackingPanel convention; this change does not introduce a localization framework.

## Validation

Executed from apps/mobile:

```sh
flutter analyze --no-pub
flutter test --no-pub -r expanded
flutter test --no-pub test/features/offline_map test/features/porter -r expanded
flutter test test/features/offline_map/offline_map_canvas_test.dart -r expanded
```

- Analyze: no issues.
- Full mobile suite: 440 tests passed.
- Offline map + Porter: 62 tests in the full suite (including the new 360-pixel layout regression).
- Canvas alone: 11 tests passed (subset). Zoom in/out, fit route and pan are covered by one combined test, not separate tests.
- Added regression coverage for unexpected reader failure and clarified the mounted panel/screen lifecycle test with an inactive-to-resumed transition.
- Fixed loading text, full-screen button and checkpoint information overflowing at 360-pixel phone width; added a regression test.
- git diff --check passed.

Commit only the relevant mobile source/tests and this description if desired. The pre-existing untracked artifacts/ directory is unrelated and must not be included. Newly created presentation and test files are currently untracked and need explicit staging before commit.
