import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:path_provider/path_provider.dart';
import 'package:mobile/core/storage/token_storage.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/auth/application/auth_controller.dart';
import 'package:mobile/features/offline_packages/application/package_download_controller.dart';
import 'package:mobile/features/offline_packages/data/package_download_store.dart';
import 'package:mobile/features/offline_packages/domain/offline_package.dart';
import 'package:mobile/features/offline_packages/presentation/offline_package_screen.dart';

/// Opt-in evidence harness: production widgets/providers and real development API.
/// Requires artifacts/ctms306-real-capture-control.cjs and a fresh published demo.
/// Transport corruption/drop is explicit; no API success response is fabricated.
void main() {
  if (!const bool.fromEnvironment('CTMS306_EVIDENCE')) {
    test(
      'manual evidence harness is opt-in',
      () {},
      skip: 'Requires CTMS306_EVIDENCE=true and isolated test database',
    );
    return;
  }
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  const trip = '306de000-0000-4000-8000-000000000141';
  testWidgets(
    'capture actual API policy lifecycle and controlled failure cases',
    (tester) async {
      final control = Dio(
        BaseOptions(
          baseUrl: 'http://10.0.2.2:3031',
          receiveTimeout: const Duration(seconds: 40),
        ),
      );
      final runId = DateTime.now().millisecondsSinceEpoch;
      final containers = <ProviderContainer>[];
      Future<void> phase(String name, [Map<String, String>? query]) async {
        await tester.runAsync(() async {
          await control.get<Object?>('/$name', queryParameters: query);
        });
      }

      Future<ProviderContainer> login(String role, String password) async {
        final container = ProviderContainer(
          overrides: [
            tokenStorageProvider.overrideWithValue(
              TokenStorage(
                FlutterSecureStorage(
                  aOptions: AndroidOptions(
                    storageNamespace:
                        'ctms306-real-$role-$runId-${containers.length}',
                  ),
                ),
              ),
            ),
            packageDownloadStoreProvider.overrideWith((ref) async {
              final account = ref.watch(offlinePackageAccountProvider);
              if (account == null) return null;
              final support = await getApplicationSupportDirectory();
              return PackageDownloadStore(
                Directory('${support.path}/ctms306-evidence-$runId/$account'),
              );
            }),
          ],
        );
        containers.add(container);
        await tester.runAsync(() async {
          await container.read(authControllerProvider.future);
          await container
              .read(authControllerProvider.notifier)
              .login(identifier: '$role@ctms.local', password: password);
        });
        return container;
      }

      Future<PackageDownloadController> show(
        ProviderContainer container,
      ) async {
        final controller = container.read(
          packageDownloadControllerProvider(trip),
        );
        await tester.pumpWidget(
          UncontrolledProviderScope(
            container: container,
            child: MaterialApp(
              theme: AppTheme.light(),
              debugShowCheckedModeBanner: false,
              home: OfflinePackageScreen(
                tripId: trip,
                accountId: container.read(offlinePackageAccountProvider)!,
                tripTitle: '[DEMO CTMS-306] API thật · dữ liệu mẫu',
              ),
            ),
          ),
        );
        await tester.runAsync(() async {
          while (controller.loading) {
            await Future<void>.delayed(const Duration(milliseconds: 100));
          }
        });
        await tester.pumpAndSettle();
        return controller;
      }

      Future<void> shot(String name, {bool bottom = false}) async {
        if (bottom) {
          await tester.drag(find.byType(ListView).first, const Offset(0, -440));
          await tester.pumpAndSettle();
        }
        await phase('capture', {'name': name});
      }

      Future<void> reload(PackageDownloadController c) async {
        await tester.runAsync(c.load);
        await tester.pumpAndSettle();
      }

      try {
        final camper = await login('camper', 'Camper@123');
        final camperSubscription = camper.listen(
          packageDownloadControllerProvider(trip),
          (_, _) {},
        );
        final cc = await show(camper);
        expect(cc.policy?.hasRequirement, false);
        await shot('camper-not-downloaded');
        await tester.runAsync(cc.start);
        await tester.pumpAndSettle();
        expect(cc.active?.packageVersion, 1);
        await shot('camper-active-no-requirement');
        await phase('mode', {'value': 'offline'});
        await reload(cc);
        expect(cc.policyOffline, true);
        await shot('offline-cached');
        await phase('mode', {'value': 'normal'});
        await reload(cc);
        await phase('require-v1');
        await tester.runAsync(() async {
          await camper.read(authControllerProvider.notifier).logout();
          await camper
              .read(authControllerProvider.notifier)
              .login(identifier: 'porter@ctms.local', password: 'Porter@123');
        });
        final porter = camper;
        final porterSubscription = porter.listen(
          packageDownloadControllerProvider(trip),
          (_, _) {},
        );
        final pc = await show(porter);
        expect(pc.active, isNull);
        expect(pc.local?.downloadedBytes ?? 0, 0);
        await shot('account-switched-no-local-data');
        expect(pc.policy?.hasRequirement, true);
        await shot('porter-required-not-downloaded');
        await tester.runAsync(pc.start);
        await tester.pumpAndSettle();
        expect(pc.active?.packageVersion, 1);
        await tester.runAsync(pc.confirmDeparture);
        await tester.pumpAndSettle();
        expect(pc.departureMessage, contains('Chưa xác nhận được thiết bị'));
        await shot('porter-unknown-readiness');
        await shot('porter-unknown-readiness-actions', bottom: true);
        await phase('optional-v2');
        await reload(pc);
        expect(pc.policy?.newerAvailable, true);
        expect(pc.package?.packageVersion, 2);
        await show(porter);
        await shot('optional-update');
        await phase('required-v3');
        await reload(pc);
        expect(pc.package?.packageVersion, 3);
        await shot('required-update');
        await phase('mode', {'value': 'corrupt'});
        await tester.runAsync(pc.start);
        await tester.pumpAndSettle();
        expect(pc.verification, PackageVerificationStatus.failed);
        expect(pc.active?.packageVersion, 1);
        await shot('hash-mismatch');
        await phase('mode', {'value': 'slow'});
        Future<void>? transfer;
        await tester.runAsync(() async {
          transfer = pc.start();
          await Future<void>.delayed(const Duration(milliseconds: 1400));
        });
        await tester.pump(const Duration(milliseconds: 200));
        expect(pc.downloading, true);
        await phase('capture', {'name': 'downloading-real-bytes'});
        await phase('mode', {'value': 'report-drop'});
        await tester.runAsync(() async {
          await transfer;
        });
        await tester.pumpAndSettle();
        expect(pc.awaitingActivation, true);
        expect(pc.policy?.requiredId, pc.package?.id);
        expect(pc.active?.packageVersion, 1);
        await shot('pending-report-keeps-old');
        await phase('mode', {'value': 'normal'});
        await reload(pc);
        expect(pc.active?.packageVersion, 3);
        expect(pc.awaitingActivation, false);
        await shot('report-retry-active-v3');
        await phase('ongoing');
        await reload(pc);
        expect(pc.replacementLocked, true);
        expect(pc.activeMatchesTripLock, true);
        expect(pc.active?.packageVersion, 3);
        await shot('ongoing-locked-v3-newer-v4');
        final returningCamper = await login('camper', 'Camper@123');
        final returningSubscription = returningCamper.listen(
          packageDownloadControllerProvider(trip),
          (_, _) {},
        );
        final returning = await show(returningCamper);
        await reload(returning);
        expect(returning.active?.packageVersion, 1);
        expect(returning.activeMatchesTripLock, false);
        await shot('camper-lock-mismatch');
        await phase('revoke');
        await reload(returning);
        expect(returning.readyForOffline, false);
        expect(returning.policy, isNull);
        expect(await tester.runAsync(() => returning.openActive(1)), isNull);
        await shot('forbidden-real-api');
        await phase('restore');
        final deniedRole = await login('host', 'Host@123');
        final deniedSubscription = deniedRole.listen(
          packageDownloadControllerProvider(trip),
          (_, _) {},
        );
        final denied = await show(deniedRole);
        expect(denied.error, 'Bạn không còn quyền với chuyến này');
        expect(denied.active, isNull);
        await shot('forbidden-403-role-guard');
        deniedSubscription.close();
        returningSubscription.close();
        camperSubscription.close();
        porterSubscription.close();
      } finally {
        await phase('mode', {'value': 'normal'});
        await phase('restore');
        await tester.pumpWidget(const SizedBox.shrink());
        for (final container in containers) {
          container.dispose();
        }
      }
    },
    timeout: const Timeout(Duration(minutes: 10)),
  );
}
