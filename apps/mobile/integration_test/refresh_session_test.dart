// CTMS-04-T03, Step 8 -- Mobile E2E, real backend, real Chrome, no network
// mocking. The one `ProviderScope` override used (`_app()` below) is not a
// test double -- it reproduces `main.dart`'s own composition-root wiring
// exactly (`apiClientProvider.overrideWith(...)`), which plain `main()`
// never runs when a widget test builds the tree itself. Same "no test
// hooks, only what the app itself does" spirit as integration_test/app_test.dart
// and apps/web/tests/e2e/refresh-session.spec.ts otherwise.
//
// Run:
//   flutter drive --driver=test_driver/integration_test.dart \
//     --target=integration_test/refresh_session_test.dart -d chrome
// Requires: chromedriver on port 4444, the real backend up
// (docker compose up -d postgres redis; pnpm --filter @ctms/api start:dev),
// and the same pre-activated account app_test.dart uses
// (mobiletest@ctms.local / Test@123).
//
// Unlike Playwright's `page.route()`, there is no network-interception
// layer available when driving a compiled Flutter web app through
// chromedriver -- 401s are produced by planting a deliberately invalid
// `accessToken` directly into the SAME real `flutter_secure_storage`
// backing the running app (a `TokenStorage` instance is a stateless
// pass-through to that storage, so a second instance constructed here
// reads/writes the exact same data), alongside a REAL valid `refreshToken`
// obtained via a real `POST /auth/login` call in each test's own setup.
// This still exercises the real interceptor, the real coordinator, and the
// real backend for every refresh -- only the access token's validity is
// short-circuited, the same "fake the edge, not the code under test"
// principle as every other layer of this story's tests.
//
// Test order: each test clears and re-seeds storage in setUp/tearDown, so
// tests are independent of each other and of app_test.dart's own ordering
// constraints (a separate `flutter drive` target).
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mobile/app.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/storage/token_storage.dart';
import 'package:mobile/features/auth/application/auth_controller.dart';
import 'package:mobile/features/auth/data/auth_api.dart';

const _identifier = 'mobiletest@ctms.local';
const _password = 'Test@123';
const _invalidAccessToken = 'expired.fake.access.token';
const _neverIssuedRefreshToken = 'e2e-never-issued-refresh-token-0000000000000000';

Future<LoginResult> _realLogin() {
  final api = AuthApi(ApiClient(TokenStorage(const FlutterSecureStorage())));
  return api.login(identifier: _identifier, password: _password);
}

/// `ProviderScope(child: CtmsApp())` alone is NOT the real app -- the
/// `onSessionExpired` wiring (Step 5, DG-M2) only exists as `main.dart`'s
/// `apiClientProvider.overrideWith(...)`, which plain `main()` never runs
/// in a widget test. Without reproducing that exact override here, the
/// pumped app's `ApiClient` gets a `null` `onSessionExpired` callback, so a
/// failed refresh throws the right error message but silently never calls
/// `clearSession()` -- the app the earlier version of this file was
/// pumping could never redirect to Login no matter how long a test waited.
/// This mirrors `main.dart` exactly (see that file for the reasoning on
/// `ref.read` vs `ref.watch` here).
Widget _app() {
  return ProviderScope(
    overrides: [
      apiClientProvider.overrideWith(
        (ref) => ApiClient(
          ref.watch(tokenStorageProvider),
          onSessionExpired: () => ref.read(authControllerProvider.notifier).clearSession(),
        ),
      ),
    ],
    child: const CtmsApp(),
  );
}

/// `pumpAndSettle()` only re-pumps while Flutter's `SchedulerBinding` keeps
/// scheduling new frames -- a bare `await` on a real HTTP call (this
/// suite's `dio` requests) registers no such frame while it's in flight, so
/// `pumpAndSettle` can decide the tree is "settled" and return WHILE a real
/// network round-trip (or the interceptor's refresh-then-retry chain) is
/// still in progress. That produced exactly the failure this comment is
/// replacing: assertions running before the real 401/refresh/redirect
/// chain had actually finished, and the eventual out-of-band completion
/// then throwing into whatever test happened to be running next.
///
/// This polls the actual condition directly instead of trusting frame
/// scheduling -- the same "poll for real state" approach as
/// apps/web/tests/e2e/refresh-session.spec.ts's `expect.poll(...)`.
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
    // Intentional diagnostic, not leftover debugging: a timeout here means
    // "the app is stuck in some state that isn't the one this call
    // expected" -- printing what's actually on screen turns that into an
    // actionable failure instead of a bare stack trace.
    // ignore: avoid_print
    print(
      'Condition not met -- visible Text widgets: '
      '${find.byType(Text).evaluate().map((e) => (e.widget as Text).data).toList()}',
    );
    throw TestFailure('Condition not met within $timeout');
  }
}

bool _onLoginScreen() => find.widgetWithText(ElevatedButton, 'Đăng nhập →').evaluate().isNotEmpty;

