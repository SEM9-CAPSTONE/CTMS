import 'package:integration_test/integration_test_driver.dart';

/// Bridges `integration_test/app_test.dart` to `flutter drive` — required
/// to run on Chrome (`flutter test integration_test/...` doesn't support
/// web targets; native platforms don't need this file, but the CI/dev
/// command below works uniformly across targets):
///
///   flutter drive \
///     --driver=test_driver/integration_test.dart \
///     --target=integration_test/app_test.dart \
///     -d chrome
Future<void> main() => integrationDriver();
