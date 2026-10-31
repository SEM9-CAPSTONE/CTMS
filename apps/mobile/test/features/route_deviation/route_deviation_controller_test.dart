import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/gps_tracking/application/gps_location_source.dart';
import 'package:mobile/features/gps_tracking/application/gps_tracking_controller.dart';
import 'package:mobile/features/route_deviation/application/route_deviation_controller.dart';
import 'package:mobile/features/route_deviation/domain/route_deviation_models.dart';

import '../gps_tracking/gps_fakes.dart';
import 'route_deviation_fakes.dart';

void main() {
  late DateTime now;
  late FakeLocationSource location;
  late GpsTrackingController gps;
  late FakeRouteDeviationApi api;
  late MemoryRouteDeviationStore store;
  late bool online;
  late int alerts;

  RouteDeviationController build() => RouteDeviationController(
    tripId: tripId,
    gps: gps,
    api: api,
    store: store,
    clock: () => now,
    isOnline: () async => online,
    alert: () async => alerts++,
    autoStart: false,
  );

  /// Takes one GPS sample through the real tracking controller, as the 10 s timer would.
  Future<void> walk(RouteDeviationController controller, double meters, {double accuracy = 8}) async {
    now = now.add(const Duration(seconds: 10));
    location.next = sampleOffRoute(now, meters, accuracy: accuracy);
    await gps.sampleNow();
    await controller.tick();
  }

  setUp(() async {
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
    online = true;
    alerts = 0;
  });

  tearDown(() => gps.dispose());

  test('runs detection only while GPS breadcrumbs are being recorded', () async {
    location.permission = GpsPermissionState.denied;
    await gps.start();
    final controller = build();
    await controller.start();
    expect(controller.status, RouteDeviationStatus.paused);
    expect(controller.detector, isNull);

    location.afterRequest = GpsPermissionState.granted;
    await gps.requestPermission();
    expect(controller.status, RouteDeviationStatus.active);
    expect(controller.detector, isNotNull);
    controller.dispose();
  });

  test('offline OFF_ROUTE is persisted with its state, warned locally and kept pending (BR-384/386)', () async {
    await gps.start();
    api.uploadError = offline();
    online = false;
    final controller = build();
    await controller.start();

    for (final meters in [55.0, 60.0, 65.0]) {
      await walk(controller, meters);
    }

    final stored = store.records[tripId]!;
    expect(stored.navigation, RouteNavigationState.offRoute);
    final event = stored.events.single;
    expect(event.type, SafetyEventType.offRoute);
    expect(event.detectedOffline, isTrue);
    expect(event.routeVersion, 'route-v1');
    expect(event.distanceToRouteMeters, closeTo(65, 0.5));
    expect(event.syncState, SafetyEventSyncState.pending);
    expect(alerts, 1);
    expect(controller.activeWarning?.id, event.id);
    expect(controller.navigation, RouteNavigationState.offRoute);
    controller.dispose();
  });

  test('uploads confirmed events when online and marks them synced', () async {
    await gps.start();
    final controller = build();
    await controller.start();
    for (final meters in [55.0, 60.0, 65.0, 18.0, 15.0, 12.0]) {
      await walk(controller, meters);
    }
    await controller.syncNow(force: true);

    expect(controller.events.map((event) => event.type), [
      SafetyEventType.offRoute,
      SafetyEventType.onRouteRecovered,
    ]);
    expect(controller.syncedCount, 2);
    expect(controller.activeWarning, isNull, reason: 'cleared once back on the Route');
    expect(controller.events.every((event) => !event.detectedOffline), isTrue);
    controller.dispose();
  });

  test('a repeated GPS fix is not counted twice', () async {
    await gps.start();
    final controller = build();
    await controller.start();
    await walk(controller, 55);
    await gps.sampleNow();
    await gps.sampleNow();
    await controller.tick();
    expect(controller.detector!.offRouteCount, 1);
    controller.dispose();
  });

  test('enters GPS_DEGRADED after two minutes without a VALID sample and recovers (BR-387/388)', () async {
    await gps.start();
    final controller = build();
    await controller.start();
    location.sampleError = StateError('no fix');
    now = now.add(const Duration(seconds: 125));
    await controller.tick();

    expect(controller.quality, GpsQualityState.degraded);
    expect(controller.navigation, RouteNavigationState.onRoute);
    expect(store.records[tripId]!.quality, GpsQualityState.degraded);
    expect(controller.events.last.type, SafetyEventType.gpsDegraded);
    expect(alerts, 0, reason: 'GPS_DEGRADED is not an off-route warning');

    location.sampleError = null;
    await walk(controller, 5);
    expect(controller.quality, GpsQualityState.normal);
    expect(controller.events.last.type, SafetyEventType.gpsRestored);
    controller.dispose();
  });

  test('uses the cached Route context when offline and restores confirmed states', () async {
    store.records[tripId] = RouteDeviationRecord(
      context: routeContext(),
      navigation: RouteNavigationState.offRoute,
    );
    api.contextError = offline();
    await gps.start();
    final controller = build();
    await controller.start();

    expect(controller.status, RouteDeviationStatus.active);
    expect(controller.navigation, RouteNavigationState.offRoute);
    expect(controller.detector!.recoveryCount, 0, reason: 'counters restart after reopening');
    controller.dispose();
  });

  test('is unavailable when no Route context was ever loaded', () async {
    api.contextError = offline();
    await gps.start();
    final controller = build();
    await controller.start();
    expect(controller.status, RouteDeviationStatus.unavailable);
    expect(controller.detector, isNull);
    controller.dispose();
  });

  test('a new Route version resets states detected against the old geometry', () async {
    store.records[tripId] = RouteDeviationRecord(
      context: routeContext(routeVersion: 'old'),
      navigation: RouteNavigationState.offRoute,
      events: [offRouteEvent(now)],
    );
    await gps.start();
    final controller = build();
    await controller.start();
    expect(controller.navigation, RouteNavigationState.onRoute);
    expect(controller.context?.routeVersion, 'route-v1');
    expect(controller.events, hasLength(1), reason: 'events already confirmed are kept');
    controller.dispose();
  });

  test('does not detect for an ineligible participant or unsupported configuration', () async {
    api.contextResult = () => routeContext(eligible: false, reason: 'TRIP_NOT_ONGOING');
    await gps.start();
    final ineligible = build();
    await ineligible.start();
    expect(ineligible.status, RouteDeviationStatus.notEligible);
    ineligible.dispose();

    api.contextResult = () => routeContext(configVersion: 'v4');
    final unsupported = build();
    await unsupported.start();
    expect(unsupported.status, RouteDeviationStatus.unavailable);
    expect(unsupported.detector, isNull);
    unsupported.dispose();
  });
}
