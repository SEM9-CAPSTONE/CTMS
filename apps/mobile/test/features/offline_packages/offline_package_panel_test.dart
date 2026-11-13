import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/offline_packages/application/package_download_controller.dart';
import 'package:mobile/features/offline_packages/domain/offline_package.dart';
import 'package:mobile/features/offline_packages/presentation/offline_package_screen.dart';
import 'package:mobile/features/offline_packages/presentation/departure_status_panel.dart';
import 'package:mobile/features/offline_packages/domain/package_policy.dart';
import 'package:mobile/core/api/api_exception.dart';

import 'package_integrity_fixture.dart';

class _Controller extends PackageDownloadController {
  _Controller() : super(testTripId, () => throw StateError('Widget test'));
  int starts = 0;
  int pauses = 0;
  int loads = 0;

  @override
  Future<void> start({String? tripTitle}) async => starts++;

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

  Future<void> render(
    WidgetTester tester, {
    bool summaryOnly = false,
    bool denied = false,
  }) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          offlinePackageAccountProvider.overrideWithValue('test-account'),
          departureStatusProvider(testTripId).overrideWith((ref) async {
            if (denied) throw ApiException('Forbidden', statusCode: 403);
            return {'blocked': false};
          }),
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
      find.textContaining(RegExp('Verify|SHA-256|manifest')),
      findsNothing,
    );
    if (!summaryOnly && (controller.active ?? controller.package) != null) {
      final selected = controller.active ?? controller.package!;
      expect(
        find.textContaining(
          RegExp(
            '(Gói (đang sử dụng|đang lưu trên thiết bị|trên thiết bị)|Bản (cần dùng|mới nhất)): v${selected.packageVersion}',
          ),
        ),
        findsOneWidget,
      );
      expect(find.textContaining('Cập nhật gói:'), findsOneWidget);
    }
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

  testWidgets('verified and active offers the offline viewer', (tester) async {
    controller
      ..basemapReady = true
      ..basemapPackageId = package.id
      ..verification = PackageVerificationStatus.verified
      ..active = package;
    await render(tester);
    expect(find.text(ready), findsOneWidget);
    expect(find.byType(LinearProgressIndicator), findsNothing);
    expect(find.byType(FilledButton), findsNothing);
    expect(find.text('Xem dữ liệu'), findsOneWidget);
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
    expect(find.byType(FilledButton), findsOneWidget);
    expect(find.text('Xem dữ liệu'), findsNothing);
    expect(
      find.textContaining('Gói đã tải nhưng chưa được kích hoạt.'),
      findsOneWidget,
    );
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
      expect(find.text('Gói cũ vẫn dùng được.'), findsOneWidget);
      expect(find.byType(LinearProgressIndicator), findsNothing);
      expect(find.byType(FilledButton), findsOneWidget);
      expect(find.text('Xem dữ liệu'), findsOneWidget);
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

  testWidgets(
    'ongoing has exactly one lock message and no replacement action',
    (tester) async {
      controller
        ..active = package
        ..verification = PackageVerificationStatus.verified
        ..policy = PackagePolicy({
          'tripStatus': 'ongoing',
          'replaceAllowed': false,
          'lockedPackageId': package.id,
          'checkedAt': '2026-11-12T03:00:00Z',
          'sourceFreshness': {'state': 'unknown'},
          'publication': {'newerAvailable': true},
        });
      await render(tester);
      expect(
        find.text('Có bản mới, chuyến này giữ bản đã khóa'),
        findsOneWidget,
      );
      expect(find.textContaining('bản đã khóa'), findsOneWidget);
      expect(find.byType(FilledButton), findsNothing);
    },
  );
  testWidgets('local v1 is not labelled as locked v3 for another device', (
    tester,
  ) async {
    controller
      ..active = previous
      ..verification = PackageVerificationStatus.verified
      ..policy = PackagePolicy({
        'tripStatus': 'ongoing',
        'replaceAllowed': false,
        'lockedPackageId': 'locked-v3',
        'checkedAt': '2026-11-12T03:00:00Z',
        'sourceFreshness': {'state': 'unknown'},
        'publication': {
          'newerAvailable': true,
          'requiredPackageId': 'locked-v3',
          'requiredVersion': 3,
        },
      });
    await render(tester);
    expect(
      find.textContaining('Gói trên thiết bị khác bản đã khóa'),
      findsOneWidget,
    );
    expect(find.text('Gói đang lưu trên thiết bị: v1'), findsOneWidget);
    expect(find.text('Bản đã khóa cho chuyến: v3'), findsOneWidget);
    expect(find.text('Có bản mới, chuyến này giữ bản đã khóa'), findsNothing);
    expect(find.byType(FilledButton), findsNothing);
  });

  testWidgets(
    'pending sync message is not duplicated and retains old-package explanation',
    (tester) async {
      controller
        ..active = previous
        ..awaitingActivation = true
        ..verification = PackageVerificationStatus.verified;
      await render(tester);
      expect(find.text('Đã tải, chờ đồng bộ'), findsOneWidget);
      expect(find.text('Gói cũ vẫn dùng được.'), findsOneWidget);
    },
  );
  testWidgets(
    '403 has one permission message without a stray departure-check button',
    (tester) async {
      controller
        ..package = null
        ..active = null
        ..error = 'Bạn không còn quyền với chuyến này';
      await render(tester, denied: true);
      await tester.pump();
      expect(find.text('Bạn không còn quyền với chuyến này'), findsOneWidget);
      expect(find.text('Kiểm tra khởi hành'), findsNothing);
      expect(find.textContaining('Bỏ qua'), findsNothing);
    },
  );

  for (final status in ['ongoing', 'completed', 'cancelled']) {
    testWidgets('$status hides all departure reminders', (tester) async {
      controller.policy = PackagePolicy({
        'tripStatus': status,
        'replaceAllowed': false,
        'checkedAt': '2026-11-12T03:00:00Z',
        'sourceFreshness': {'state': 'unknown'},
        'publication': {'newerAvailable': false},
      });
      await render(tester);
      expect(find.byType(DepartureStatusPanel), findsNothing);
      expect(find.textContaining('Thông báo khởi hành chưa đọc'), findsNothing);
      expect(find.text('Kiểm tra khởi hành'), findsNothing);
    });
  }

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
    expect(find.text('Xem dữ liệu'), findsNothing);
  });
}
