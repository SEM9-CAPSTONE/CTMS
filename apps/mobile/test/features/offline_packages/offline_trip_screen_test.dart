import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/offline_packages/application/offline_trip_providers.dart';
import 'package:mobile/features/offline_packages/application/package_download_controller.dart';
import 'package:mobile/features/offline_packages/domain/offline_trip.dart';
import 'package:mobile/features/offline_packages/presentation/offline_trip_screen.dart';
import 'package:mobile/features/offline_map/domain/offline_map_models.dart';
import 'package:mobile/features/offline_map/presentation/widgets/offline_map_canvas.dart';

void main() {
  const selection = (accountId: 'account', tripId: 'trip', version: 1);
  const checkpoint = OfflineCheckpoint(
    name: 'Điểm nghỉ',
    type: 'rest',
    position: (latitude: 16.1, longitude: 108.2),
    instructions: 'Dữ liệu mẫu',
  );
  const trip = OfflineTrip(
    route: [
      (latitude: 16.1, longitude: 108.2),
      (latitude: 16.11, longitude: 108.21),
    ],
    checkpoints: [checkpoint],
    guides: [],
    hazardSources: [],
  );
  final map = OfflineMapContext(
    tripId: 'trip',
    packageVersion: 1,
    packageId: 'package',
    route: const OfflineRouteGeometry(
      routeId: 'route',
      points: [
        OfflineRoutePoint(latitude: 16.1, longitude: 108.2),
        OfflineRoutePoint(latitude: 16.11, longitude: 108.21),
      ],
    ),
    checkpoints: const [
      OfflineMapCheckpoint(
        id: 'stop',
        routeId: 'route',
        name: 'Điểm nghỉ',
        type: 'rest',
        latitude: 16.1,
        longitude: 108.2,
        radiusMeters: 30,
      ),
    ],
  );

  Future<void> render(
    WidgetTester tester, {
    bool available = true,
    String account = 'account',
  }) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          offlinePackageAccountProvider.overrideWithValue(account),
          offlineTripProvider(selection).overrideWith((ref) async => trip),
          savedTripMapProvider(selection).overrideWith(
            (ref) async => available ? (context: map, basemapPath: null) : null,
          ),
        ],
        child: const MaterialApp(home: OfflineTripScreen(selection: selection)),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets(
    'route tab renders saved geometry and numbered stops without inventing GPS',
    (tester) async {
      await render(tester);
      final canvas = tester.widget<OfflineMapCanvas>(
        find.byType(OfflineMapCanvas),
      );
      expect(canvas.route, same(map.route));
      expect(canvas.checkpoints.single.id, 'stop');
      expect(canvas.location.sample, isNull);
      expect(find.text('1. Điểm nghỉ'), findsOneWidget);
      expect(find.textContaining('Sơ đồ không có bản đồ nền'), findsNothing);
    },
  );

  testWidgets('missing selected map does not silently show another version', (
    tester,
  ) async {
    await render(tester, available: false);
    expect(find.byType(OfflineMapCanvas), findsNothing);
    expect(
      find.textContaining('Gói đang xem không còn khả dụng'),
      findsOneWidget,
    );
  });

  testWidgets('account change hides saved route and checkpoint content', (
    tester,
  ) async {
    await render(tester, account: 'other-account');
    expect(find.byType(OfflineMapCanvas), findsNothing);
    expect(find.text('Dữ liệu ngoại tuyến không khả dụng'), findsOneWidget);
    expect(find.text('1. Điểm nghỉ'), findsNothing);
  });
}
