// CTMS-01-T03 / CTMS-03-T03 — Mobile E2E, real backend (no mocking, no
// ProviderScope overrides). Drives the actual compiled app against
// services/api the same way the web app's Playwright suite does — see
// apps/web/tests/e2e/register.spec.ts / login.spec.ts for the same pattern.
//
// Run:
//   flutter drive --driver=test_driver/integration_test.dart \
//     --target=integration_test/app_test.dart -d chrome
// (plain `flutter test integration_test/...` does not support web targets)
// Requires: chromedriver on port 4444, and the real backend up
// (docker compose up -d postgres redis; pnpm --filter @ctms/api start:dev).
//
// Test order matters: `flutter_secure_storage` on web persists to the
// browser's storage, which survives across `pumpWidget` calls within the
// same run -- a test that logs in for real leaves a session behind for
// whatever runs after it. Only "logs in successfully" creates one, so it
// runs last; every other test starts from a guaranteed-unauthenticated
// state.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mobile/app.dart';

String _uniqueEmail(String tag) =>
    'e2e-$tag-${DateTime.now().millisecondsSinceEpoch}@example.com';

String _uniqueLocalPhone() {
  final ms = DateTime.now().millisecondsSinceEpoch;
  final suffix = (ms % 100000000).toString().padLeft(8, '0');
  return '09$suffix'.substring(0, 10);
}

