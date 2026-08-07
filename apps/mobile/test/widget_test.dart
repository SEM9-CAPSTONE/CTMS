import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/app.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/api/api_exception.dart';
import 'package:mobile/core/storage/token_storage.dart';
import 'package:mobile/features/auth/data/auth_api.dart';
import 'package:mobile/features/auth/data/auth_repository.dart';
import 'package:mobile/features/auth/domain/auth_user.dart';
import 'package:mobile/features/auth/domain/register_models.dart';
import 'package:mobile/features/auth/domain/user_role.dart';

/// Avoids touching the flutter_secure_storage platform channel (unavailable
/// under flutter_test) and the network — [login]/[register] return
/// [loginResult] directly instead of calling the (stubbed) backend.
class _FakeAuthRepository extends AuthRepository {
  _FakeAuthRepository({this.loginResult, this.loginFailure, this.loginGate})
    : super(
        AuthApi(ApiClient(TokenStorage(const FlutterSecureStorage()))),
        TokenStorage(const FlutterSecureStorage()),
      );

  final AuthUser? loginResult;

  /// Lets a test choose exactly which backend error `login()` throws
  /// (defaults to "Invalid credentials" when unset, matching an unknown
  /// account/wrong password) — CTMS-03-T03 requires distinguishing the
  /// mapped Vietnamese message per case.
  final ApiException? loginFailure;

  /// Without this, `login()` resolves on the next microtask (no real
  /// `await` in its body) — fast enough that `await tester.tap()`'s own
  /// microtask turns let one full login cycle finish before the next tap
  /// fires, so a rapid-triple-tap test would never actually observe two
  /// calls racing. Blocking on an uncompleted [Completer] (rather than a
  /// real `Future.delayed`, which leaves a real Timer that
  /// `flutter_test`'s binding flags as "still pending" if the test ends
  /// before it fires) keeps the first call "in flight" for exactly as long
  /// as the test needs, with no real-clock timer involved.
  final Completer<void>? loginGate;

  int loginCallCount = 0;

  @override
  Future<AuthUser?> tryRestoreSession() async => null;

  @override
  Future<AuthUser> login({required String identifier, required String password}) async {
    loginCallCount++;
    if (loginGate != null) await loginGate!.future;
    final user = loginResult;
    if (user == null) {
      throw loginFailure ?? ApiException('Invalid credentials', statusCode: 401);
    }
    return user;
  }

  /// Register does not return an [AuthUser] (no session is adopted — see
  /// RegisterScreen's class doc), so this synthesizes a plausible
  /// [RegisterResult] from [loginResult] instead of echoing it back
  /// directly.
  @override
  Future<RegisterResult> register(RegisterFormData data) async {
    final user = loginResult;
    if (user == null) throw ApiException('Không thể đăng ký');
    return RegisterResult(
      id: user.id,
      email: user.email,
      phone: '0912345678',
      role: user.role,
      status: 'pending_verification',
    );
  }

  @override
  Future<void> logout() async {}
}

