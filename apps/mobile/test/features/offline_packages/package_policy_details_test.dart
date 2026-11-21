import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/offline_packages/application/package_download_controller.dart';
import 'package:mobile/features/offline_packages/domain/package_policy.dart';
import 'package:mobile/features/offline_packages/domain/offline_package.dart';
import 'package:mobile/features/offline_packages/presentation/package_policy_details.dart';
import 'package_integrity_fixture.dart';

void main() {
  testWidgets('downloaded unverified data uses the approved friendly wording', (
    tester,
  ) async {
    final package = zipMetadata(packageZip());
    final state =
        PackageDownloadController(
            testTripId,
            () => throw StateError('Not called'),
          )
          ..package = package
          ..local = LocalPackageDownload(
            package,
            PackageDownloadStatus.downloaded,
            package.sizeBytes,
          );
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: PackagePolicyDetails(controller: state)),
      ),
    );
    expect(find.text('Gói v1: Đang chờ kiểm tra'), findsOneWidget);
    expect(
      find.text('Chưa xác nhận dữ liệu là bản cập nhật mới nhất'),
      findsOneWidget,
    );
    state.dispose();
  });
  PackageDownloadController controller({
    bool locked = false,
    bool required = false,
  }) =>
      PackageDownloadController(
          testTripId,
          () => throw StateError('Not called'),
        )
        ..active = zipMetadata(packageZip())
        ..policy = PackagePolicy({
          'tripStatus': locked ? 'ongoing' : 'published',
          'checkedAt': '2026-11-12T00:00:00Z',
          'replaceAllowed': !locked,
          'sourceFreshness': {'state': 'unknown'},
          'publication': {
            'latestVersion': 2,
            'newerAvailable': true,
            'updateRequired': required,
            'requiredPackageId': required ? 'required-package' : null,
            'requiredVersion': required ? 2 : null,
          },
        });
  Future<void> mount(
    WidgetTester tester,
    PackageDownloadController state, {
    bool porter = false,
  }) => tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: SingleChildScrollView(
          child: PackagePolicyDetails(controller: state, isPorter: porter),
        ),
      ),
    ),
  );

  testWidgets('empty transfer journal is not described as downloaded data', (
    tester,
  ) async {
    final package = zipMetadata(packageZip());
    final state = controller()
      ..active = null
      ..package = package
      ..local = LocalPackageDownload(
        package,
        PackageDownloadStatus.interrupted,
        0,
      );
    await mount(tester, state);
    expect(find.text('Gói v1: Chưa tải'), findsOneWidget);
    expect(find.text('Bản mới nhất: v1'), findsOneWidget);
    expect(find.text('Gói v1: Đang chờ kiểm tra'), findsNothing);
    state.dispose();
  });

  testWidgets(
    'pending required candidate stays mandatory when context is relative to candidate',
    (tester) async {
      final state = controller(required: true)..awaitingActivation = true;
      (state.policy!.json['publication'] as Map)['updateRequired'] = false;
      await mount(tester, state);
      expect(find.text('Cần tải bản v2 trước chuyến đi'), findsNothing);
      expect(find.text('Gói cũ vẫn dùng được.'), findsOneWidget);
      state.dispose();
    },
  );

  testWidgets('unknown never claims current and shows server check time', (
    tester,
  ) async {
    final state = controller();
    await mount(tester, state);
    expect(
      find.text('Chưa xác nhận dữ liệu là bản cập nhật mới nhất'),
      findsOneWidget,
    );
    expect(find.textContaining('Đã cập nhật'), findsNothing);
    expect(find.textContaining('12/11/2026 07:00'), findsOneWidget);
    expect(find.text('Xác nhận thiết bị sẵn sàng'), findsNothing);
    state.dispose();
  });
  testWidgets(
    'ongoing plus newer version is informational without activation',
    (tester) async {
      final state = controller(locked: true, required: true);
      await mount(tester, state, porter: true);
      expect(find.textContaining('bản đã khóa'), findsNothing);
      expect(find.byType(OutlinedButton), findsNothing);
      state.dispose();
    },
  );
  testWidgets('downloaded pending sync does not claim activation', (
    tester,
  ) async {
    final state = controller()..awaitingActivation = true;
    await mount(tester, state);
    expect(find.text('Gói cũ vẫn dùng được.'), findsOneWidget);
    expect(find.text('Chờ đồng bộ'), findsNothing);
    expect(find.textContaining('Đã kích hoạt'), findsNothing);
    state.dispose();
  });

  testWidgets(
    'unknown publication wording is bounded by last check, not safety readiness',
    (tester) async {
      final state = controller();
      (state.policy!.json['publication'] as Map)['newerAvailable'] = false;
      await mount(tester, state);
      expect(find.textContaining('Chưa có bản mới'), findsNothing);
      expect(find.text('Phiên bản: Chưa có bản mới'), findsNothing);
      state.dispose();
    },
  );
  testWidgets(
    'content update uses exact server timestamp and readable AA secondary text',
    (tester) async {
      final state = controller();
      state.policy!.json['selected'] = {
        'packageId': state.active!.id,
        'updatedAt': '2026-11-12T03:15:00Z',
      };
      await mount(tester, state);
      final label = find.text('Cập nhật gói: 12/11/2026 10:15');
      expect(label, findsOneWidget);
      final style = tester.widget<Text>(label).style!;
      expect(style.fontSize, greaterThanOrEqualTo(14));
      final contrast =
          (Colors.white.computeLuminance() + .05) /
          (style.color!.computeLuminance() + .05);
      expect(contrast, greaterThanOrEqualTo(4.5));
      state.dispose();
    },
  );
  testWidgets(
    'optional newer version does not show a mandatory update or confirmation',
    (tester) async {
      final state = controller();
      await mount(tester, state, porter: true);
      expect(find.text('Có bản mới v2 (không bắt buộc)'), findsOneWidget);
      expect(find.textContaining('Cần dùng bản'), findsNothing);
      expect(find.text('Xác nhận thiết bị sẵn sàng'), findsNothing);
      state.dispose();
    },
  );
  testWidgets(
    'Porter confirmation requires matching active UUID; Camper never sees it',
    (tester) async {
      final state = controller(required: true);
      await mount(tester, state, porter: true);
      expect(
        tester.widget<OutlinedButton>(find.byType(OutlinedButton)).onPressed,
        isNull,
      );
      expect(find.text('Tải bản v2 trước'), findsOneWidget);
      expect(
        tester.getTopLeft(find.byType(OutlinedButton)).dy -
            tester.getBottomLeft(find.text('Tải bản v2 trước')).dy,
        greaterThanOrEqualTo(8),
      );
      (state.policy!.json['publication'] as Map)['requiredPackageId'] =
          state.active!.id;
      await mount(tester, state, porter: true);
      expect(
        tester.widget<OutlinedButton>(find.byType(OutlinedButton)).onPressed,
        isNull,
      );
      expect(find.text('Chờ xác nhận độ mới dữ liệu.'), findsOneWidget);
      (state.policy!.json['sourceFreshness'] as Map)['state'] = 'current';
      await mount(tester, state, porter: true);
      expect(
        tester.widget<OutlinedButton>(find.byType(OutlinedButton)).onPressed,
        isNotNull,
      );
      await mount(tester, state);
      expect(find.text('Xác nhận thiết bị sẵn sàng'), findsNothing);
      state.dispose();
    },
  );
  testWidgets(
    'offline status explicitly labels last known evidence and disables confirmation',
    (tester) async {
      final state = controller(required: true)..policyOffline = true;
      await mount(tester, state, porter: true);
      expect(
        find.text('Chưa xác nhận dữ liệu là bản cập nhật mới nhất'),
        findsOneWidget,
      );
      expect(find.textContaining('Máy chủ kiểm tra:'), findsOneWidget);
      expect(
        tester.widget<OutlinedButton>(find.byType(OutlinedButton)).onPressed,
        isNull,
      );
      state.dispose();
    },
  );
  testWidgets('bad package and permission failure do not offer a bypass', (
    tester,
  ) async {
    final state = controller()
      ..verification = PackageVerificationStatus.failed
      ..policy = null
      ..policyError = 'Bạn không có quyền truy cập gói này.';
    await mount(tester, state);
    expect(find.text('Gói v1: Bị lỗi, cần tải lại'), findsOneWidget);
    expect(find.text('Bạn không có quyền truy cập gói này.'), findsOneWidget);
    expect(find.textContaining('Bỏ qua'), findsNothing);
    expect(find.byType(OutlinedButton), findsNothing);
    state.dispose();
  });

  for (final phase in ['downloading', 'failed', 'pending-sync']) {
    testWidgets(
      '$phase v2 never claims no newer version even with old server evidence',
      (tester) async {
        final state = controller();
        final next = zipMetadata(packageZip(version: 2), version: 2);
        state.package = next;
        (state.policy!.json['publication'] as Map)['newerAvailable'] = false;
        state.downloading = phase == 'downloading';
        state.awaitingActivation = phase == 'pending-sync';
        state.verification = phase == 'failed'
            ? PackageVerificationStatus.failed
            : phase == 'pending-sync'
            ? PackageVerificationStatus.verified
            : PackageVerificationStatus.pending;
        state.local = LocalPackageDownload(
          next,
          phase == 'downloading'
              ? PackageDownloadStatus.downloading
              : PackageDownloadStatus.downloaded,
          phase == 'downloading' ? 10 : next.sizeBytes,
        );
        await mount(tester, state);
        if (state.awaitingActivation) {
          expect(find.text('Gói cũ vẫn dùng được.'), findsOneWidget);
          expect(find.text('Có bản mới v2 (không bắt buộc)'), findsNothing);
        } else {
          expect(find.text('Có bản mới v2 (không bắt buộc)'), findsOneWidget);
        }
        expect(find.textContaining('Chưa có bản mới'), findsNothing);
        if (phase == 'failed') {
          (state.policy!.json['publication'] as Map)['requiredPackageId'] =
              next.id;
          (state.policy!.json['publication'] as Map)['requiredVersion'] = 2;
          await mount(tester, state, porter: true);
          expect(find.text('Tải lại bản v2'), findsOneWidget);
          expect(find.text('Tải bản v2 trước'), findsNothing);
        }
        state.dispose();
      },
    );
  }

  testWidgets(
    'undownloaded v2 says not downloaded and unknown readiness is explicit',
    (tester) async {
      final state = controller(required: true);
      state.package = zipMetadata(packageZip(version: 2), version: 2);
      await mount(tester, state, porter: true);
      expect(find.text('Gói v2: Chưa tải'), findsOneWidget);
      expect(find.text('Tải bản v2 trước'), findsOneWidget);
      expect(
        tester.widget<OutlinedButton>(find.byType(OutlinedButton)).onPressed,
        isNull,
      );
      expect(find.textContaining('Máy chủ kiểm tra:'), findsOneWidget);
      expect(find.textContaining('(kiểm tra'), findsNothing);
      state.dispose();
    },
  );
}