Future<void> _tapVisible(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

Future<void> _registerCamper(
  WidgetTester tester, {
  required String email,
  required String phone,
  required String fullName,
}) async {
  await _tapVisible(tester, find.text('Camper (Khách cắm trại)'));
  await _tapVisible(tester, find.widgetWithText(ElevatedButton, 'Tiếp tục'));

  await tester.enterText(find.byType(TextFormField).at(0), email);
  await tester.enterText(find.byType(TextFormField).at(1), 'E2eTest@123');
  await tester.enterText(find.byType(TextFormField).at(2), 'E2eTest@123');
  await _tapVisible(tester, find.widgetWithText(ElevatedButton, 'Tiếp tục'));

  await tester.enterText(find.byType(TextFormField).at(0), fullName);
  await tester.enterText(find.byType(TextFormField).at(1), phone);
  await _tapVisible(tester, find.widgetWithText(ElevatedButton, 'Tiếp tục'));

  await _tapVisible(tester, find.byType(Checkbox));
  await _tapVisible(
    tester,
    find.widgetWithText(ElevatedButton, 'Hoàn tất đăng ký'),
  );
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets(
    'registers successfully with a valid email and reaches the verify screen',
    (WidgetTester tester) async {
      await tester.pumpWidget(const ProviderScope(child: CtmsApp()));
      await tester.pumpAndSettle();

      await _tapVisible(
        tester,
        find.widgetWithText(OutlinedButton, 'Đăng ký tài khoản mới'),
      );
      expect(find.text('Tham gia CTMS'), findsOneWidget);

      final email = _uniqueEmail('register');
      await _registerCamper(
        tester,
        email: email,
        phone: _uniqueLocalPhone(),
        fullName: 'E2E Test User',
      );

      // Real POST /auth/register succeeded -> no session adopted, landed on
      // the /verify placeholder shell (CTMS-02 fills in the real controller).
      expect(find.text('Xác minh tài khoản của bạn'), findsOneWidget);
      expect(find.textContaining(email), findsOneWidget);
    },
  );

  testWidgets('rejects an existing email with the duplicate-account message', (
    WidgetTester tester,
  ) async {
    final email = _uniqueEmail('dup');

    await tester.pumpWidget(const ProviderScope(child: CtmsApp()));
    await tester.pumpAndSettle();

    // First registration establishes the "already exists" precondition
    // through the real UI + real API -- same approach as
    // apps/web/tests/e2e/register.spec.ts, not a direct DB seed.
    await _tapVisible(
      tester,
      find.widgetWithText(OutlinedButton, 'Đăng ký tài khoản mới'),
    );
    await _registerCamper(
      tester,
      email: email,
      phone: _uniqueLocalPhone(),
      fullName: 'E2E Dup User',
    );
    expect(find.text('Xác minh tài khoản của bạn'), findsOneWidget);

    // Back to Login via the real in-app navigation (re-pumping a fresh
    // CtmsApp() here would NOT reset the browser's URL/router state on
    // web -- go_router keeps the address bar wherever the first flow left
    // it, so a second pumpWidget still renders /verify, not /login).
    await _tapVisible(
      tester,
      find.widgetWithText(TextButton, 'Quay lại đăng nhập'),
    );
    expect(find.text('CTMS'), findsOneWidget);

    // Second attempt, same email, fresh phone -- the 409 is attributable
    // only to the duplicated email.
    await _tapVisible(
      tester,
      find.widgetWithText(OutlinedButton, 'Đăng ký tài khoản mới'),
    );
    await _registerCamper(
      tester,
      email: email,
      phone: _uniqueLocalPhone(),
      fullName: 'E2E Dup User 2',
    );

    expect(find.textContaining('already registered'), findsOneWidget);
    // The rejection bounces back to the Verification step, not Account --
    // confirm the Account step's fields are off-screen. (`find.byType(...)`
    // with no `.at()` evaluates to an empty set instead of throwing, unlike
    // `.at(0)`, so it composes safely with `findsNothing`.)
    expect(find.byType(TextFormField), findsNothing);
  });

  testWidgets('rejects incorrect credentials without creating a session', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(const ProviderScope(child: CtmsApp()));
    await tester.pumpAndSettle();

    await tester.enterText(
      find.byType(TextFormField).at(0),
      'mobiletest@ctms.local',
    );
    await tester.enterText(find.byType(TextFormField).at(1), 'WrongPassword1');
    await _tapVisible(
      tester,
      find.widgetWithText(ElevatedButton, 'Đăng nhập →'),
    );

    expect(
      find.text('Email/số điện thoại hoặc mật khẩu không chính xác.'),
      findsOneWidget,
    );
    expect(find.byType(NavigationBar), findsNothing);
  });

  testWidgets('logs in as Porter and reaches the Porter dashboard UI', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(const ProviderScope(child: CtmsApp()));
    await tester.pumpAndSettle();

    // Requires the dev seed account: porter@ctms.local / Porter@123.
    await tester.enterText(
      find.byType(TextFormField).at(0),
      'porter@ctms.local',
    );
    await tester.enterText(find.byType(TextFormField).at(1), 'Porter@123');
    await _tapVisible(
      tester,
      find.widgetWithText(ElevatedButton, 'Đăng nhập →'),
    );

    expect(find.byType(NavigationBar), findsOneWidget);
    expect(find.text('CA HÔM NAY'), findsOneWidget);
    expect(find.text('ĐOÀN PHỤ TRÁCH'), findsOneWidget);
    expect(find.text('Tuyến đang vận hành'), findsOneWidget);
    expect(find.text('Lịch vận hành'), findsOneWidget);

    final scrollable = find.byType(Scrollable).first;
    await tester.scrollUntilVisible(
      find.text('Cảnh báo cần xử lý'),
      300,
      scrollable: scrollable,
    );
    expect(find.text('Cảnh báo cần xử lý'), findsOneWidget);

    await tester.tap(find.text('Thêm'));
    await tester.pumpAndSettle();
    await _tapVisible(tester, find.text('Hồ sơ & cài đặt'));
    await _tapVisible(tester, find.widgetWithText(ElevatedButton, 'Đăng xuất'));

    expect(find.byType(TextFormField), findsWidgets);
  });

  // Runs last -- see the file-level doc comment on why test order matters
  // here (this is the only test that leaves a real session behind).
  testWidgets(
    'logs in successfully with a verified account and reaches the Camper home',
    (WidgetTester tester) async {
      await tester.pumpWidget(const ProviderScope(child: CtmsApp()));
      await tester.pumpAndSettle();

      // Requires a pre-activated Camper account -- mobiletest@ctms.local,
      // status flipped to `active` directly in Postgres, since CTMS-02
      // [Mobile] doesn't exist yet to verify one for real (see the
      // manual-testing notes for how it was created). If that account
      // doesn't exist on the target DB, this test fails at the credential
      // step, not silently.
      await tester.enterText(
        find.byType(TextFormField).at(0),
        'mobiletest@ctms.local',
      );
      await tester.enterText(find.byType(TextFormField).at(1), 'Test@123');
      await _tapVisible(
        tester,
        find.widgetWithText(ElevatedButton, 'Đăng nhập →'),
      );

      expect(find.byType(NavigationBar), findsOneWidget);
    },
  );
}
