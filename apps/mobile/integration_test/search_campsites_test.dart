// CTMS-17-T02 (mobile). Mobile E2E, real backend, real Chrome, real
// Postgres -- no ProviderScope override, no `page.route()`-equivalent
// network interception anywhere in this file (mirrors
// apps/web/tests/e2e/search-campsites.spec.ts's "no mocking" posture).
//
// Run: see apps/mobile/scripts/run-search-campsites-e2e.ps1 -- this file
// alone cannot run standalone. Unlike Playwright's Node-hosted test
// process, `integration_test/*.dart` executes INSIDE the compiled Flutter
// app (in Chrome, driven by chromedriver) -- there is no `dart:io`
// available there to shell out to `db-helper.ts` mid-test the way the Web
// spec does. The `.ps1` script is the host-side orchestrator: it seeds 23
// campsites (22 active under one unique `marker` province + 1 draft) and
// one login-test Host account via db-helper.ts BEFORE this file runs,
// passes the marker/host credentials in via `--dart-define` (read below
// through `String.fromEnvironment`, a compile-time constant that works on
// the web target too), then re-checks `count-campsites` and cleans up
// AFTER this file's `flutter drive` process exits. See that script for the
// exact fixture shape and the "bookend the whole run" DB-mutation check
// (Decision Gate: Mobile cannot interleave a host-side DB check between
// individual actions the way Web's serial `test()` blocks do).
//
// Requires: chromedriver on port 4444, the real backend up
// (docker compose up -d postgres redis; pnpm --filter @ctms/api start:dev),
// and the pre-activated seed account app_test.dart also relies on
// (mobiletest@ctms.local / Test@123, role Camper).
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mobile/app.dart';
import 'package:mobile/features/camper/explore/presentation/widgets/campsite_pagination_bar.dart';
import 'package:mobile/features/camper/explore/presentation/widgets/campsite_search_filters.dart';
import 'package:mobile/features/camper/presentation/camper_profile_screen.dart';

const _camperIdentifier = 'mobiletest@ctms.local';
const _camperPassword = 'Test@123';

// Supplied by run-search-campsites-e2e.ps1 via --dart-define. Never
// hardcoded here -- a fresh marker/host account is minted per run so
// concurrent/repeated runs never collide with each other or with real data.
const _marker = String.fromEnvironment('E2E_MARKER');
const _hostEmail = String.fromEnvironment('E2E_HOST_EMAIL');
const _hostPassword = String.fromEnvironment('E2E_HOST_PASSWORD');

String get _pineCampName => 'E2E Pine Camp $_marker';
String get _beachCampName => 'E2E Beach Camp $_marker';
String get _draftCampName => 'E2E Draft Camp $_marker';

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

Future<void> _tapVisible(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await tester.pump();
  await tester.tap(finder);
  await tester.pump();
}

Future<void> _loginViaUi(WidgetTester tester, String identifier, String password) async {
  await tester.enterText(find.byType(TextFormField).at(0), identifier);
  await tester.enterText(find.byType(TextFormField).at(1), password);
  await _tapVisible(tester, find.widgetWithText(ElevatedButton, 'Đăng nhập →'));
  await _pumpUntil(
    tester,
    () =>
        find.byType(NavigationBar).evaluate().isNotEmpty ||
        // A Host lands on the unsupported-mobile-role screen instead --
        // that is a legitimate settled outcome too, not a failure to poll for.
        find.text('Không hỗ trợ trên mobile').evaluate().isNotEmpty,
  );
}

bool _searchIdle() => find.text('Đang tìm kiếm campsite...').evaluate().isEmpty;

/// Scoped to CampsiteSearchFilters specifically -- the Camper shell's
/// `StatefulShellRoute.indexedStack` keeps every branch's widget tree
/// mounted at once, so a bare `find.byType(TextField)` could otherwise
/// match a field that belongs to a different tab.
Finder _filterField(int index) => find
    .descendant(of: find.byType(CampsiteSearchFilters), matching: find.byType(TextField))
    .at(index);

Future<void> _fillFilterField(WidgetTester tester, int index, String value) async {
  await tester.enterText(_filterField(index), value);
  await tester.pump();
}

Future<void> _submitSearch(WidgetTester tester) async {
  await _tapVisible(
    tester,
    find.descendant(of: find.byType(CampsiteSearchFilters), matching: find.text('Tìm kiếm')),
  );
  await _pumpUntil(tester, _searchIdle);
}

