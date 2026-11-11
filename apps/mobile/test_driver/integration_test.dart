import 'dart:io';

import 'package:flutter_driver/flutter_driver.dart';
import 'package:integration_test/integration_test_driver_extended.dart';

/// Bridges `integration_test/*.dart` to `flutter drive` — required to run
/// on Chrome (`flutter test integration_test/...` doesn't support web
/// targets; native platforms don't need this file, but the CI/dev command
/// below works uniformly across targets):
///
///   flutter drive \
///     --driver=test_driver/integration_test.dart \
///     --target=integration_test/app_test.dart \
///     -d chrome
///
/// The `_extended` driver (rather than plain `integration_test_driver.dart`)
/// is what adds screenshot support -- otherwise identical/backward
/// compatible for every existing integration test here, since `onScreenshot`
/// is only ever invoked if a test actually calls
/// `IntegrationTestWidgetsFlutterBinding.instance.takeScreenshot(...)`.
///
/// Screenshots: the PNG is written here, on the HOST side (this file runs
/// under plain `dart:io`, unlike `integration_test/*.dart` which runs
/// inside the compiled app) -- not committed anywhere, purely PR/manual-
/// testing evidence. Destination is `CTMS_E2E_SCREENSHOT_DIR` (an OS
/// environment variable, read at `flutter drive` time -- deliberately not a
/// `--dart-define`, so it never has to round-trip through the app),
/// falling back to a local `screenshots/` folder under this package when
/// unset.
Future<void> main() async {
  final driver = await FlutterDriver.connect();
  await integrationDriver(
    driver: driver,
    onScreenshot: (String screenshotName, List<int> screenshotBytes, [Map<String, Object?>? args]) async {
      final dirPath = Platform.environment['CTMS_E2E_SCREENSHOT_DIR'] ?? 'screenshots';
      final dir = Directory(dirPath);
      if (!dir.existsSync()) {
        dir.createSync(recursive: true);
      }
      final file = File('${dir.path}${Platform.pathSeparator}$screenshotName.png');
      await file.writeAsBytes(screenshotBytes, flush: true);
      return true;
    },
  );
}
