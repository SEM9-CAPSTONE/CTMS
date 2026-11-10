import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/gps_tracking/application/gps_location_source.dart';
import 'package:mobile/features/gps_tracking/domain/gps_tracking_models.dart';
import 'package:mobile/features/offline_map/application/offline_map_controller.dart';
import 'package:mobile/features/offline_map/domain/offline_map_models.dart';
import 'package:mobile/features/offline_map/presentation/offline_map_screen.dart';
import 'package:mobile/features/offline_map/presentation/widgets/offline_map_canvas.dart';
import 'package:mobile/features/offline_map/presentation/widgets/offline_map_checkpoint_list.dart';

import 'offline_map_panel_test.dart';

void main() {
  late DateTime now;
  late MockOfflineMapPackageReader reader;
  late MockGpsLocationSource locationSource;

  setUp(() {
    now = DateTime.utc(2026, 11, 9, 14, 0, 0);
    reader = MockOfflineMapPackageReader();
    locationSource = MockGpsLocationSource();
  });

  Future<OfflineMapController> pumpScreen(
    WidgetTester tester, {
    OfflineMapContext? contextData,
    GpsSample? gpsSample,
    GpsPermissionState permission = GpsPermissionState.granted,
  }) async {
    reader.contextToReturn = contextData;
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
          home: OfflineMapScreen(
            tripId: kTestTripId,
            clock: () => now,
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

  group('OfflineMapScreen Widget Tests', () {
    testWidgets('shows warning banner and disables interactive elements when package is missing', (
      tester,
    ) async {
      await pumpScreen(tester, contextData: null);

      expect(find.text('Chưa có dữ liệu bản đồ ngoại tuyến'), findsOneWidget);
      expect(find.text('Chưa có dữ liệu tuyến đường'), findsOneWidget);
      expect(find.byType(OfflineMapCheckpointList), findsNothing);
    });

    testWidgets('shows route, GPS notice, and checkpoints when ready without GPS', (tester) async {
      final testContext = createTestContext(version: 4);
      await pumpScreen(
        tester,
        contextData: testContext,
        permission: GpsPermissionState.denied,
      );

      expect(find.text('Bản đồ ngoại tuyến'), findsWidgets);
      expect(find.text('Gói bản đồ v4 · 2 trạm kiểm tra'), findsOneWidget);
      expect(find.text('Chưa cấp quyền vị trí'), findsOneWidget);
      expect(find.byType(OfflineMapCanvas), findsOneWidget);
      expect(find.byType(OfflineMapCheckpointList), findsOneWidget);
      expect(find.text('Trạm Cổng Bắc'), findsOneWidget);
      expect(find.text('Suối Mơ'), findsOneWidget);
    });

    testWidgets('shows live GPS position and accuracy badge in full-screen view', (tester) async {
      final testContext = createTestContext(version: 4);
      final sample = GpsSample(
        latitude: 11.5008,
        longitude: 108.5008,
        accuracyMeters: 5.5,
        capturedAt: now.subtract(const Duration(seconds: 4)),
      );

      await pumpScreen(
        tester,
        contextData: testContext,
        gpsSample: sample,
      );

      expect(find.text('GPS ±5.5 m (Tốt)'), findsOneWidget);
      expect(find.textContaining('Cách ~'), findsWidgets);
    });
  });
}

