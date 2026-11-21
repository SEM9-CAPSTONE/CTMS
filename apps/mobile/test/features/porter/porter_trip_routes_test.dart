import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/router/app_router.dart';
import 'package:mobile/features/auth/application/auth_controller.dart';
import 'package:mobile/features/auth/domain/auth_user.dart';
import 'package:mobile/features/auth/domain/user_role.dart';
import 'package:mobile/features/trip_operations/application/trip_operations_providers.dart';
import 'package:mobile/features/trip_operations/data/trip_operations_api.dart';
import 'package:mobile/features/trip_operations/presentation/porter_trips_screen.dart';
import 'porter_trip_test_support.dart';
import 'porter_trips_screen_test.dart' show WorkspaceApi, account;

class _PorterAuth extends AuthController {
  @override
  Future<AuthUser?> build() async => const AuthUser(
    id: account,
    email: 'porter@ctms.local',
    role: UserRole.porter,
    roles: [UserRole.porter],
  );
}

void main() {
  for (final legacy in ['map', 'schedule']) {
    testWidgets('$legacy redirects to one trip tab and keeps trip selection', (
      tester,
    ) async {
      final container = ProviderContainer(
        overrides: [
          authControllerProvider.overrideWith(_PorterAuth.new),
          porterOperationsAccountProvider.overrideWithValue(account),
          tripOperationsApiProvider.overrideWithValue(WorkspaceApi()),
          ...trackingOverrides(),
        ],
      );
      await container.read(authControllerProvider.future);
      final router = container.read(appRouterProvider);
      router.go('/porter/$legacy?tripId=$tripOne');
      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: MaterialApp.router(routerConfig: router),
        ),
      );
      await tester.pumpAndSettle();
      expect(router.routeInformationProvider.value.uri.path, '/porter/trips');
      expect(
        router.routeInformationProvider.value.uri.queryParameters['tripId'],
        tripOne,
      );
      expect(find.byType(PorterTripsScreen), findsOneWidget);
      expect(
        find.widgetWithText(NavigationDestination, 'Chuyến đi'),
        findsOneWidget,
      );
      expect(find.widgetWithText(NavigationDestination, 'Lịch'), findsNothing);
      expect(
        find.widgetWithText(NavigationDestination, 'Bản đồ'),
        findsNothing,
      );
      expect(find.text('Bắt đầu chuyến đi'), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
      router.dispose();
      container.dispose();
    });
  }
}
