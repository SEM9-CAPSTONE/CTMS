import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/gps_tracking/application/gps_location_source.dart';
import 'package:mobile/features/gps_tracking/application/gps_tracking_controller.dart';
import 'package:mobile/features/gps_tracking/domain/gps_tracking_models.dart';
import 'package:mobile/features/gps_tracking/presentation/gps_tracking_panel.dart';

import 'gps_fakes.dart';

void main() {
  final now = DateTime.utc(2026, 10, 25, 1, 1, 0);

  Future<GpsTrackingController> pump(
    WidgetTester tester, {
    required FakeGpsTrackingApi api,
    required FakeLocationSource location,
    MemoryGpsLogStore? store,
    ThemeData? theme,
  }) async {
    final controller = GpsTrackingController(
      tripId: tripId,
      api: api,
      store: store ?? MemoryGpsLogStore(),
      location: location,
      clock: () => now,
      autoStart: false,
    );
    await tester.pumpWidget(
      ProviderScope(
        overrides: [gpsTrackingControllerProvider.overrideWith((ref, id) => controller)],
        child: MaterialApp(
          theme: theme ?? AppTheme.light(),
          home: Scaffold(
            body: SingleChildScrollView(
              child: GpsTrackingPanel(tripId: tripId, now: () => now),
            ),
          ),
        ),
      ),
    );
    await tester.runAsync(controller.start);
    await tester.pump();
    return controller;
  }

  for (final (name, theme) in [('light', AppTheme.light()), ('dark', AppTheme.dark())]) {
    testWidgets('shows an active recording with a fresh sample in the $name theme', (tester) async {
      final location = FakeLocationSource()..next = sampleAt(now.subtract(const Duration(seconds: 5)));
      await pump(tester, api: FakeGpsTrackingApi(), location: location, theme: theme);

      expect(find.text('Ghi GPS hành trình'), findsOneWidget);
      expect(find.text('Đang ghi'), findsOneWidget);
      expect(find.text('Mới'), findsOneWidget);
      expect(find.textContaining('11.50000, 108.40000 · ±8 m'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    });
  }

  testWidgets('marks an old sample as stale instead of current', (tester) async {
    final location = FakeLocationSource()..next = sampleAt(now.subtract(const Duration(seconds: 45)));
    await pump(tester, api: FakeGpsTrackingApi(), location: location);

    expect(find.text('Tín hiệu cũ 45s'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('explains why GPS is not recorded when the participant is not eligible', (tester) async {
    final api = FakeGpsTrackingApi()
      ..contextResult = () => trackingContext(eligible: false, reason: 'CAMPER_NOT_JOINED');
    await pump(tester, api: api, location: FakeLocationSource());

    expect(find.text('Không ghi'), findsOneWidget);
    expect(find.text('Bạn chưa check-in tham gia chuyến đi.'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('asks for location permission and starts recording once granted', (tester) async {
    final location = FakeLocationSource()
      ..permission = GpsPermissionState.denied
      ..afterRequest = GpsPermissionState.granted
      ..next = sampleAt(now);
    await pump(tester, api: FakeGpsTrackingApi(), location: location);

    expect(find.text('Chưa cấp quyền'), findsOneWidget);
    await tester.tap(find.byKey(const Key('gps-request-permission')));
    await tester.runAsync(() => Future<void>.delayed(Duration.zero));
    await tester.pump();

    expect(location.requestCalls, 1);
    expect(find.text('Đang ghi'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('lists buffered logs with their sync state and counts', (tester) async {
    final store = MemoryGpsLogStore();
    final pending = LocalGpsLog.fromSample(
      id: newGpsLogId(),
      tripId: tripId,
      sample: sampleAt(now.subtract(const Duration(minutes: 1))),
      configVersion: 'v3',
    );
    final rejected = LocalGpsLog.fromSample(
      id: newGpsLogId(),
      tripId: tripId,
      sample: sampleAt(now.subtract(const Duration(minutes: 2))),
      configVersion: 'v3',
    ).delivery(syncState: GpsLogSyncState.failed, rejectionReason: 'EVENT_TIME_OUTSIDE_PARTICIPATION');
    store.logs[tripId] = [rejected, pending];
    final api = FakeGpsTrackingApi()
      ..contextResult = () => trackingContext(eligible: false, reason: 'TRIP_NOT_ONGOING');
    await pump(tester, api: api, location: FakeLocationSource(), store: store);

    expect(find.text('Bản ghi GPS (2)'), findsOneWidget);
    expect(find.text('Chờ đồng bộ'), findsNWidgets(2), reason: 'count tile and log badge');
    expect(find.text('Ngoài thời gian tham gia'), findsOneWidget);
    expect(find.byKey(Key('gps-log-${pending.id}')), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });
}
