import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/offline_packages/application/package_download_controller.dart';
import 'package:mobile/features/offline_packages/domain/offline_package.dart';
import 'package:mobile/features/offline_packages/presentation/offline_package_screen.dart';

import 'package_integrity_fixture.dart';

class _Controller extends PackageDownloadController {
  _Controller() : super(testTripId, () => throw StateError('Widget test'));
  int starts = 0;
  int pauses = 0;
  int loads = 0;

  @override
  Future<void> start() async => starts++;

  @override
  void pause() => pauses++;

  @override
  Future<void> load() async => loads++;
}

void main() {
  final package = zipMetadata(packageZip(), version: 2);
  final previous = zipMetadata(packageZip());
  const ready = 'Sẵn sàng sử dụng ngoại tuyến';
  const finalizing = 'Đang hoàn tất dữ liệu…';
  late _Controller controller;

  setUp(() {
    controller = _Controller()
      ..loading = false
      ..package = package;
  });

  Future<void> render(WidgetTester tester, {bool summaryOnly = false}) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          packageDownloadControllerProvider(
            testTripId,
          ).overrideWith((ref) => controller),
        ],
        child: MaterialApp(
          home: Scaffold(
            body: OfflinePackagePanel(
              tripId: testTripId,
              summaryOnly: summaryOnly,
            ),
          ),
        ),
      ),
    );
    expect(
      find.textContaining(RegExp('Verify|SHA-256|manifest|Phiên bản')),
      findsNothing,
    );
    expect(find.text('Xem dữ liệu'), findsNothing);
  }

  testWidgets('new package has a single download action and no progress bar', (
    tester,
  ) async {
    await render(tester);
    expect(find.byType(FilledButton), findsOneWidget);
    expect(find.byType(LinearProgressIndicator), findsNothing);
    await tester.tap(find.text('Tải xuống'));
    expect(controller.starts, 1);
  });

  testWidgets('downloading shows accessible progress and a pause action', (
    tester,
  ) async {
    controller
      ..downloading = true
      ..local = LocalPackageDownload(
        package,
        PackageDownloadStatus.downloading,
        package.sizeBytes ~/ 2,
      );
    await render(tester);
    expect(find.textContaining('Đang tải · '), findsOneWidget);
    final indicator = tester.widget<LinearProgressIndicator>(
      find.byType(LinearProgressIndicator),
    );
    expect(indicator.semanticsLabel, 'Tiến độ tải dữ liệu ngoại tuyến');
    expect(indicator.value, closeTo(.5, .01));
    expect(find.byType(FilledButton), findsOneWidget);
    await tester.tap(find.text('Tạm dừng'));
    expect(controller.pauses, 1);
  });

  testWidgets('interruption shows progress and only resume', (tester) async {
    controller.local = LocalPackageDownload(
      package,
      PackageDownloadStatus.interrupted,
      package.sizeBytes ~/ 2,
    );
    await render(tester);
    expect(find.textContaining('Đã tải '), findsOneWidget);
    expect(find.byType(LinearProgressIndicator), findsOneWidget);
    expect(find.byType(FilledButton), findsOneWidget);
    await tester.tap(find.text('Tiếp tục tải'));
    expect(controller.starts, 1);
  });

  for (final status in [
    PackageVerificationStatus.pending,
    PackageVerificationStatus.verifying,
  ]) {
    testWidgets(
      'completed transfer during $status cannot show ready or an action',
      (tester) async {
        controller
          ..local = LocalPackageDownload(
            package,
            PackageDownloadStatus.downloaded,
            package.sizeBytes,
          )
          ..verification = status;
        await render(tester);
        expect(find.text(finalizing), findsOneWidget);
        expect(find.text(ready), findsNothing);
        expect(find.byType(LinearProgressIndicator), findsNothing);
        expect(find.byType(FilledButton), findsNothing);
      },
    );
  }

  testWidgets('verified and active is ready without progress or actions', (
    tester,
  ) async {
    controller
      ..basemapReady = true
      ..basemapPackageId = package.id
      ..verification = PackageVerificationStatus.verified
      ..active = package;
    await render(tester);
    expect(find.text(ready), findsOneWidget);
    expect(find.byType(LinearProgressIndicator), findsNothing);
    expect(find.byType(FilledButton), findsNothing);
  });

  testWidgets('verified core without basemap cannot show offline ready', (
    tester,
  ) async {
    controller
      ..verification = PackageVerificationStatus.verified
      ..active = package;
    await render(tester);
    expect(find.text(ready), findsNothing);
    expect(find.text('Tải nền bản đồ'), findsOneWidget);
    await tester.tap(find.text('Tải nền bản đồ'));
    expect(controller.starts, 1);
  });

  testWidgets('basemap transfer has separate progress and pause', (
    tester,
  ) async {
    controller
      ..downloading = true
      ..downloadingBasemap = true
      ..basemapProgress = .4;
    await render(tester);
    expect(find.text('Đang tải nền bản đồ · 40%'), findsOneWidget);
    await tester.tap(find.text('Tạm dừng'));
    expect(controller.pauses, 1);
  });

  testWidgets('verified without an active version cannot show ready', (
    tester,
  ) async {
    controller.verification = PackageVerificationStatus.verified;
    await render(tester);
    expect(find.text(ready), findsNothing);
    expect(find.textContaining('Gói đã tải nhưng chưa được kích hoạt.'), findsOneWidget);
    await tester.tap(find.text('Kiểm tra lại'));
    expect(controller.loads, 1);
  });

  testWidgets(
    'failed replacement has one retry and mentions the active fallback',
    (tester) async {
      controller
        ..verification = PackageVerificationStatus.failed
        ..active = previous;
      await render(tester);
      expect(
        find.text('Không thể hoàn tất dữ liệu ngoại tuyến'),
        findsOneWidget,
      );
      expect(find.text('Bản trước vẫn dùng được ngoại tuyến.'), findsOneWidget);
      expect(find.byType(LinearProgressIndicator), findsNothing);
      expect(find.byType(FilledButton), findsOneWidget);
      await tester.tap(find.text('Tải lại'));
      expect(controller.starts, 1);
    },
  );

  testWidgets('unavailable metadata can be refreshed from a single action', (
    tester,
  ) async {
    controller.package = null;
    await render(tester);
    expect(find.text('Chưa có dữ liệu ngoại tuyến'), findsOneWidget);
    expect(find.byType(FilledButton), findsOneWidget);
    await tester.tap(find.text('Thử lại'));
    expect(controller.loads, 1);
  });

  testWidgets('sync summary shows status without download controls', (
    tester,
  ) async {
    controller
      ..downloading = true
      ..local = LocalPackageDownload(
        package,
        PackageDownloadStatus.downloading,
        20,
      );
    await render(tester, summaryOnly: true);
    expect(find.textContaining('Đang tải · '), findsOneWidget);
    expect(find.byType(FilledButton), findsNothing);
    expect(find.byType(LinearProgressIndicator), findsNothing);
  });
}
