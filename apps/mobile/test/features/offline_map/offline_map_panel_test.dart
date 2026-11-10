import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/gps_tracking/application/gps_location_source.dart';
import 'package:mobile/features/gps_tracking/domain/gps_tracking_models.dart';
import 'package:mobile/features/offline_map/application/offline_map_controller.dart';
import 'package:mobile/features/offline_map/data/offline_map_package_reader.dart';
import 'package:mobile/features/offline_map/domain/offline_map_models.dart';
import 'package:mobile/features/offline_map/presentation/offline_map_panel.dart';
import 'package:mobile/features/offline_map/presentation/offline_map_screen.dart';

const kTestTripId = 'test-trip-uuid-1234';

class MockOfflineMapPackageReader implements OfflineMapPackageReader {
  OfflineMapContext? contextToReturn;
  Exception? exceptionToThrow;
  Future<OfflineMapContext?> Function()? asyncReadCallback;
  int readCount = 0;

  @override
  Future<OfflineMapContext?> readActivePackage(String tripId) async {
    readCount++;
    if (asyncReadCallback != null) {
      return asyncReadCallback!();
    }
    if (exceptionToThrow != null) {
      throw exceptionToThrow!;
    }
    return contextToReturn;
  }
}

class MockGpsLocationSource implements GpsLocationSource {
  GpsPermissionState permission = GpsPermissionState.granted;
  GpsSample? sampleToReturn;
  int sampleCallCount = 0;

  @override
  Future<GpsPermissionState> checkPermission() async => permission;

  @override
  Future<GpsPermissionState> requestPermission() async => permission;

  @override
  Future<GpsSample> currentSample({required Duration timeLimit}) async {
    sampleCallCount++;
    if (sampleToReturn != null) {
      return sampleToReturn!;
    }
    throw TimeoutException('No fix');
  }
}

OfflineMapContext createTestContext({int version = 2}) {
  return OfflineMapContext(
    tripId: kTestTripId,
    packageVersion: version,
    packageId: 'pkg-v$version',
    route: const OfflineRouteGeometry(
      routeId: 'route-test-1',
      points: [
        OfflineRoutePoint(latitude: 11.5000, longitude: 108.5000),
        OfflineRoutePoint(latitude: 11.5100, longitude: 108.5100),
        OfflineRoutePoint(latitude: 11.5200, longitude: 108.5200),
      ],
    ),
    checkpoints: const [
      OfflineMapCheckpoint(
        id: 'cp-1',
        routeId: 'route-test-1',
        name: 'Trạm Cổng Bắc',
        type: 'START',
        latitude: 11.5000,
        longitude: 108.5000,
        radiusMeters: 20.0,
      ),
      OfflineMapCheckpoint(
        id: 'cp-2',
        routeId: 'route-test-1',
        name: 'Suối Mơ',
        type: 'WATER_SOURCE',
        latitude: 11.5150,
        longitude: 108.5150,
        radiusMeters: 25.0,
      ),
    ],
  );
}

