import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mobile/core/storage/token_storage.dart';
import 'package:mobile/features/auth/application/auth_controller.dart';
import 'package:mobile/features/offline_packages/application/package_download_controller.dart';
import 'package:mobile/features/offline_packages/domain/offline_package.dart';
import 'package:mobile/features/offline_packages/presentation/offline_package_screen.dart';

/// Run against services/api/test/e2e/start-package-policy-server.ts on port 3019
/// with its isolated ctms306_host_review_test database. Never use development DB.
/// Uses production auth, download, verification, report and widget providers.
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  const trip = '306de000-0000-4000-8000-000000000061';

  testWidgets(
    'real API activation preserves unknown freshness and rejects readiness',
    (tester) async {
      final tokens = TokenStorage(
        const FlutterSecureStorage(
          aOptions: AndroidOptions(storageNamespace: 'ctms306-integration'),
        ),
      );
      final container = ProviderContainer(
        overrides: [tokenStorageProvider.overrideWithValue(tokens)],
      );
      addTearDown(container.dispose);
      await tester.runAsync(() async {
        await container.read(authControllerProvider.future);
        await container
            .read(authControllerProvider.notifier)
            .login(identifier: 'porter@ctms.local', password: 'Porter@123');
      });
      expect(container.read(authControllerProvider).requireValue, isNotNull);
      final subscription = container.listen(
        packageDownloadControllerProvider(trip),
        (_, _) {},
      );
      addTearDown(subscription.close);
      final controller = subscription.read();
      await tester.runAsync(() async {
        while (controller.loading) {
          await Future<void>.delayed(const Duration(milliseconds: 100));
        }
        await controller.start(tripTitle: 'Gói kiểm thử CTMS-306');
      });
      expect(controller.active, isNotNull, reason: controller.error);
      expect(controller.verification, PackageVerificationStatus.verified);
      expect(controller.policy?.sourceState, 'unknown');
      expect(controller.active?.id, controller.policy?.requiredId);
      await tester.runAsync(controller.confirmDeparture);
      expect(
        controller.departureMessage,
        isNot('Đã xác nhận thiết bị sẵn sàng.'),
      );
      expect(
        controller.departureMessage,
        contains('Chưa xác nhận được thiết bị'),
      );
      expect(controller.confirmingDeparture, isFalse);
      expect(controller.active?.id, controller.policy?.requiredId);
      expect(controller.policy?.sourceState, 'unknown');
      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: const MaterialApp(
            home: Scaffold(
              body: SingleChildScrollView(
                child: OfflinePackagePanel(
                  tripId: trip,
                  tripTitle: 'Gói kiểm thử CTMS-306',
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pump();
      expect(
        find.textContaining('Chưa xác nhận dữ liệu là bản cập nhật mới nhất'),
        findsOneWidget,
      );
      expect(find.text('Đã xác nhận thiết bị sẵn sàng.'), findsNothing);
      await tester.pumpWidget(const SizedBox.shrink());
    },
    timeout: const Timeout(Duration(minutes: 4)),
  );
}