Future<void> _tapVisible(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

Future<void> _login(WidgetTester tester, AuthUser user) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authRepositoryProvider.overrideWithValue(_FakeAuthRepository(loginResult: user)),
      ],
      child: const CtmsApp(),
    ),
  );
  await tester.pumpAndSettle();

  await tester.enterText(find.byType(TextFormField).at(0), user.email);
  await tester.enterText(find.byType(TextFormField).at(1), 'password123');
  await tester.tap(find.widgetWithText(ElevatedButton, 'Đăng nhập →'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('unauthenticated users land on the login screen', (WidgetTester tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [authRepositoryProvider.overrideWithValue(_FakeAuthRepository())],
        child: const CtmsApp(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('CTMS'), findsOneWidget);
    expect(find.widgetWithText(ElevatedButton, 'Đăng nhập →'), findsOneWidget);
  });

  testWidgets('shows a Vietnamese message for invalid credentials, never the raw exception', (
    WidgetTester tester,
  ) async {
    final repository = _FakeAuthRepository();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [authRepositoryProvider.overrideWithValue(repository)],
        child: const CtmsApp(),
      ),
    );
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextFormField).at(0), 'camper@example.com');
    await tester.enterText(find.byType(TextFormField).at(1), 'wrong-password');
    await tester.tap(find.widgetWithText(ElevatedButton, 'Đăng nhập →'));
    await tester.pumpAndSettle();

    expect(
      find.text('Email/số điện thoại hoặc mật khẩu không chính xác.'),
      findsOneWidget,
    );
    // CTMS-03-T03: "API errors do not expose sensitive authentication
    // details" -- the raw ApiException/statusCode formatting must never
    // reach the screen.
    expect(find.textContaining('ApiException'), findsNothing);
    expect(find.byType(NavigationBar), findsNothing);
  });

  testWidgets(
    'shows a Vietnamese message and a verify-account action when the account is not active',
    (WidgetTester tester) async {
      final repository = _FakeAuthRepository(
        loginFailure: ApiException('Account is not active', statusCode: 401),
      );
      await tester.pumpWidget(
        ProviderScope(
          overrides: [authRepositoryProvider.overrideWithValue(repository)],
          child: const CtmsApp(),
        ),
      );
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextFormField).at(0), 'pending@example.com');
      await tester.enterText(find.byType(TextFormField).at(1), 'correct-password');
      await tester.tap(find.widgetWithText(ElevatedButton, 'Đăng nhập →'));
      await tester.pumpAndSettle();

      expect(
        find.textContaining('chưa được kích hoạt hoặc đã bị khoá'),
        findsOneWidget,
      );

      // "Navigation to ... Account Verification ... where applicable"
      // (CTMS-03-T03 checklist) -- applicable here means exactly this case.
      await _tapVisible(tester, find.widgetWithText(ElevatedButton, 'Xác minh tài khoản'));
      expect(find.text('Xác minh tài khoản của bạn'), findsOneWidget);
    },
  );

  testWidgets('toggling password visibility reveals the typed password', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [authRepositoryProvider.overrideWithValue(_FakeAuthRepository())],
        child: const CtmsApp(),
      ),
    );
    await tester.pumpAndSettle();

    final passwordField = find.byType(TextFormField).at(1);
    await tester.enterText(passwordField, 's3cretPass');

    TextField textFieldOf(Finder formField) =>
        tester.widget<TextField>(find.descendant(of: formField, matching: find.byType(TextField)));

    expect(textFieldOf(passwordField).obscureText, isTrue);

    await tester.tap(find.byIcon(Icons.visibility_outlined));
    await tester.pump();

    expect(textFieldOf(passwordField).obscureText, isFalse);
  });

  testWidgets('repeated taps on the submit button produce only one login request', (
    WidgetTester tester,
  ) async {
    final repository = _FakeAuthRepository(
      loginResult: const AuthUser(
        id: '1',
        fullName: 'Minh Trần',
        email: 'camper@ctms.dev',
        role: UserRole.camper,
      ),
      // See loginGate's doc comment -- keeps the first call "in flight"
      // across all 3 taps below, same as a real network round-trip would.
      // Never completed -- this test only needs the in-flight window, not
      // the eventual success screen.
      loginGate: Completer<void>(),
    );
    await tester.pumpWidget(
      ProviderScope(
        overrides: [authRepositoryProvider.overrideWithValue(repository)],
        child: const CtmsApp(),
      ),
    );
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextFormField).at(0), 'camper@ctms.dev');
    await tester.enterText(find.byType(TextFormField).at(1), 'password123');

    final submitButton = find.widgetWithText(ElevatedButton, 'Đăng nhập →');
    // Fire 3 taps back-to-back, same as a user double/triple tapping an
    // unresponsive-feeling button. loginGate is never completed, so the
    // submit button's spinner animates indefinitely -- pumpAndSettle()
    // would hang waiting for it to stop; a single pump() is enough to let
    // the synchronous parts of each tap's handler run.
    await tester.tap(submitButton);
    await tester.tap(submitButton);
    await tester.tap(submitButton);
    await tester.pump();

    expect(repository.loginCallCount, 1);
  });

  testWidgets('camper lands on the overview tab and can switch tabs', (
    WidgetTester tester,
  ) async {
    await _login(
      tester,
      const AuthUser(id: '1', fullName: 'Minh Trần', email: 'camper@ctms.dev', role: UserRole.camper),
    );

    expect(find.byType(NavigationBar), findsOneWidget);
    expect(find.text('Tổng quan'), findsWidgets);

    // The real "Tổng quan — Camper Hub" screen — greeting, trip card,
    // weather, transactions and suggestions all render from the mock
    // repository via camperOverviewProvider. That fetch is a plain
    // `Future.delayed` with no animating widget behind it while it's
    // pending, so pumpAndSettle (which stops as soon as nothing schedules
    // a new frame) returns immediately without giving the timer a chance
    // to fire — pump an explicit duration instead.
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pump();
    expect(find.textContaining('Trần!'), findsOneWidget);
    expect(find.text('Thông báo quan trọng'), findsOneWidget);
    expect(find.text('Chuyến đi sắp tới'), findsOneWidget);

    // Scroll down to confirm the rest of the screen (weather, transactions,
    // suggestions) assembles without error too.
    final scrollable = find.byType(Scrollable).first;
    await tester.scrollUntilVisible(find.text('Giao dịch gần đây'), 300, scrollable: scrollable);
    expect(find.text('Giao dịch gần đây'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Gợi ý dành cho bạn'),
      300,
      scrollable: scrollable,
    );
    expect(find.text('Gợi ý dành cho bạn'), findsOneWidget);

    await tester.tap(find.text('Khám phá'));
    await tester.pumpAndSettle();

    expect(find.text('Khám phá khu cắm trại'), findsOneWidget);
  });

  testWidgets('porter "Thêm" sheet opens the folded-in destinations', (WidgetTester tester) async {
    await _login(
      tester,
      const AuthUser(id: '2', fullName: 'Anh Minh', email: 'porter@ctms.dev', role: UserRole.porter),
    );

    expect(find.byType(NavigationBar), findsOneWidget);
    expect(find.text('Lịch'), findsOneWidget);

    await tester.tap(find.text('Thêm'));
    await tester.pumpAndSettle();

    expect(find.text('Thành viên đoàn'), findsOneWidget);
    expect(find.text('Sự cố'), findsOneWidget);
    expect(find.text('Hồ sơ & cài đặt'), findsOneWidget);
  });

  testWidgets('porter completes registration and is routed to the verify screen', (
    WidgetTester tester,
  ) async {
    const newUser = AuthUser(
      id: '3',
      fullName: 'Tân Porter',
      email: 'newporter@ctms.dev',
      role: UserRole.porter,
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authRepositoryProvider.overrideWithValue(_FakeAuthRepository(loginResult: newUser)),
        ],
        child: const CtmsApp(),
      ),
    );
    await tester.pumpAndSettle();

    // Login -> Register.
    await _tapVisible(tester, find.widgetWithText(OutlinedButton, 'Đăng ký tài khoản mới'));
    expect(find.text('Tham gia CTMS'), findsOneWidget);

    // Step 1 — Vai trò.
    await _tapVisible(tester, find.text('Porter (Người dẫn đường)'));
    await _tapVisible(tester, find.widgetWithText(ElevatedButton, 'Tiếp tục'));

    // Step 2 — Tài khoản: Email + Mật khẩu + Xác nhận mật khẩu.
    expect(find.text('Thông tin tài khoản'), findsOneWidget);
    await tester.enterText(find.byType(TextFormField).at(0), newUser.email);
    await tester.enterText(find.byType(TextFormField).at(1), 'password123');
    await tester.enterText(find.byType(TextFormField).at(2), 'password123');
    await _tapVisible(tester, find.widgetWithText(ElevatedButton, 'Tiếp tục'));

    // Step 3 — Thông tin cá nhân: Camper và Porter dùng chung bước này giờ
    // đây (CTMS-01-T03 rút wizard về đúng hợp đồng thật của
    // POST /auth/register — xem register_models.dart).
    expect(find.text('Thông tin cá nhân'), findsOneWidget);
    await tester.enterText(find.byType(TextFormField).at(0), newUser.fullName!);
    await tester.enterText(find.byType(TextFormField).at(1), '0912345678');
    await _tapVisible(tester, find.widgetWithText(ElevatedButton, 'Tiếp tục'));

    // Step 4 — Xác nhận đăng ký: accuracy checkbox rồi submit.
    expect(find.text('Xác nhận đăng ký'), findsOneWidget);
    await _tapVisible(tester, find.byType(Checkbox));
    await _tapVisible(tester, find.widgetWithText(ElevatedButton, 'Hoàn tất đăng ký'));

    // Register không tự đăng nhập (không có token trả về) — điều hướng
    // sang /verify thay vào đó. Xem class doc của RegisterScreen.
    expect(find.text('Xác minh tài khoản của bạn'), findsOneWidget);
    expect(find.byType(NavigationBar), findsNothing);

    await _tapVisible(tester, find.widgetWithText(TextButton, 'Quay lại đăng nhập'));
    expect(find.text('CTMS'), findsOneWidget);
  });
}