bool _profileLoadedSuccessfully() {
  return find.text('Không thể tải hồ sơ').evaluate().isEmpty &&
      find.text('Đang tải hồ sơ...').evaluate().isEmpty &&
      find.byType(NavigationBar).evaluate().isNotEmpty;
}

/// Waits for the profile fetch triggered by navigating to the tab to reach
/// ITS final outcome -- either a fully loaded profile (the whole
/// 401 -> refresh -> retry chain succeeded) or a bounce to Login (the
/// refresh itself failed) -- whichever this scenario actually produces.
Future<void> _navigateToProfile(WidgetTester tester) async {
  await tester.tap(find.text('Hồ sơ'));
  await tester.pump();
  await _pumpUntil(tester, () => _profileLoadedSuccessfully() || _onLoginScreen());
}

Future<void> _loginViaUi(WidgetTester tester) async {
  await tester.enterText(find.byType(TextFormField).at(0), _identifier);
  await tester.enterText(find.byType(TextFormField).at(1), _password);
  await tester.tap(find.widgetWithText(ElevatedButton, 'Đăng nhập →'));
  await tester.pump();
  await _pumpUntil(tester, () => find.byType(NavigationBar).evaluate().isNotEmpty);
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  final storage = TokenStorage(const FlutterSecureStorage());

  setUp(() async {
    await storage.clear();
  });

  tearDown(() async {
    await storage.clear();
  });

  // --- Scenario 1: access token expires mid-flow, transparent continuation ----

  testWidgets('continues transparently after the access token expires mid-flow, without redirecting to Login', (
    tester,
  ) async {
    final login = await _realLogin();
    await storage.saveSession(accessToken: _invalidAccessToken, refreshToken: login.refreshToken, user: login.user);

    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();
    // Local-only restore (DG-M7): a token + cached user is enough to land
    // on the authenticated shell without any network round-trip.
    expect(find.byType(NavigationBar), findsOneWidget);

    await _navigateToProfile(tester);

    expect(_profileLoadedSuccessfully(), isTrue);

    final newAccessToken = await storage.readAccessToken();
    final newRefreshToken = await storage.readRefreshToken();
    expect(newAccessToken, isNotNull);
    expect(newAccessToken, isNot(_invalidAccessToken));
    // DG-M3/rotation: the refresh token is a fresh one, not the one this
    // test planted.
    expect(newRefreshToken, isNot(login.refreshToken));
  });

  // --- Scenario 2: concurrent protected requests -> exactly 1 refresh call ----

  testWidgets(
    'collapses 2 concurrent protected 401s into exactly 1 refresh -- both requests still succeed',
    (tester) async {
      final login = await _realLogin();
      await storage.saveSession(
        accessToken: _invalidAccessToken,
        refreshToken: login.refreshToken,
        user: login.user,
      );

      // Real ApiClient, real backend, same secure storage the app itself
      // uses. If single-flight were broken (2 independent refresh calls
      // instead of 1), the backend's own reuse guard (CTMS-04-T01's
      // row-level conditional UPDATE) would make the SECOND refresh call
      // fail outright, since the first would have already rotated
      // `login.refreshToken` out from under it -- so "both requests
      // succeed" is itself the black-box proof of single-flight against a
      // real backend, without needing any call-count instrumentation.
      final client = ApiClient(storage);
      final results = await Future.wait([
        client.get<Map<String, dynamic>>('/profiles/me'),
        client.get<Map<String, dynamic>>('/profiles/me'),
      ]);

      expect(results, hasLength(2));
      expect(results[0].statusCode, 200);
      expect(results[1].statusCode, 200);
    },
  );

  // --- Scenario 3: app backgrounded, token expires, resume recovers -----------

  testWidgets('recovers transparently when the app resumes with an expired access token (DG-M6)', (tester) async {
    final login = await _realLogin();
    await storage.saveSession(accessToken: login.accessToken, refreshToken: login.refreshToken, user: login.user);

    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();
    await _navigateToProfile(tester);
    expect(_profileLoadedSuccessfully(), isTrue); // real, still-valid token -- loads cleanly first

    // Simulate "the access token expired while the app was backgrounded":
    // corrupt only the access token, keep the still-valid refresh token,
    // then drive the real OS lifecycle transitions. Flutter's own internal
    // AppLifecycleListener (used by WidgetsApp, distinct from
    // AppLifecycleObserver's plain WidgetsBindingObserver) asserts the
    // exact legal transition graph -- resumed only follows inactive or
    // detached, never paused directly -- so backgrounding and returning
    // both need every intermediate step, not just the two endpoints.
    await storage.saveTokens(accessToken: _invalidAccessToken, refreshToken: (await storage.readRefreshToken())!);
    // No `tester.pump()` between the intermediate transitions -- on the web
    // target, entering `paused` makes the engine genuinely stop scheduling
    // frames (it mirrors real backgrounding: don't render while paused),
    // so a `pump()` placed right after it waits forever for a frame that
    // will not come until the app is `resumed` again. Only the two states
    // that matter for observation (after `resumed`) need a pump.
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pump();
    // Poll actual persisted state, not widget-tree "settled" -- the screen
    // may still show the STALE (previously loaded) profile the instant
    // resume fires, before the invalidate-triggered refetch even starts.
    await _pumpUntil(tester, () async => (await storage.readAccessToken()) != _invalidAccessToken);

    expect(_profileLoadedSuccessfully(), isTrue);
    final recoveredAccessToken = await storage.readAccessToken();
    expect(recoveredAccessToken, isNot(_invalidAccessToken));
  });

  // --- Scenario 4: refresh token revoked/invalid -> clear + redirect to Login -

  testWidgets('clears the session and redirects to Login when the refresh token is invalid/revoked', (
    tester,
  ) async {
    final login = await _realLogin();
    await storage.saveSession(
      accessToken: _invalidAccessToken,
      refreshToken: _neverIssuedRefreshToken,
      user: login.user,
    );

    await tester.pumpWidget(_app());
    await tester.pump();
    // DG-M7's optimistic local restore may show the authenticated shell
    // for a moment before a protected request (fired eagerly by whichever
    // tab builds first inside the shell's IndexedStack) 401s and the
    // refresh itself fails -- how long that moment actually lasts depends
    // on incidental frame-scheduling elsewhere in the tree (confirmed by
    // instrumented runs: the whole 401 -> refresh-fail -> clearSession ->
    // redirect chain can complete in ~1-2 pump cycles against a warm local
    // backend), so it is not reliably observable in a real-network test.
    // Only the FINAL outcome matters for this scenario -- poll for it
    // directly, tapping into Profile only if the shell is still showing by
    // the time this runs.
    if (find.text('Hồ sơ').evaluate().isNotEmpty) {
      await tester.tap(find.text('Hồ sơ'));
      await tester.pump();
    }
    await _pumpUntil(tester, () => _onLoginScreen());

    expect(find.byType(NavigationBar), findsNothing);
    expect(find.widgetWithText(ElevatedButton, 'Đăng nhập →'), findsOneWidget);
    expect(await storage.readAccessToken(), isNull);
    expect(await storage.readRefreshToken(), isNull);
    // No backend-specific detail ever reaches the UI -- Login has no
    // element that could even render it.
    expect(find.textContaining('Invalid'), findsNothing);
  });

  // --- Scenario 5: restart with a valid session -> protected access works ----

  testWidgets('a real login followed by a simulated restart keeps protected access working', (tester) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();
    await _loginViaUi(tester);
    expect(find.byType(NavigationBar), findsOneWidget);

    // "Restart" -- a brand-new ProviderScope/AuthController, forced to redo
    // tryRestoreSession() from scratch against whatever is actually
    // persisted in the real (browser-backed, on the web target) secure
    // storage, exactly like a fresh process start would.
    await tester.pumpWidget(const SizedBox());
    await tester.pumpWidget(_app());
    await tester.pump();
    await _pumpUntil(tester, () => find.byType(NavigationBar).evaluate().isNotEmpty);

    expect(find.byType(NavigationBar), findsOneWidget); // still authenticated after "restart"

    await _navigateToProfile(tester);
    expect(_profileLoadedSuccessfully(), isTrue);
  });

  // --- Scenario 6: restart with a revoked/expired session -> safe unauthenticated state --

  testWidgets(
    'starting the app with an already-invalid stored session ends in a safe unauthenticated state',
    (tester) async {
      // Mechanically identical path to scenario 4 (there is only one
      // refresh-failure code path in this app, restart-order-independent)
      // -- tested separately because Jira's E2E checklist names "restart
      // with a revoked/expired session" as its own scenario distinct from
      // "revoked mid-session"; this proves the SAME safe outcome holds when
      // the invalid session is what the app finds on a cold start, not one
      // that goes bad while already running.
      final login = await _realLogin();
      await storage.saveSession(
        accessToken: _invalidAccessToken,
        refreshToken: _neverIssuedRefreshToken,
        user: login.user,
      );

      await tester.pumpWidget(_app());
      await tester.pump();
      // Same non-determinism as scenario 4's optimistic-restore moment --
      // poll for the final outcome instead of asserting on the transient
      // authenticated-shell flash.
      if (find.text('Hồ sơ').evaluate().isNotEmpty) {
        await tester.tap(find.text('Hồ sơ'));
        await tester.pump();
      }
      await _pumpUntil(tester, () => _onLoginScreen());

      expect(find.byType(NavigationBar), findsNothing);
      expect(find.widgetWithText(ElevatedButton, 'Đăng nhập →'), findsOneWidget);
      expect(await storage.readAccessToken(), isNull);
      expect(await storage.readRefreshToken(), isNull);
    },
  );
}
