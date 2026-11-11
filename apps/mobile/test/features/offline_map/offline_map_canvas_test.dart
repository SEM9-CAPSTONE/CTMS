import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/gps_tracking/domain/gps_tracking_models.dart';
import 'package:mobile/features/offline_map/domain/offline_map_models.dart';
import 'package:mobile/features/offline_map/presentation/widgets/offline_map_canvas.dart';

void main() {
  final testRoute = OfflineRouteGeometry(
    routeId: 'route-test-1',
    points: const [
      OfflineRoutePoint(latitude: 11.5000, longitude: 108.5000),
      OfflineRoutePoint(latitude: 11.5100, longitude: 108.5100),
      OfflineRoutePoint(latitude: 11.5200, longitude: 108.5200),
    ],
  );

  final testCheckpoints = [
    const OfflineMapCheckpoint(
      id: 'cp-1',
      routeId: 'route-test-1',
      name: 'Trạm Cổng Rừng',
      type: 'START',
      latitude: 11.5000,
      longitude: 108.5000,
      radiusMeters: 25.0,
    ),
    const OfflineMapCheckpoint(
      id: 'cp-2',
      routeId: 'route-test-1',
      name: 'Đồi Cỏ Lau',
      type: 'CAMP',
      latitude: 11.5100,
      longitude: 108.5100,
      radiusMeters: 30.0,
    ),
  ];

  group('OfflineMapViewport Projection', () {
    test('centers the route bounding box precisely at the canvas center', () {
      const size = Size(400, 300);
      final viewport = OfflineMapViewport.fromRoute(
        route: testRoute,
        size: size,
      );

      // Center coordinate (11.5100, 108.5100) must project to (200, 150)
      final centerScreen = viewport.geoToScreen(11.5100, 108.5100);
      expect(centerScreen.dx, closeTo(200.0, 0.5));
      expect(centerScreen.dy, closeTo(150.0, 0.5));
    });

    test('metersToPixels scales proportionately with zoom', () {
      const size = Size(400, 300);
      final viewport = OfflineMapViewport.fromRoute(
        route: testRoute,
        size: size,
      );

      final pxAtZoom1 = viewport.metersToPixels(100.0, zoomScale: 1.0);
      final pxAtZoom2 = viewport.metersToPixels(100.0, zoomScale: 2.0);

      expect(pxAtZoom1, greaterThan(0.0));
      expect(pxAtZoom2, closeTo(pxAtZoom1 * 2.0, 0.001));
    });

    test('handles empty points gracefully', () {
      const emptyRoute = OfflineRouteGeometry(
        routeId: 'empty',
        points: [],
      );
      final viewport = OfflineMapViewport.fromRoute(
        route: emptyRoute,
        size: const Size(400, 300),
      );
      expect(viewport.baseScale, equals(1.0));
    });
  });

  group('OfflineMapCanvas Widget Tests', () {
    testWidgets('renders empty placeholder when route is null', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light(),
          home: const Scaffold(
            body: OfflineMapCanvas(route: null),
          ),
        ),
      );

      expect(find.text('Chưa có dữ liệu tuyến đường'), findsOneWidget);
      expect(find.byKey(const Key('offline-map-btn-recenter')), findsNothing);
    });

    testWidgets('renders route and controls when route is valid', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light(),
          home: Scaffold(
            body: OfflineMapCanvas(
              route: testRoute,
              checkpoints: testCheckpoints,
            ),
          ),
        ),
      );

      expect(find.byType(CustomPaint), findsWidgets);
      expect(find.byKey(const Key('offline-map-btn-zoom-in')), findsOneWidget);
      expect(find.byKey(const Key('offline-map-btn-zoom-out')), findsOneWidget);
      expect(find.byKey(const Key('offline-map-btn-fit-route')), findsOneWidget);
      expect(find.byKey(const Key('offline-map-btn-recenter')), findsOneWidget);
    });

    testWidgets('disables re-center button when no GPS fix is available', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light(),
          home: Scaffold(
            body: OfflineMapCanvas(
              route: testRoute,
              checkpoints: testCheckpoints,
              location: const OfflineMapLocationState(
                status: OfflineMapGpsStatus.permissionDenied,
                sample: null,
              ),
            ),
          ),
        ),
      );

      final recenterFinder = find.byKey(const Key('offline-map-btn-recenter'));
      expect(recenterFinder, findsOneWidget);

      // Verify inkwell on recenter has null onTap
      final inkWell = tester.widget<InkWell>(
        find.descendant(of: recenterFinder, matching: find.byType(InkWell)),
      );
      expect(inkWell.onTap, isNull);
    });

    testWidgets('renders good GPS accuracy badge (<= 20m) and enables re-center', (tester) async {
      final now = DateTime.utc(2026, 11, 9, 12, 0, 0);
      final sample = GpsSample(
        latitude: 11.5120,
        longitude: 108.5120,
        accuracyMeters: 8.5,
        capturedAt: now.subtract(const Duration(seconds: 4)),
      );

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light(),
          home: Scaffold(
            body: OfflineMapCanvas(
              route: testRoute,
              checkpoints: testCheckpoints,
              location: OfflineMapLocationState(
                status: OfflineMapGpsStatus.ready,
                sample: sample,
              ),
              clock: () => now,
            ),
          ),
        ),
      );

      expect(find.text('GPS ±8.5 m (Tốt)'), findsOneWidget);

      final recenterFinder = find.byKey(const Key('offline-map-btn-recenter'));
      final inkWell = tester.widget<InkWell>(
        find.descendant(of: recenterFinder, matching: find.byType(InkWell)),
      );
      expect(inkWell.onTap, isNotNull);

      // Tap re-center does not throw
      await tester.tap(recenterFinder);
      await tester.pump();
      expect(tester.takeException(), isNull);
    });

    testWidgets('renders poor GPS accuracy badge (> 20m)', (tester) async {
      final now = DateTime.utc(2026, 11, 9, 12, 0, 0);
      final sample = GpsSample(
        latitude: 11.5120,
        longitude: 108.5120,
        accuracyMeters: 45.0,
        capturedAt: now.subtract(const Duration(seconds: 5)),
      );

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light(),
          home: Scaffold(
            body: OfflineMapCanvas(
              route: testRoute,
              checkpoints: testCheckpoints,
              location: OfflineMapLocationState(
                status: OfflineMapGpsStatus.ready,
                sample: sample,
              ),
              clock: () => now,
            ),
          ),
        ),
      );

      expect(find.text('GPS ±45.0 m (Sai số > 20m)'), findsOneWidget);
    });

    testWidgets('renders stale GPS badge when sample is older than 30s', (tester) async {
      final now = DateTime.utc(2026, 11, 9, 12, 0, 0);
      final sample = GpsSample(
        latitude: 11.5120,
        longitude: 108.5120,
        accuracyMeters: 10.0,
        capturedAt: now.subtract(const Duration(seconds: 45)),
      );

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light(),
          home: Scaffold(
            body: OfflineMapCanvas(
              route: testRoute,
              checkpoints: testCheckpoints,
              location: OfflineMapLocationState(
                status: OfflineMapGpsStatus.ready,
                sample: sample,
              ),
              clock: () => now,
            ),
          ),
        ),
      );

      expect(find.text('Mẫu cũ (>30s) · ±10.0 m'), findsOneWidget);
    });

    testWidgets('zoom in button increases zoom scale', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light(),
          home: Scaffold(
            body: OfflineMapCanvas(
              route: testRoute,
              checkpoints: testCheckpoints,
            ),
          ),
        ),
      );

      final state = tester.state<OfflineMapCanvasState>(find.byType(OfflineMapCanvas));
      final initialZoom = state.zoomScale;

      await tester.tap(find.byKey(const Key('offline-map-btn-zoom-in')));
      await tester.pump();

      expect(state.zoomScale, greaterThan(initialZoom));
    });

    testWidgets('zoom out button decreases zoom scale', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light(),
          home: Scaffold(
            body: OfflineMapCanvas(
              route: testRoute,
              checkpoints: testCheckpoints,
            ),
          ),
        ),
      );

      final state = tester.state<OfflineMapCanvasState>(find.byType(OfflineMapCanvas));
      // First zoom in so we have room to zoom out
      await tester.tap(find.byKey(const Key('offline-map-btn-zoom-in')));
      await tester.pump();
      final zoomedIn = state.zoomScale;

      await tester.tap(find.byKey(const Key('offline-map-btn-zoom-out')));
      await tester.pump();

      expect(state.zoomScale, lessThan(zoomedIn));
    });

    testWidgets('fit route button resets zoom to 1.0 and pan to zero', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light(),
          home: Scaffold(
            body: OfflineMapCanvas(
              route: testRoute,
              checkpoints: testCheckpoints,
            ),
          ),
        ),
      );

      final state = tester.state<OfflineMapCanvasState>(find.byType(OfflineMapCanvas));

      // Pan drag and zoom in
      await tester.drag(
        find.byKey(const Key('offline-map-gesture-area')),
        const Offset(60, -40),
        warnIfMissed: false,
      );
      await tester.tap(find.byKey(const Key('offline-map-btn-zoom-in')));
      await tester.pump(const Duration(milliseconds: 300));

      expect(state.panOffset, isNot(equals(Offset.zero)));
      expect(state.zoomScale, greaterThan(1.0));

      // Fit route
      await tester.tap(find.byKey(const Key('offline-map-btn-fit-route')));
      await tester.pump(const Duration(milliseconds: 300));

      expect(state.zoomScale, equals(1.0));
      expect(state.panOffset, equals(Offset.zero));
      expect(state.autoFollowGps, isFalse);
    });

    testWidgets('pan gesture updates pan offset and disables auto follow', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light(),
          home: Scaffold(
            body: OfflineMapCanvas(
              route: testRoute,
              checkpoints: testCheckpoints,
            ),
          ),
        ),
      );

      final state = tester.state<OfflineMapCanvasState>(find.byType(OfflineMapCanvas));
      expect(state.autoFollowGps, isTrue);

      await tester.drag(
        find.byKey(const Key('offline-map-gesture-area')),
        const Offset(50, -40),
        warnIfMissed: false,
      );
      await tester.pump(const Duration(milliseconds: 300));

      expect(state.panOffset.dx, greaterThan(0.0));
      expect(state.panOffset.dy, lessThan(0.0));
      expect(state.autoFollowGps, isFalse);
    });

    testWidgets('double tap zooms in smoothly', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light(),
          home: Scaffold(
            body: OfflineMapCanvas(
              route: testRoute,
              checkpoints: testCheckpoints,
            ),
          ),
        ),
      );

      final state = tester.state<OfflineMapCanvasState>(find.byType(OfflineMapCanvas));
      final initialZoom = state.zoomScale;

      await tester.tap(find.byKey(const Key('offline-map-gesture-area')));
      await tester.pump(const Duration(milliseconds: 50));
      await tester.tap(find.byKey(const Key('offline-map-gesture-area')));
      await tester.pump(const Duration(milliseconds: 100));

      expect(state.zoomScale, greaterThan(initialZoom));
    });

    testWidgets('mouse scroll wheel zooms in and out', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light(),
          home: Scaffold(
            body: OfflineMapCanvas(
              route: testRoute,
              checkpoints: testCheckpoints,
            ),
          ),
        ),
      );

      final state = tester.state<OfflineMapCanvasState>(find.byType(OfflineMapCanvas));
      final initialZoom = state.zoomScale;

      // Scroll up (negative dy) -> Zoom in
      final gestureArea = tester.getCenter(find.byKey(const Key('offline-map-gesture-area')));
      final pointer = TestPointer(1, PointerDeviceKind.mouse);
      pointer.hover(gestureArea);
      await tester.sendEventToBinding(
        pointer.scroll(const Offset(0, -100)),
      );
      await tester.pump();

      expect(state.zoomScale, greaterThan(initialZoom));

      // Scroll down (positive dy) -> Zoom out
      final zoomedIn = state.zoomScale;
      await tester.sendEventToBinding(
        pointer.scroll(const Offset(0, 100)),
      );
      await tester.pump();

      expect(state.zoomScale, lessThan(zoomedIn));
    });

    testWidgets('HUD chip does not overflow on 360dp width with 1.3x text scale', (tester) async {
      final now = DateTime.utc(2026, 11, 9, 12, 0, 0);
      final sample = GpsSample(
        latitude: 11.5000,
        longitude: 108.5000,
        accuracyMeters: 10.0,
        capturedAt: now,
      );

      final longNameCheckpoints = [
        const OfflineMapCheckpoint(
          id: 'cp-long-1',
          routeId: 'route-test-1',
          name: 'Trạm Xuất Phát Cổng Rừng Nguyên Sinh Rất Dài (độ cao ↑260 m)',
          type: 'START',
          latitude: 11.5000,
          longitude: 108.5000,
          radiusMeters: 50.0,
        ),
        const OfflineMapCheckpoint(
          id: 'cp-long-2',
          routeId: 'route-test-1',
          name: 'Điểm Dừng Nghỉ Chân Cắm Trại Suối Voi Rực Rỡ (độ cao ↑420 m)',
          type: 'CAMP',
          latitude: 11.5100,
          longitude: 108.5100,
          radiusMeters: 50.0,
        ),
      ];

      // Set screen size to 360x640 dp
      tester.view.physicalSize = const Size(360, 640);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light(),
          home: MediaQuery(
            data: const MediaQueryData(
              textScaler: TextScaler.linear(1.3),
              size: Size(360, 640),
            ),
            child: Scaffold(
              body: OfflineMapCanvas(
                route: testRoute,
                checkpoints: longNameCheckpoints,
                location: OfflineMapLocationState(
                  status: OfflineMapGpsStatus.ready,
                  sample: sample,
                ),
                clock: () => now,
              ),
            ),
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      // Crucial assertion: no RenderFlex overflow exception
      expect(tester.takeException(), isNull);
      // Both title and distance are rendered
      expect(find.byType(RichText), findsWidgets);
    });

    testWidgets('fitUserAndNextCheckpoint frames both user and distant checkpoint within screen bounds', (tester) async {
      final now = DateTime.utc(2026, 11, 9, 12, 0, 0);
      final sample = GpsSample(
        latitude: 11.5000,
        longitude: 108.5000,
        accuracyMeters: 10.0,
        capturedAt: now,
      );

      tester.view.physicalSize = const Size(360, 640);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light(),
          home: Scaffold(
            body: OfflineMapCanvas(
              height: 280.0,
              route: testRoute,
              checkpoints: testCheckpoints,
              location: OfflineMapLocationState(
                status: OfflineMapGpsStatus.ready,
                sample: sample,
              ),
              clock: () => now,
            ),
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      final state = tester.state<OfflineMapCanvasState>(find.byType(OfflineMapCanvas));
      const canvasSize = Size(360, 280);

      final viewport = OfflineMapViewport.fromRoute(
        route: testRoute,
        size: canvasSize,
      );

      // Verify user position projection on screen is within safe margins
      final userScreenPos = viewport.geoToScreen(
        sample.latitude,
        sample.longitude,
        panOffset: state.panOffset,
        zoomScale: state.zoomScale,
      );
      expect(userScreenPos.dx, greaterThanOrEqualTo(50.0));
      expect(userScreenPos.dx, lessThanOrEqualTo(canvasSize.width - 50.0));
      expect(userScreenPos.dy, greaterThanOrEqualTo(45.0));
      expect(userScreenPos.dy, lessThanOrEqualTo(canvasSize.height - 45.0));

      // Verify next checkpoint projection on screen is also within safe margins
      final nextCp = testCheckpoints[1];
      final cpScreenPos = viewport.geoToScreen(
        nextCp.latitude,
        nextCp.longitude,
        panOffset: state.panOffset,
        zoomScale: state.zoomScale,
      );
      expect(cpScreenPos.dx, greaterThanOrEqualTo(50.0));
      expect(cpScreenPos.dx, lessThanOrEqualTo(canvasSize.width - 50.0));
      expect(cpScreenPos.dy, greaterThanOrEqualTo(45.0));
      expect(cpScreenPos.dy, lessThanOrEqualTo(canvasSize.height - 45.0));
    });

    testWidgets('semantics contains accessible summary of map and GPS', (tester) async {
      final now = DateTime.utc(2026, 11, 9, 12, 0, 0);
      final sample = GpsSample(
        latitude: 11.5120,
        longitude: 108.5120,
        accuracyMeters: 12.0,
        capturedAt: now.subtract(const Duration(seconds: 5)),
      );

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light(),
          home: Scaffold(
            body: OfflineMapCanvas(
              route: testRoute,
              checkpoints: testCheckpoints,
              location: OfflineMapLocationState(
                status: OfflineMapGpsStatus.ready,
                sample: sample,
              ),
              clock: () => now,
            ),
          ),
        ),
      );

      final semanticsFinder = find.byWidgetPredicate(
        (widget) =>
            widget is Semantics &&
            widget.properties.label != null &&
            widget.properties.label!.contains('Bản đồ ngoại tuyến') &&
            widget.properties.label!.contains('3 điểm tọa độ') &&
            widget.properties.label!.contains('sai số 12.0 mét'),
      );
      expect(semanticsFinder, findsOneWidget);
    });
  });
}
