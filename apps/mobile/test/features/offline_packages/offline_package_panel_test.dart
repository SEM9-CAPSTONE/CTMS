import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/offline_packages/application/package_download_controller.dart';
import 'package:mobile/features/offline_packages/domain/offline_package.dart';
import 'package:mobile/features/offline_packages/presentation/offline_package_screen.dart';

void main() {
  final package = OfflinePackage(
    id: 'a1736fee-62be-4991-9478-a62288e9b80b',
    tripId: 'a1736fee-62be-4991-9478-a62288e9b80a',
    packageVersion: 2,
    sha256: List.filled(64, 'a').join(),
    sizeBytes: 10 * 1024 * 1024,
    generatedAt: DateTime.utc(2026, 11, 8),
  );
  Future<void> render(
    WidgetTester tester,
    PackageDownloadStatus status,
    int bytes,
  ) async {
    final controller =
        PackageDownloadController(
            package.tripId,
            () => throw StateError('No network in view test'),
          )
          ..loading = false
          ..package = package
          ..local = LocalPackageDownload(package, status, bytes);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          packageDownloadControllerProvider(
            package.tripId,
          ).overrideWith((ref) => controller),
        ],
        child: MaterialApp(
          home: Scaffold(body: OfflinePackagePanel(tripId: package.tripId)),
        ),
      ),
    );
  }

  testWidgets(
    'shows version, size, byte progress and resume after interruption',
    (tester) async {
      await render(tester, PackageDownloadStatus.interrupted, 5 * 1024 * 1024);
      expect(find.text('Phiên bản 2 · 10.00 MB'), findsOneWidget);
      expect(find.text('5.00 MB / 10.00 MB · 50%'), findsOneWidget);
      expect(find.text('Tiếp tục tải'), findsOneWidget);
    },
  );
  testWidgets(
    'completed transport is explicitly unverified with no offline-use action',
    (tester) async {
      await render(tester, PackageDownloadStatus.downloaded, package.sizeBytes);
      expect(find.text('Đã tải xuống · Chưa xác minh'), findsOneWidget);
      expect(find.text('Tải về thiết bị'), findsNothing);
      expect(
        find.text(
          'Gói dữ liệu cần được xác minh trước khi sử dụng ngoại tuyến.',
        ),
        findsOneWidget,
      );
    },
  );
}
