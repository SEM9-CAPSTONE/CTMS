// CTMS-02 [Mobile]. Mobile E2E, real backend, real Chrome, real Postgres --
// no ProviderScope override of AuthRepository/AuthApi anywhere in this
// file, same "no mocking" posture as apps/web/tests/e2e/register.spec.ts /
// app_test.dart.
//
// Run: see apps/mobile/scripts/run-verify-otp-e2e.ps1 for the 3rd test --
// db-helper.ts's `get-otp` action GENERATES its own fresh code and
// overwrites `verification_otps` unconditionally (it does not read
// whatever a real `POST /auth/send-otp` call already produced), so a code
// planted before this file runs would be immediately invalidated the
// moment the real UI's "Gửi mã OTP" is tapped -- and the reverse also
// holds (a real send here would invalidate whatever the script planted).
// Since `integration_test/*.dart` runs inside the compiled app (no
// `dart:io` to shell out to db-helper.ts mid-test the way Playwright can,
// see search_campsites_test.dart's doc comment for the same constraint),
// there is no way to interleave "real send, then plant/read the code"
// within one running test. Test 3 below resolves this by never sending a
// real OTP for that account at all: the script creates the account and
// plants a known code directly, and the test only bypasses the client-side
// "has a code been requested" UI gate (never the network) to reach the
// real `POST /auth/verify` call -- see that test's own comment.
//
// Requires: chromedriver on port 4444, the real backend up
// (docker compose up -d postgres redis; pnpm --filter @ctms/api start:dev).
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mobile/app.dart';
import 'package:mobile/features/auth/application/verify_otp_controller.dart';
import 'package:mobile/features/auth/data/auth_api.dart';
import 'package:mobile/features/auth/domain/user_role.dart';
import 'package:mobile/features/auth/presentation/verify_screen.dart';

// Supplied by run-verify-otp-e2e.ps1 via --dart-define, only for the 3rd
// test below (tests 1-2 register their own fresh account via the real UI
// and need none of these).
const _e2eEmail = String.fromEnvironment('E2E_EMAIL');
const _e2ePhone = String.fromEnvironment('E2E_PHONE');
const _e2eUserId = String.fromEnvironment('E2E_USER_ID');
const _e2eOtp = String.fromEnvironment('E2E_OTP');

String _uniqueEmail(String tag) => 'e2e-$tag-${DateTime.now().millisecondsSinceEpoch}@example.com';

String _uniqueLocalPhone() {
  final ms = DateTime.now().millisecondsSinceEpoch;
  final suffix = (ms % 100000000).toString().padLeft(8, '0');
  return '09$suffix'.substring(0, 10);
}