void main() {
  late DateTime now;
  late MockOfflineMapPackageReader reader;
  late MockGpsLocationSource locationSource;

  setUp(() {
    now = DateTime.utc(2026, 11, 9, 14, 0, 0);
    reader = MockOfflineMapPackageReader();
    locationSource = MockGpsLocationSource();
  });

  Future<OfflineMapController> pumpPanel(
    WidgetTester tester, {
    OfflineMapContext? contextData,
    Exception? readerException,
    GpsSample? gpsSample,
    GpsPermissionState permission = GpsPermissionState.granted,
  }) async {
    reader.contextToReturn = contextData;
    reader.exceptionToThrow = readerException;
    locationSource.permission = permission;
    locationSource.sampleToReturn = gpsSample;

    final controller = OfflineMapController(
      tripId: kTestTripId,
      packageReader: reader,
      locationSource: locationSource,
      clock: () => now,
      autoStart: false,
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          offlineMapControllerProvider(kTestTripId).overrideWith((ref) => controller),
        ],
        child: MaterialApp(
          theme: AppTheme.light(),
          home: Scaffold(
            body: SingleChildScrollView(
              child: OfflineMapPanel(
                tripId: kTestTripId,
                clock: () => now,
              ),
            ),
          ),
        ),
      ),
    );

    await tester.runAsync(() async {
      await controller.start();
    });
    await tester.pump();

    return controller;
  }

  group('OfflineMapPanel Package States', () {
    testWidgets('shows loading indicator and status badge when package is loading', (tester) async {
      final completer = Completer<OfflineMapContext?>();
      reader.asyncReadCallback = () => completer.future;

      final controller = OfflineMapController(
        tripId: kTestTripId,
        packageReader: reader,
        locationSource: locationSource,
        clock: () => now,
        autoStart: false,
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            offlineMapControllerProvider(kTestTripId).overrideWith((ref) => controller),
          ],
          child: MaterialApp(
            theme: AppTheme.light(),
            home: Scaffold(
              body: SingleChildScrollView(
                child: OfflineMapPanel(tripId: kTestTripId, clock: () => now),
              ),
            ),
          ),
        ),
      );

      // Trigger reloadPackage without completing the reader future
      unawaited(controller.reloadPackage());
      await tester.pump();

      expect(find.text('Đang tải dữ liệu bản đồ ngoại tuyến…'), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsOneWidget);

      // Clean up future
      completer.complete(null);
      await tester.pump();
    });

    testWidgets('shows warning banner when package is missing', (tester) async {
      await pumpPanel(tester, contextData: null);

      expect(find.text('Chưa có gói dữ liệu ngoại tuyến'), findsOneWidget);
      expect(find.text('Kiểm tra lại'), findsOneWidget);
      expect(find.byKey(const Key('offline-map-open-fullscreen')), findsNothing);

      // Tap 'Kiểm tra lại'
      await tester.tap(find.text('Kiểm tra lại'));
      await tester.pump();
      expect(reader.readCount, greaterThan(1));
    });

    testWidgets('shows danger banner when package is invalid', (tester) async {
      await pumpPanel(
        tester,
        readerException: const OfflineMapPackageInvalidException('Tập tin route.geojson bị hỏng'),
      );

      expect(find.text('Gói dữ liệu không hợp lệ'), findsOneWidget);
      expect(find.textContaining('Tập tin route.geojson bị hỏng'), findsOneWidget);
      expect(find.text('Thử lại'), findsOneWidget);
    });

    testWidgets('unexpected reader failure exits loading and shows an invalid-package error', (tester) async {
      final controller = await pumpPanel(
        tester,
        readerException: Exception('Unexpected reader failure'),
      );

      expect(controller.state.packageStatus, OfflineMapPackageStatus.packageInvalid);
      expect(controller.state.hasUsableMap, isFalse);
      expect(find.byType(CircularProgressIndicator), findsNothing);
      expect(find.text('Gói dữ liệu không hợp lệ'), findsOneWidget);
      expect(find.textContaining('Unexpected reader failure'), findsOneWidget);
    });

    testWidgets('shows access denied banner when access is revoked', (tester) async {
      await pumpPanel(
        tester,
        readerException: const OfflineMapAccessDeniedException('Chuyến đi không thuộc về người dùng'),
      );

      expect(find.text('Không có quyền truy cập'), findsOneWidget);
      expect(find.textContaining('Chuyến đi không thuộc về người dùng'), findsOneWidget);
    });
  });

  group('OfflineMapPanel Ready & GPS States', () {
    testWidgets('ready map fits a 360-pixel phone width without overflow', (tester) async {
      tester.view.physicalSize = const Size(360, 800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await pumpPanel(
        tester,
        contextData: createTestContext(),
        gpsSample: GpsSample(
          latitude: 11.5005,
          longitude: 108.5005,
          accuracyMeters: 6,
          capturedAt: now,
        ),
      );
      expect(tester.takeException(), isNull);
    });

    testWidgets('ready without GPS fix renders map, checkpoints with "Chưa có GPS", and GPS banner', (
      tester,
    ) async {
      final testContext = createTestContext(version: 3);
      await pumpPanel(
        tester,
        contextData: testContext,
        permission: GpsPermissionState.denied,
      );

      expect(find.text('Gói v3'), findsOneWidget);
      expect(find.text('Chưa cấp quyền vị trí'), findsOneWidget);
      expect(find.text('Trạm Cổng Bắc'), findsOneWidget);
      expect(find.text('Suối Mơ'), findsOneWidget);
      expect(find.text('Chưa có GPS'), findsNWidgets(2));
      expect(find.byKey(const Key('offline-map-open-fullscreen')), findsOneWidget);
    });

    testWidgets('ready with good GPS fix displays distances and allows opening full-screen screen', (
      tester,
    ) async {
      final testContext = createTestContext(version: 2);
      final sample = GpsSample(
        latitude: 11.5005,
        longitude: 108.5005,
        accuracyMeters: 6.0,
        capturedAt: now.subtract(const Duration(seconds: 5)),
      );

      await pumpPanel(
        tester,
        contextData: testContext,
        gpsSample: sample,
      );

      expect(find.text('Gói v2'), findsOneWidget);
      expect(find.textContaining('Cách ~'), findsWidgets);
      expect(find.text('GPS ±6.0 m (Tốt)'), findsOneWidget);

      // Tap open fullscreen
      await tester.tap(find.byKey(const Key('offline-map-open-fullscreen')));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      expect(find.byType(OfflineMapScreen), findsOneWidget);
    });

    testWidgets('shows warning banner with request permission action when GPS permission is denied (normal)', (tester) async {
      final testContext = createTestContext(version: 1);
      await pumpPanel(
        tester,
        contextData: testContext,
        permission: GpsPermissionState.denied,
      );

      expect(find.text('Chưa cấp quyền vị trí'), findsOneWidget);
      expect(find.text('Cấp quyền'), findsOneWidget);
      expect(find.textContaining('Ứng dụng cần quyền vị trí'), findsOneWidget);

      // Now grant permission and tap 'Cấp quyền'
      locationSource.permission = GpsPermissionState.granted;
      locationSource.sampleToReturn = GpsSample(
        latitude: 11.5005,
        longitude: 108.5005,
        accuracyMeters: 5.0,
        capturedAt: now,
      );

      await tester.tap(find.text('Cấp quyền'));
      await tester.pump();
      await tester.pump();

      expect(find.text('Chưa cấp quyền vị trí'), findsNothing);
      expect(find.text('GPS ±5.0 m (Tốt)'), findsOneWidget);
    });

    testWidgets('shows danger banner when GPS permission is permanently denied', (tester) async {
      final testContext = createTestContext(version: 1);
      await pumpPanel(
        tester,
        contextData: testContext,
        permission: GpsPermissionState.deniedForever,
      );

      expect(find.text('Quyền vị trí bị chặn'), findsOneWidget);
      expect(find.textContaining('từ chối vĩnh viễn'), findsOneWidget);
    });

    testWidgets('shows warning banner when GPS location service is disabled', (tester) async {
      final testContext = createTestContext(version: 1);
      await pumpPanel(
        tester,
        contextData: testContext,
        permission: GpsPermissionState.serviceDisabled,
      );

      expect(find.text('Dịch vụ GPS đang tắt'), findsOneWidget);
      expect(find.textContaining('bật tính năng định vị'), findsOneWidget);
    });

    testWidgets('shows info banner when GPS fix is unavailable / searching', (tester) async {
      final testContext = createTestContext(version: 1);
      // locationSource returns granted but currentSample throws TimeoutException -> status becomes unavailable
      await pumpPanel(
        tester,
        contextData: testContext,
        permission: GpsPermissionState.granted,
        gpsSample: null,
      );

      expect(find.text('Đang tìm tín hiệu GPS…'), findsOneWidget);
      expect(find.textContaining('thông thoáng ngoài trời'), findsOneWidget);
    });

    testWidgets('updates dynamically in real-time when new GPS fix arrives', (tester) async {
      final testContext = createTestContext(version: 1);
      final controller = await pumpPanel(
        tester,
        contextData: testContext,
        permission: GpsPermissionState.granted,
        gpsSample: null,
      );

      expect(find.text('Đang tìm tín hiệu GPS…'), findsOneWidget);
      expect(find.textContaining('GPS ±'), findsNothing);

      // Now sample arrives
      locationSource.sampleToReturn = GpsSample(
        latitude: 11.5005,
        longitude: 108.5005,
        accuracyMeters: 6.0,
        capturedAt: now,
      );

      await tester.runAsync(() async {
        await controller.refreshLocation(force: true);
      });
      await tester.pump();

      expect(find.text('Đang tìm tín hiệu GPS…'), findsNothing);
      expect(find.text('GPS ±6.0 m (Tốt)'), findsOneWidget);
    });

    testWidgets('autoStart: true in constructor automatically calls start without widget call', (tester) async {
      reader.contextToReturn = createTestContext(version: 1);
      locationSource.permission = GpsPermissionState.granted;

      final controller = OfflineMapController(
        tripId: kTestTripId,
        packageReader: reader,
        locationSource: locationSource,
        clock: () => now,
        autoStart: true,
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            offlineMapControllerProvider(kTestTripId).overrideWith((ref) => controller),
          ],
          child: MaterialApp(
            theme: AppTheme.light(),
            home: Scaffold(
              body: SingleChildScrollView(
                child: OfflineMapPanel(tripId: kTestTripId, clock: () => now),
              ),
            ),
          ),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(reader.readCount, greaterThanOrEqualTo(1));
    });

    testWidgets('panel resumes with screen mounted and controller debounce blocks a second resume within 2 seconds', (tester) async {
      final testContext = createTestContext(version: 1);
      reader.contextToReturn = testContext;
      locationSource.permission = GpsPermissionState.granted;
      locationSource.sampleToReturn = GpsSample(
        latitude: 11.5000,
        longitude: 108.5000,
        accuracyMeters: 5.0,
        capturedAt: now,
      );

      final controller = OfflineMapController(
        tripId: kTestTripId,
        packageReader: reader,
        locationSource: locationSource,
        clock: () => now,
        autoStart: false,
      );

      await tester.runAsync(() async {
        await controller.start();
      });

      expect(reader.readCount, 1);
      expect(locationSource.sampleCallCount, 1);

      // Mount both panel and screen in the same tree (e.g. Navigation stack)
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            offlineMapControllerProvider(kTestTripId).overrideWith((ref) => controller),
          ],
          child: MaterialApp(
            theme: AppTheme.light(),
            home: Scaffold(
              body: SingleChildScrollView(
                child: Column(
                  children: [
                    OfflineMapPanel(tripId: kTestTripId, clock: () => now),
                    SizedBox(
                      height: 400,
                      child: OfflineMapScreen(tripId: kTestTripId, clock: () => now),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pump();

      // Advance clock past the initial read debounce threshold
      now = now.add(const Duration(seconds: 5));

      // Trigger app resumed lifecycle event
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.byType(OfflineMapPanel), findsOneWidget);
      expect(find.byType(OfflineMapScreen), findsOneWidget);
      // The panel owns the lifecycle observer; the screen shares its controller.
      // reloadPackage ran only 1 additional time!
      expect(reader.readCount, 2);
      // refreshLocation ran only 1 additional time (no duplicate GPS stream)!
      expect(locationSource.sampleCallCount, 2);

      // Rapid subsequent resume within 2s debounce window (500ms later):
      now = now.add(const Duration(milliseconds: 500));
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      // Debounce blocks the duplicate calls: counts remain strictly at 2!
      expect(reader.readCount, 2);
      expect(locationSource.sampleCallCount, 2);
    });

    testWidgets('lifecycle resume triggers reloadPackage and refreshLocation without throw', (
      tester,
    ) async {
      final testContext = createTestContext(version: 1);
      await pumpPanel(
        tester,
        contextData: testContext,
      );

      final initialReadCount = reader.readCount;

      // Advance clock by 3 seconds so throttle allows resume
      now = now.add(const Duration(seconds: 3));

      // Simulate AppLifecycleState.resumed
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));

      expect(reader.readCount, greaterThan(initialReadCount));
    });
  });
}
