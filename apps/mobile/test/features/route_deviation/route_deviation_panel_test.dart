import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/gps_tracking/application/gps_location_source.dart';
import 'package:mobile/features/gps_tracking/application/gps_tracking_controller.dart';
import 'package:mobile/features/route_deviation/application/route_deviation_controller.dart';
import 'package:mobile/features/route_deviation/domain/route_deviation_models.dart';
import 'package:mobile/features/route_deviation/presentation/route_deviation_panel.dart';

import '../gps_tracking/gps_fakes.dart';
import 'route_deviation_fakes.dart';

void main() {
  late DateTime now;
  late FakeLocationSource location;
  late GpsTrackingController gps;
  late FakeRouteDeviationApi api;
  late MemoryRouteDeviationStore store;

  setUp(() {
    now = DateTime.utc(2026, 10, 31, 3);
    location = FakeLocationSource()..next = sampleOffRoute(now, 5);
    gps = GpsTrackingController(
      tripId: tripId,
      api: FakeGpsTrackingApi(),
      store: MemoryGpsLogStore(),
      location: location,
      clock: () => now,
      autoStart: false,
    );
    api = FakeRouteDeviationApi();
    store = MemoryRouteDeviationStore();
  });

  Future<RouteDeviationController> pump(WidgetTester tester, {ThemeData? theme}) async {
    final controller = RouteDeviationController(
      tripId: tripId,
      gps: gps,
      api: api,
      store: store,
      clock: () => now,
      isOnline: () async => false,
      alert: () async {},
      autoStart: false,
    );
    await tester.pumpWidget(
      ProviderScope(
        overrides: [routeDeviationControllerProvider.overrideWith((ref, id) => controller)],
        child: MaterialApp(
          theme: theme ?? AppTheme.light(),
          home: Scaffold(
            body: SingleChildScrollView(child: RouteDeviationPanel(tripId: tripId)),
          ),
        ),
      ),
    );
    await tester.runAsync(() async {
      await gps.start();
      await controller.start();
    });
    await tester.pump();
    return controller;
  }

  Future<void> walk(WidgetTester tester, RouteDeviationController controller, double meters) async {
    await tester.runAsync(() async {
      now = now.add(const Duration(seconds: 10));
      location.next = sampleOffRoute(now, meters);
      await gps.sampleNow();
      await controller.tick();
    });
    await tester.pump();
  }

  for (final (name, theme) in [('light', AppTheme.light()), ('dark', AppTheme.dark())]) {
    testWidgets('shows an on-route detection with distance in the $name theme', (tester) async {
      await pump(tester, theme: theme);

      expect(find.text('Cảnh báo lệch tuyến'), findsOneWidget);
      expect(find.text('Đúng tuyến'), findsOneWidget);
      expect(find.text('Cách tuyến khoảng 5 m'), findsOneWidget);
      expect(find.text('Mẫu hợp lệ'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
      gps.dispose();
    });
  }

  testWidgets('shows confirmation progress, then the OFF_ROUTE dialog, banner and local event', (
    tester,
  ) async {
    api.uploadError = offline();
    final controller = await pump(tester);
    await walk(tester, controller, 55);
    await walk(tester, controller, 60);
    expect(find.textContaining('Đang xác nhận lệch tuyến: 2/3'), findsOneWidget);

    await walk(tester, controller, 65);
    await tester.pump();

    expect(find.byKey(const Key('off-route-dialog')), findsOneWidget);
    expect(find.text('Có thể lệch tuyến'), findsOneWidget);
    expect(find.byKey(const Key('off-route-banner')), findsOneWidget);
    expect(find.textContaining('cách tuyến khoảng 65 m'), findsWidgets);
    expect(find.text('Chờ đồng bộ'), findsOneWidget, reason: 'never shown as server-confirmed');
    expect(find.textContaining('phát hiện khi offline'), findsOneWidget);

    await tester.tap(find.byKey(const Key('off-route-dialog-dismiss')));
    await tester.pump();
    expect(find.byKey(const Key('off-route-dialog')), findsNothing);
    expect(find.byKey(const Key('off-route-banner')), findsOneWidget, reason: 'state persists');
    await tester.pumpWidget(const SizedBox());
    gps.dispose();
  });

  testWidgets('shows the buffer zone without any transition', (tester) async {
    final controller = await pump(tester);
    await walk(tester, controller, 30);
    expect(find.textContaining('Vùng đệm 20–50 m'), findsOneWidget);
    expect(find.text('Đúng tuyến'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
    gps.dispose();
  });

  testWidgets('warns about degraded GPS without claiming off-route', (tester) async {
    store.records[tripId] = RouteDeviationRecord(
      context: routeContext(),
      quality: GpsQualityState.degraded,
    );
    location.next = sampleOffRoute(now, 5, accuracy: 30);
    await pump(tester);
    expect(find.byKey(const Key('gps-degraded-banner')), findsOneWidget);
    expect(find.byKey(const Key('off-route-banner')), findsNothing);
    expect(find.text('Mẫu không đủ chính xác'), findsOneWidget);
    expect(find.text('Chưa xác định được khoảng cách tới tuyến'), findsOneWidget);
    expect(find.textContaining('Cách tuyến khoảng'), findsNothing);
    await tester.pumpWidget(const SizedBox());
    gps.dispose();
  });

  testWidgets('labels synced and rejected events and pauses without GPS recording', (tester) async {
    location.permission = GpsPermissionState.denied;
    store.records[tripId] = RouteDeviationRecord(
      events: [
        offRouteEvent(now, id: '00000000-0000-4000-8000-000000000001')
            .delivery(syncState: SafetyEventSyncState.synced, attempts: 1),
        offRouteEvent(now, id: '00000000-0000-4000-8000-000000000002').delivery(
          syncState: SafetyEventSyncState.failed,
          rejectionReason: 'ROUTE_VERSION_MISMATCH',
          attempts: 1,
        ),
      ],
    );
    await pump(tester);

    expect(find.text('Tạm dừng'), findsOneWidget);
    expect(find.byKey(const Key('route-deviation-paused')), findsOneWidget);
    expect(find.text('Đã đồng bộ'), findsOneWidget);
    expect(find.text('Tuyến đã thay đổi'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
    gps.dispose();
  });

  testWidgets('explains why detection is unavailable without a Route context', (tester) async {
    api.contextError = offline();
    await pump(tester);
    expect(find.text('Chưa có dữ liệu tuyến'), findsWidgets);
    expect(find.byKey(const Key('route-deviation-unavailable')), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
    gps.dispose();
  });
}