/// Matches integration_test/app_test.dart's own `_tapVisible` exactly
/// (`pumpAndSettle`, not a single `pump`) -- the register wizard's step
/// transitions need more than one frame, and `CtmsButton`'s `isLoading`
/// spinner keeps scheduling frames until a real network call resolves, so
/// `pumpAndSettle` naturally waits it out instead of hanging (verified
/// against a real run: a bare single `pump()` here left the next step's
/// widgets not yet built, so the following tap found 0 elements).
Future<void> _tapVisible(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

/// Same "poll actual state, never guess a delay" approach as
/// refresh_session_test.dart's `_pumpUntil` -- a real HTTP round-trip
/// registers no frame for `pumpAndSettle` to wait on.
Future<void> _pumpUntil(
  WidgetTester tester,
  FutureOr<bool> Function() condition, {
  Duration timeout = const Duration(seconds: 20),
}) async {
  final deadline = DateTime.now().add(timeout);
  while (DateTime.now().isBefore(deadline)) {
    if (await condition()) return;
    await tester.pump(const Duration(milliseconds: 200));
  }
  if (!await condition()) {
    // ignore: avoid_print
    print(
      'Condition not met -- visible Text widgets: '
      '${find.byType(Text).evaluate().map((e) => (e.widget as Text).data).toList()}',
    );
    throw TestFailure('Condition not met within $timeout');
  }
}

/// "Gửi mã OTP" specifically must NOT go through `_tapVisible`'s
/// `pumpAndSettle` -- a successful send starts VerifyOtpController's own
/// 60s `Timer.periodic` countdown, which keeps scheduling a new frame every
/// second for the full 60s before settling, so `pumpAndSettle` would still
/// return correctly but only after really waiting out the whole cooldown
/// (verified against a real run: this cost ~60s per call). Poll for the
/// real send actually finishing instead.
Future<void> _tapSendCode(WidgetTester tester) async {
  final finder = find.text('Gửi mã OTP');
  await tester.ensureVisible(finder);
  await tester.pump();
  await tester.tap(finder);
  await _pumpUntil(tester, () => find.textContaining('Mã OTP đã được gửi tới').evaluate().isNotEmpty);
}

/// Mirrors integration_test/app_test.dart's `_registerCamper` exactly (same
/// 3-step wizard, same field order) -- duplicated locally rather than
/// imported, matching that file's own convention of each integration test
/// being self-contained.
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
  await _tapVisible(tester, find.widgetWithText(ElevatedButton, 'Hoàn tất đăng ký'));
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets(
    'registers, selects the Email channel, and successfully requests a real OTP',
    (tester) async {
      await tester.pumpWidget(const ProviderScope(child: CtmsApp()));
      await tester.pumpAndSettle();

      await _tapVisible(tester, find.widgetWithText(OutlinedButton, 'Đăng ký tài khoản mới'));
      final email = _uniqueEmail('verify-send');
      await _registerCamper(tester, email: email, phone: _uniqueLocalPhone(), fullName: 'E2E Verify Send');
      expect(find.text('Xác minh tài khoản của bạn'), findsOneWidget);

      await _tapVisible(tester, find.text('Xác minh qua Email'));
      await _tapSendCode(tester);

      // Real POST /auth/send-otp succeeded -- the OTP field is unlocked and
      // the destination shown is the real account's own email.
      final otpField = tester.widget<TextField>(find.byType(TextField));
      expect(otpField.enabled, isTrue);
      expect(find.textContaining(email), findsWidgets);
    },
  );

  testWidgets(
    'entering a wrong code after a real send is rejected with the real backend message',
    (tester) async {
      await tester.pumpWidget(const ProviderScope(child: CtmsApp()));
      await tester.pumpAndSettle();

      await _tapVisible(tester, find.widgetWithText(OutlinedButton, 'Đăng ký tài khoản mới'));
      final email = _uniqueEmail('verify-wrong');
      await _registerCamper(tester, email: email, phone: _uniqueLocalPhone(), fullName: 'E2E Verify Wrong');
      expect(find.text('Xác minh tài khoản của bạn'), findsOneWidget);

      await _tapVisible(tester, find.text('Xác minh qua Email'));
      await _tapSendCode(tester);

      // Never the real code (which this test has no way to read) --
      // proves the real backend's own 409 rejection, not a client-side
      // validation stand-in.
      await tester.enterText(find.byType(TextField), '000000');
      await tester.pump();
      await _tapVisible(tester, find.text('Xác thực'));
      await _pumpUntil(tester, () => find.text('Incorrect OTP').evaluate().isNotEmpty);

      expect(find.text('Xác thực thành công!'), findsNothing);
      // BR-242 -- the entered code is preserved for retry, not cleared.
      expect(find.text('000000'), findsOneWidget);
    },
  );

  testWidgets(
    'a known-correct OTP planted directly in Postgres activates a pending_verification account',
    (tester) async {
      if (_e2eEmail.isEmpty || _e2eUserId.isEmpty || _e2eOtp.isEmpty) {
        throw StateError(
          'Missing --dart-define. Run via apps/mobile/scripts/run-verify-otp-e2e.ps1, not directly.',
        );
      }

      const account = RegisterResult(
        id: _e2eUserId,
        email: _e2eEmail,
        phone: _e2ePhone,
        role: UserRole.camper,
        status: 'pending_verification',
      );

      // No router change, no new auth code -- same minimal harness idea as
      // verify_screen_test.dart's widget test, but every dependency here
      // (ApiClient, AuthRepository, AuthApi) is the REAL one, hitting the
      // real backend. `/verify` is normally only reached via a real
      // register()'s router `extra`, which this test bypasses on purpose:
      // db-helper.ts's `create-account` (not the UI) made this account, so
      // there is no register-flow navigation to ride along with.
      final router = GoRouter(
        initialLocation: '/verify',
        routes: [
          GoRoute(path: '/verify', builder: (context, state) => const VerifyScreen(account: account)),
          GoRoute(
            path: '/login',
            builder: (context, state) => const Scaffold(body: Text('LOGIN_SCREEN')),
          ),
        ],
      );
      await tester.pumpWidget(ProviderScope(child: MaterialApp.router(routerConfig: router)));
      await tester.pumpAndSettle();

      await _tapVisible(tester, find.text('Xác minh qua Email'));

      // Bypasses ONLY the client-side "a code has already been requested"
      // UI gate -- a real send-otp call here would overwrite the known
      // code db-helper.ts just planted (both write the same
      // verification_otps row), making it impossible to know what to type
      // next (see this file's header comment). The account, the OTP row,
      // and the POST /auth/verify call below are all 100% real.
      final element = tester.element(find.byType(VerifyScreen));
      final container = ProviderScope.containerOf(element);
      final notifier = container.read(verifyOtpControllerProvider.notifier);
      notifier.state = container
          .read(verifyOtpControllerProvider)
          .copyWith(hasSentCode: true, selectedChannel: OtpChannel.email);
      // pumpAndSettle, not a single pump -- a single pump flaked in real
      // runs (the Verify button's `onPressed` was still null/disabled at
      // tap time, silently swallowing the tap and hanging the wait below
      // for the full 20s), meaning one frame was not always enough for the
      // rebuild from this direct state assignment to finish landing.
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextField), _e2eOtp);
      await tester.pumpAndSettle();

      // Confirm the button is actually enabled before tapping it -- fail
      // fast with a clear reason rather than silently tapping a disabled
      // button and hanging for 20s on the wait below.
      final verifyButton = tester.widget<ElevatedButton>(
        find.ancestor(of: find.text('Xác thực'), matching: find.byType(ElevatedButton)),
      );
      expect(
        verifyButton.onPressed,
        isNotNull,
        reason: 'Verify button is still disabled -- the direct state assignment above did not take effect.',
      );

      await _tapVisible(tester, find.text('Xác thực'));
      await _pumpUntil(tester, () => find.text('Xác thực thành công!').evaluate().isNotEmpty);

      expect(find.text('Xác thực thành công!'), findsOneWidget);

      // Let the screen's own 2.5s auto-redirect fire naturally rather than
      // also tapping "Đến trang đăng nhập ngay" -- doing both risks a race
      // (verified against a real run: the manual tap could land after the
      // auto-redirect had already navigated away, leaving nothing to tap).
      await _pumpUntil(
        tester,
        () => find.text('LOGIN_SCREEN').evaluate().isNotEmpty,
        timeout: const Duration(seconds: 10),
      );
      expect(find.text('LOGIN_SCREEN'), findsOneWidget);
    },
  );
}
