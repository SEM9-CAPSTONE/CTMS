import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'package:mobile/app.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  const email = 'porter@ctms.local';
  const password = 'Porter@123';

  setUp(() async {
    const storage = FlutterSecureStorage();
    await storage.deleteAll();
  });

  Future<void> loginAsPorter(WidgetTester tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: CtmsApp(),
      ),
    );

    await tester.pumpAndSettle();

    expect(
      find.widgetWithText(
        ElevatedButton,
        'Đăng nhập →',
      ),
      findsOneWidget,
    );

    final fields = find.byType(TextFormField);

    expect(fields, findsNWidgets(2));

    await tester.enterText(
      fields.at(0),
      email,
    );

    await tester.enterText(
      fields.at(1),
      password,
    );

    await tester.tap(
      find.widgetWithText(
        ElevatedButton,
        'Đăng nhập →',
      ),
    );

    await tester.pumpAndSettle();

    if (find.byType(NavigationBar).evaluate().isEmpty) {
      final texts = tester
          .widgetList<Text>(
            find.byType(Text),
          )
          .map((widget) => widget.data)
          .whereType<String>()
          .where((text) => text.trim().isNotEmpty)
          .toList();

      fail(
        'Porter login did not reach authenticated shell.\n'
        'Visible text: $texts',
      );
    }

    expect(
      find.byType(NavigationBar),
      findsOneWidget,
    );
  }

  Future<void> openPorterSettings(
    WidgetTester tester,
  ) async {
    final moreButton = find.text('Thêm');

    expect(
      moreButton,
      findsOneWidget,
    );

    await tester.tap(moreButton);
    await tester.pumpAndSettle();

    final settingsButton = find.text(
      'Hồ sơ & cài đặt',
    );

    expect(
      settingsButton,
      findsOneWidget,
    );

    await tester.tap(settingsButton);
    await tester.pumpAndSettle();

    expect(
      find.byKey(
        const Key('logout-current-device'),
      ),
      findsOneWidget,
    );

    expect(
      find.byKey(
        const Key('logout-all-devices'),
      ),
      findsOneWidget,
    );
  }

  group('CTMS-08 Logout E2E', () {
    testWidgets(
      'porter logs out from current device and returns to login',
      (tester) async {
        await loginAsPorter(tester);

        await openPorterSettings(tester);

        final currentLogout = find.byKey(
          const Key('logout-current-device'),
        );

        await tester.ensureVisible(currentLogout);
        await tester.pumpAndSettle();

        await tester.tap(currentLogout);
        await tester.pumpAndSettle();

        expect(
          find.widgetWithText(
            ElevatedButton,
            'Đăng nhập →',
          ),
          findsOneWidget,
        );

        expect(
          find.byType(NavigationBar),
          findsNothing,
        );

        expect(
          find.byKey(
            const Key('logout-current-device'),
          ),
          findsNothing,
        );
      },
    );

    testWidgets(
      'logout all devices requires confirmation and redirects to login',
      (tester) async {
        await loginAsPorter(tester);

        await openPorterSettings(tester);

        final logoutAll = find.byKey(
          const Key('logout-all-devices'),
        );

        await tester.ensureVisible(logoutAll);
        await tester.pumpAndSettle();

        await tester.tap(logoutAll);
        await tester.pumpAndSettle();

        expect(
          find.text(
            'Đăng xuất khỏi tất cả thiết bị?',
          ),
          findsOneWidget,
        );

        // Chưa confirm thì user vẫn authenticated.
        expect(
          find.widgetWithText(
            ElevatedButton,
            'Đăng nhập →',
          ),
          findsNothing,
        );

        expect(
          find.byKey(
            const Key('logout-current-device'),
          ),
          findsOneWidget,
        );

        expect(
          find.text('Hủy'),
          findsOneWidget,
        );

        expect(
          find.text('Đăng xuất tất cả'),
          findsOneWidget,
        );

        await tester.tap(
          find.text('Đăng xuất tất cả'),
        );

        await tester.pumpAndSettle();

        expect(
          find.widgetWithText(
            ElevatedButton,
            'Đăng nhập →',
          ),
          findsOneWidget,
        );

        expect(
          find.byType(NavigationBar),
          findsNothing,
        );

        expect(
          find.byKey(
            const Key('logout-all-devices'),
          ),
          findsNothing,
        );
      },
    );

    testWidgets(
      'cancelling all-device logout keeps authenticated session',
      (tester) async {
        await loginAsPorter(tester);

        await openPorterSettings(tester);

        final logoutAll = find.byKey(
          const Key('logout-all-devices'),
        );

        await tester.ensureVisible(logoutAll);
        await tester.pumpAndSettle();

        await tester.tap(logoutAll);
        await tester.pumpAndSettle();

        expect(
          find.text(
            'Đăng xuất khỏi tất cả thiết bị?',
          ),
          findsOneWidget,
        );

        await tester.tap(
          find.text('Hủy'),
        );

        await tester.pumpAndSettle();

        expect(
          find.text(
            'Đăng xuất khỏi tất cả thiết bị?',
          ),
          findsNothing,
        );

        expect(
          find.widgetWithText(
            ElevatedButton,
            'Đăng nhập →',
          ),
          findsNothing,
        );

        expect(
          find.byKey(
            const Key('logout-current-device'),
          ),
          findsOneWidget,
        );

        expect(
          find.byKey(
            const Key('logout-all-devices'),
          ),
          findsOneWidget,
        );
      },
    );
  });
}