Future<void> _navigateToExplore(WidgetTester tester) async {
  await _tapVisible(tester, find.text('Khám phá'));
  await _pumpUntil(tester, _searchIdle);
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() {
    if (_marker.isEmpty || _hostEmail.isEmpty || _hostPassword.isEmpty) {
      throw StateError(
        'Missing --dart-define. Run via '
        'apps/mobile/scripts/run-search-campsites-e2e.ps1, not directly.',
      );
    }
  });

  testWidgets(
    'Camper happy path: seeded active campsites are found by province, paginate for real, and narrow by amenities -- the draft never appears',
    (tester) async {
      await tester.pumpWidget(const ProviderScope(child: CtmsApp()));
      await tester.pumpAndSettle();

      await _loginViaUi(tester, _camperIdentifier, _camperPassword);
      expect(find.byType(NavigationBar), findsOneWidget);

      await _navigateToExplore(tester);

      await _fillFilterField(tester, 0, _marker); // Tỉnh/Thành
      await _submitSearch(tester);

      // --- Real backend result: 22 active campsites under this marker,
      // the 1 draft never surfaces (CTMS-77's active-only contract). ---
      expect(find.text(_pineCampName), findsOneWidget);
      expect(find.text(_beachCampName), findsOneWidget);
      expect(find.text(_draftCampName), findsNothing);
      await IntegrationTestWidgetsFlutterBinding.instance.takeScreenshot(
        '01-search-by-province',
      );

      // --- Pagination: real page/limit from the backend, not a UI fake ---
      // The pagination bar is the LAST sliver, below a 20-card results grid
      // -- CustomScrollView only builds slivers near the viewport, so it
      // must be scrolled into view before ANY of its text is queryable, not
      // just before tapping it (verified against a real run: asserting on
      // "Tổng cộng ..."/"Trang 1 / 2" before this scroll found 0 widgets).
      final scrollable = find
          .descendant(of: find.byType(CustomScrollView), matching: find.byType(Scrollable))
          .first;
      final nextPageButton = find.descendant(
        of: find.byType(CampsitePaginationBar),
        matching: find.byTooltip('Trang sau'),
      );
      await tester.scrollUntilVisible(nextPageButton, 300, scrollable: scrollable);

      expect(find.text('Tổng cộng 22 campsite'), findsOneWidget);
      expect(find.text('Trang 1 / 2'), findsOneWidget);
      await IntegrationTestWidgetsFlutterBinding.instance.takeScreenshot(
        '02-pagination-page-1-of-2',
      );

      await tester.tap(nextPageButton);
      await tester.pump();
      await _pumpUntil(tester, _searchIdle);

      // Page 2 holds only the 2 overflow campsites (vs. 20 on page 1) --
      // the grid shrinks a lot, which moves the pagination bar's absolute
      // position and leaves the old scroll offset invalid for the new
      // (much shorter) content (verified against a real run: it does).
      // Direction from here is not knowable in advance, so reset to a known
      // point (the very first sliver) before scrolling down fresh -- the
      // same "always known which way to go" reasoning as the filters
      // round-trip below.
      await tester.scrollUntilVisible(
        find.byType(CampsiteSearchFilters),
        -600,
        scrollable: scrollable,
      );
      await tester.scrollUntilVisible(
        find.text('Trang 2 / 2'),
        300,
        scrollable: scrollable,
      );
      expect(find.text('Trang 2 / 2'), findsOneWidget);
      expect(find.text('Tổng cộng 22 campsite'), findsOneWidget);
      // Page 2 holds the 2 overflow filler campsites -- neither marquee
      // fixture (both forced onto page 1 by being the most-recently-created
      // rows, see the seeding script) is on this page.
      expect(find.text(_pineCampName), findsNothing);
      expect(find.text(_beachCampName), findsNothing);
      await IntegrationTestWidgetsFlutterBinding.instance.takeScreenshot(
        '03-pagination-page-2-of-2',
      );

      // --- Narrow by amenities: submitFilters() resets to page 1 on its own ---
      // Scroll back up first -- the filter panel (top sliver) is now well
      // outside the cache extent after scrolling down to the pagination bar.
      await tester.scrollUntilVisible(
        find.byType(CampsiteSearchFilters),
        -300,
        scrollable: scrollable,
      );
      await _fillFilterField(tester, 2, 'wifi'); // Tiện ích
      await _submitSearch(tester);

      expect(find.text(_pineCampName), findsOneWidget);
      expect(find.text(_beachCampName), findsNothing);

      // Scroll back down -- the pagination bar (now showing 1 result total)
      // is off the top of the cache extent again after scrolling up to the
      // filter panel.
      await tester.scrollUntilVisible(
        find.text('Tổng cộng 1 campsite'),
        300,
        scrollable: scrollable,
      );
      expect(find.text('Tổng cộng 1 campsite'), findsOneWidget);
      await IntegrationTestWidgetsFlutterBinding.instance.takeScreenshot(
        '04-narrowed-by-amenities',
      );
    },
  );

  testWidgets(
    'invalid-data flow: an overlong province (>100 chars, BR-205/BR-231) is rejected by the real backend (422)',
    (tester) async {
      // A fresh pumpWidget starts a brand-new ProviderScope (blank filter
      // state, nothing left over from the happy-path test) -- but the SAME
      // persisted session storage the happy-path test's login left behind
      // carries over (DG-M7 local-optimistic-restore, same as
      // refresh_session_test.dart's scenario 1), so this lands straight back
      // on the Camper shell without a fresh login.
      await tester.pumpWidget(const ProviderScope(child: CtmsApp()));
      await tester.pumpAndSettle();
      expect(find.byType(NavigationBar), findsOneWidget);

      await _navigateToExplore(tester);
      await _fillFilterField(tester, 0, 'A' * 101); // Tỉnh/Thành
      await _submitSearch(tester);

      expect(
        find.text('Bộ lọc tìm kiếm không hợp lệ. Vui lòng kiểm tra lại.'),
        findsOneWidget,
      );
      await IntegrationTestWidgetsFlutterBinding.instance.takeScreenshot(
        '05-invalid-data-422',
      );
    },
  );

  testWidgets(
    'unauthorized flow: logging out leaves an anonymous user unable to ever reach Explore',
    (tester) async {
      await tester.pumpWidget(const ProviderScope(child: CtmsApp()));
      await tester.pumpAndSettle();
      expect(find.byType(NavigationBar), findsOneWidget);

      await _tapVisible(tester, find.text('Hồ sơ'));
      // Profile's Personal tab renders inside a plain ListView (a lazy
      // sliver list, same as ListView.builder for element-building purposes
      // -- not a SingleChildScrollView) -- LogoutActions sits near the
      // bottom, past the personal-info form and emergency-contacts card, so
      // it isn't built at all until scrolled near (verified against a real
      // run: polling `find.byKey` alone never found it).
      final logoutButton = find.byKey(const Key('logout-current-device'));
      final profileScrollable = find
          .descendant(of: find.byType(CamperProfileScreen), matching: find.byType(Scrollable))
          .first;
      await _pumpUntil(
        tester,
        () => find.text('Hồ sơ cá nhân').evaluate().isNotEmpty,
      ); // past the initial profile-fetch loading state
      await tester.scrollUntilVisible(logoutButton, 300, scrollable: profileScrollable);
      await _tapVisible(tester, logoutButton);

      await _pumpUntil(
        tester,
        () => find.widgetWithText(ElevatedButton, 'Đăng nhập →').evaluate().isNotEmpty,
      );

      // Back on Login -- there is no route from here that reaches
      // /camper/explore without a real session (app_router.dart's redirect),
      // so the campsites search controller/repository never even builds.
      expect(find.byType(NavigationBar), findsNothing);
      expect(find.text('Khám phá'), findsNothing);
      await IntegrationTestWidgetsFlutterBinding.instance.takeScreenshot(
        '06-anonymous-blocked-login',
      );
    },
  );

  testWidgets(
    'unauthorized flow: an authenticated Host is redirected to the unsupported-mobile-role screen, never reaching Explore',
    (tester) async {
      // Storage is now empty (previous test logged out) -- this is a real,
      // fresh login as Host, not a carried-over session.
      await tester.pumpWidget(const ProviderScope(child: CtmsApp()));
      await tester.pumpAndSettle();
      expect(find.widgetWithText(ElevatedButton, 'Đăng nhập →'), findsOneWidget);

      await _loginViaUi(tester, _hostEmail, _hostPassword);

      expect(find.text('Không hỗ trợ trên mobile'), findsOneWidget);
      // Role mismatch, not a login failure -- and structurally stronger
      // than Web's "Truy cập bị từ chối" (Host has no `/camper/*` shell to
      // even be denied entry to on Mobile; app_router.dart's redirect never
      // lets it build at all).
      expect(find.byType(NavigationBar), findsNothing);
      expect(find.text('Khám phá'), findsNothing);
      await IntegrationTestWidgetsFlutterBinding.instance.takeScreenshot(
        '07-host-role-blocked',
      );
    },
  );
}
