import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/storage/token_storage.dart';
import 'package:mobile/features/auth/data/auth_api.dart';
import 'package:mobile/features/auth/data/auth_repository.dart';
import 'package:mobile/features/auth/domain/auth_user.dart';
import 'package:mobile/features/auth/domain/user_role.dart';
import 'package:mobile/features/auth/presentation/widgets/logout_actions.dart';

class _FakeAuthRepository extends AuthRepository {
  _FakeAuthRepository({
    this.logoutFailure,
    this.logoutGate,
  }) : super(
          AuthApi(
            ApiClient(
              TokenStorage(
                const FlutterSecureStorage(),
              ),
            ),
          ),
          TokenStorage(
            const FlutterSecureStorage(),
          ),
        );

  final Object? logoutFailure;
  final Completer<void>? logoutGate;

  int logoutCallCount = 0;
  bool? lastAllDevices;

  static const authenticatedUser = AuthUser(
    id: 'logout-user',
    fullName: 'Logout Tester',
    email: 'logout@ctms.dev',
    role: UserRole.camper,
    roles: [UserRole.camper],
  );

  @override
  Future<AuthUser?> tryRestoreSession() async {
    return authenticatedUser;
  }

  @override
  Future<void> logout({
    bool allDevices = false,
  }) async {
    logoutCallCount++;
    lastAllDevices = allDevices;

    if (logoutGate != null) {
      await logoutGate!.future;
    }

    if (logoutFailure != null) {
      throw logoutFailure!;
    }
  }
}

Future<void> _pumpLogoutActions(
  WidgetTester tester,
  _FakeAuthRepository repository,
) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authRepositoryProvider.overrideWithValue(repository),
      ],
      child: const MaterialApp(
        home: Scaffold(
          body: Padding(
            padding: EdgeInsets.all(16),
            child: LogoutActions(),
          ),
        ),
      ),
    ),
  );

  await tester.pumpAndSettle();
}

void main() {
  group('LogoutActions - CTMS-08-T02', () {
    testWidgets(
      'renders current-device and all-device logout options',
      (tester) async {
        final repository = _FakeAuthRepository();

        await _pumpLogoutActions(
          tester,
          repository,
        );

        expect(
          find.text('Đăng xuất thiết bị này'),
          findsOneWidget,
        );

        expect(
          find.text('Đăng xuất tất cả thiết bị'),
          findsOneWidget,
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

    testWidgets(
      'current-device logout calls repository with allDevices false',
      (tester) async {
        final repository = _FakeAuthRepository();

        await _pumpLogoutActions(
          tester,
          repository,
        );

        await tester.tap(
          find.byKey(
            const Key('logout-current-device'),
          ),
        );

        await tester.pumpAndSettle();

        expect(
          repository.logoutCallCount,
          1,
        );

        expect(
          repository.lastAllDevices,
          isFalse,
        );
      },
    );

    testWidgets(
      'all-device logout requires confirmation before request',
      (tester) async {
        final repository = _FakeAuthRepository();

        await _pumpLogoutActions(
          tester,
          repository,
        );

        await tester.tap(
          find.byKey(
            const Key('logout-all-devices'),
          ),
        );

        await tester.pumpAndSettle();

        expect(
          find.text(
            'Đăng xuất khỏi tất cả thiết bị?',
          ),
          findsOneWidget,
        );

        expect(
          repository.logoutCallCount,
          0,
        );

        expect(
          find.text('Hủy'),
          findsOneWidget,
        );

        expect(
          find.text('Đăng xuất tất cả'),
          findsOneWidget,
        );
      },
    );

    testWidgets(
      'cancelling all-device confirmation does not logout',
      (tester) async {
        final repository = _FakeAuthRepository();

        await _pumpLogoutActions(
          tester,
          repository,
        );

        await tester.tap(
          find.byKey(
            const Key('logout-all-devices'),
          ),
        );

        await tester.pumpAndSettle();

        await tester.tap(
          find.text('Hủy'),
        );

        await tester.pumpAndSettle();

        expect(
          repository.logoutCallCount,
          0,
        );

        expect(
          find.text(
            'Đăng xuất khỏi tất cả thiết bị?',
          ),
          findsNothing,
        );
      },
    );

    testWidgets(
      'confirming all-device logout calls repository with allDevices true',
      (tester) async {
        final repository = _FakeAuthRepository();

        await _pumpLogoutActions(
          tester,
          repository,
        );

        await tester.tap(
          find.byKey(
            const Key('logout-all-devices'),
          ),
        );

        await tester.pumpAndSettle();

        await tester.tap(
          find.text('Đăng xuất tất cả'),
        );

        await tester.pumpAndSettle();

        expect(
          repository.logoutCallCount,
          1,
        );

        expect(
          repository.lastAllDevices,
          isTrue,
        );
      },
    );

    testWidgets(
      'logout failure displays safe error message',
      (tester) async {
        final repository = _FakeAuthRepository(
          logoutFailure: Exception(
            'backend internal details',
          ),
        );

        await _pumpLogoutActions(
          tester,
          repository,
        );

        await tester.tap(
          find.byKey(
            const Key('logout-current-device'),
          ),
        );

        await tester.pumpAndSettle();

        expect(
          repository.logoutCallCount,
          1,
        );

        expect(
          find.byKey(
            const Key('logout-error'),
          ),
          findsOneWidget,
        );

        expect(
          find.text(
            'Không thể đăng xuất lúc này. Vui lòng thử lại.',
          ),
          findsOneWidget,
        );

        // Không expose raw backend/internal exception.
        expect(
          find.textContaining(
            'backend internal details',
          ),
          findsNothing,
        );

        // User vẫn thấy logout controls để retry.
        expect(
          find.text('Đăng xuất thiết bị này'),
          findsOneWidget,
        );
      },
    );

    testWidgets(
      'prevents repeated current-device logout submissions while request is in flight',
      (tester) async {
        final gate = Completer<void>();

        final repository = _FakeAuthRepository(
          logoutGate: gate,
        );

        await _pumpLogoutActions(
          tester,
          repository,
        );

        final logoutButton = find.byKey(
          const Key('logout-current-device'),
        );

        await tester.tap(logoutButton);
        await tester.pump();

        // Request đầu tiên vẫn đang pending.
        expect(
          repository.logoutCallCount,
          1,
        );

        expect(
          find.byType(
            CircularProgressIndicator,
          ),
          findsOneWidget,
        );

        // Button phải disable trong lúc request đang chạy.
        final button = tester.widget<OutlinedButton>(
          logoutButton,
        );

        expect(
          button.onPressed,
          isNull,
        );

        // Hoàn tất request để tránh pending async khi kết thúc test.
        gate.complete();

        await tester.pumpAndSettle();

        expect(
          repository.logoutCallCount,
          1,
        );
      },
    );
  });
}