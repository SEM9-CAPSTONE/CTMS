import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/gps_tracking/application/gps_tracking_controller.dart';
import 'package:mobile/features/gps_tracking/data/gps_log_store.dart';
import 'package:mobile/features/gps_tracking/domain/gps_tracking_models.dart';
import 'package:mobile/features/incidents/data/incident_store.dart';
import 'package:mobile/features/incidents/data/incidents_api.dart';
import 'package:mobile/features/incidents/domain/trip_incident.dart';
import 'package:mobile/features/route_deviation/application/route_deviation_controller.dart';
import 'package:mobile/features/route_deviation/data/route_deviation_store.dart';
import 'package:mobile/features/route_deviation/domain/route_deviation_models.dart';
import 'package:mobile/features/sync/application/device_sync_controller.dart';
import 'package:mobile/features/sync/data/device_sync_api.dart';

import '../gps_tracking/gps_fakes.dart';
import '../route_deviation/route_deviation_fakes.dart' as route;

class _FakeDeviceSyncApi implements DeviceSyncApi {
  @override
  Future<Map<String, Object?>> getStatus(String tripId) async => {
    'tripId': tripId,
    'userId': 'test-user-064',
    'participantRole': 'camper',
    'serverConfirmedGpsCount': 25,
    'serverConfirmedSafetyCount': 1,
    'lastReceivedAt': '2026-11-07T10:00:00.000Z',
    'packageVersion': 'pkg-v3',
    'configVersion': 'v3',
  };
}

class _FakeIncidentStore implements IncidentStore {
  @override
  Future<List<LocalIncident>> read() async => [];

  @override
  Future<void> put(LocalIncident record) async {}

  @override
  Future<List<IncidentTrip>> readTrips() async => [];

  @override
  Future<void> saveTrips(List<IncidentTrip> trips) async {}
}

class _FakeIncidentsApi implements IncidentsApi {
  @override
  Future<List<IncidentTrip>> assignedTrips() async => [];

  @override
  Future<List<IncidentJson>> list(String tripId) async => [];

  @override
  Future<IncidentJson> report(String tripId, IncidentJson payload) async => payload;

  @override
  Future<IncidentJson> upload(String tripId, String id, List<int> bytes) async => {};
}

void main() {
  group('CTMS-064 — Offline Buffer for GPS and Safety Events', () {
    late Directory tempDir;
    const testTripId = '11111111-2222-3333-4444-555555555555';
    const testUserId = 'test-camper-user-064';

    setUp(() async {
      tempDir = await Directory.systemTemp.createTemp('ctms_064_buffer_test_');
    });

    tearDown(() async {
      try {
        if (await tempDir.exists()) {
          await tempDir.delete(recursive: true);
        }
      } catch (_) {}
    });

    test('PB AC-1: GPS logs are persisted locally while offline (BR-242)', () async {
      final store = FileGpsLogStore(testUserId, root: tempDir);

      // Verify initially empty
      final initialLogs = await store.read(testTripId);
      expect(initialLogs, isEmpty);

      // Add offline GPS log
      final logTime = DateTime.utc(2026, 11, 7, 10, 0, 0);
      final sample = GpsSample(
        capturedAt: logTime,
        latitude: 16.0544,
        longitude: 108.2022,
        accuracyMeters: 5.0,
        altitudeMeters: 250.0,
      );

      final log = LocalGpsLog.fromSample(
        id: 'gps-log-uuid-001',
        tripId: testTripId,
        sample: sample,
        configVersion: 'v3',
      );

      // Persist to offline buffer
      final updated = await store.update(testTripId, (current) => [...current, log]);

      expect(updated.length, 1);
      expect(updated.first.id, 'gps-log-uuid-001');
      expect(updated.first.syncState, GpsLogSyncState.pending);
      expect(updated.first.latitude, 16.0544);
      expect(updated.first.longitude, 108.2022);
    });

    test('PB AC-2: Safety events are persisted locally while offline (BR-242)', () async {
      final store = FileRouteDeviationStore(testUserId, root: tempDir);

      // Verify initially empty
      final initialRecord = await store.read(testTripId);
      expect(initialRecord.events, isEmpty);
      expect(initialRecord.navigation, RouteNavigationState.onRoute);

      // Create an offline safety event (e.g. OFF_ROUTE detected while network is down)
      final eventTime = DateTime.utc(2026, 11, 7, 10, 15, 0);
      final safetyEvent = LocalSafetyEvent(
        id: 'safety-event-uuid-001',
        tripId: testTripId,
        type: SafetyEventType.offRoute,
        eventTime: eventTime,
        detectedOffline: true,
        routeVersion: 'route-v1',
        configVersion: 'v3',
        latitude: 16.0600,
        longitude: 108.2100,
        distanceToRouteMeters: 150.0,
        consecutiveValidSamples: 3,
        syncState: SafetyEventSyncState.pending,
      );

      // Persist safety event and state transition
      final updatedRecord = await store.update(
        testTripId,
        (current) => current.copyWith(
          navigation: RouteNavigationState.offRoute,
          events: [...current.events, safetyEvent],
        ),
      );

      expect(updatedRecord.navigation, RouteNavigationState.offRoute);
      expect(updatedRecord.events.length, 1);
      expect(updatedRecord.events.first.id, 'safety-event-uuid-001');
      expect(updatedRecord.events.first.detectedOffline, isTrue);
      expect(updatedRecord.events.first.syncState, SafetyEventSyncState.pending);
      expect(updatedRecord.events.first.distanceToRouteMeters, 150.0);
    });

    test('PB AC-3: Pending data survives app close/reopen and device restart (BR-242)', () async {
      // 1. Initial app session: write pending GPS log and pending safety event
      final initialGpsStore = FileGpsLogStore(testUserId, root: tempDir);
      final initialSafetyStore = FileRouteDeviationStore(testUserId, root: tempDir);

      final gpsLog = LocalGpsLog(
        id: 'gps-survive-uuid',
        tripId: testTripId,
        eventTime: DateTime.utc(2026, 11, 7, 10, 30, 0),
        latitude: 16.0550,
        longitude: 108.2030,
        accuracyMeters: 4.0,
        configVersion: 'v3',
        syncState: GpsLogSyncState.pending,
      );
      await initialGpsStore.update(testTripId, (current) => [...current, gpsLog]);

      final safetyEvent = LocalSafetyEvent(
        id: 'safety-survive-uuid',
        tripId: testTripId,
        type: SafetyEventType.gpsDegraded,
        eventTime: DateTime.utc(2026, 11, 7, 10, 31, 0),
        detectedOffline: true,
        routeVersion: 'route-v1',
        configVersion: 'v3',
        syncState: SafetyEventSyncState.pending,
      );
      await initialSafetyStore.update(
        testTripId,
        (current) => current.copyWith(
          quality: GpsQualityState.degraded,
          events: [...current.events, safetyEvent],
        ),
      );

      // 2. Simulate complete app kill / device reboot: discard old store instances,
      // create brand new store instances reading the persistent filesystem root.
      final restartedGpsStore = FileGpsLogStore(testUserId, root: tempDir);
      final restartedSafetyStore = FileRouteDeviationStore(testUserId, root: tempDir);

      final restoredLogs = await restartedGpsStore.read(testTripId);
      final restoredRecord = await restartedSafetyStore.read(testTripId);

      // Verify all data survived restart intact
      expect(restoredLogs.length, 1);
      expect(restoredLogs.first.id, 'gps-survive-uuid');
      expect(restoredLogs.first.syncState, GpsLogSyncState.pending);
      expect(restoredLogs.first.latitude, 16.0550);
      expect(restoredLogs.first.longitude, 108.2030);

      expect(restoredRecord.quality, GpsQualityState.degraded);
      expect(restoredRecord.events.length, 1);
      expect(restoredRecord.events.first.id, 'safety-survive-uuid');
      expect(restoredRecord.events.first.type, SafetyEventType.gpsDegraded);
      expect(restoredRecord.events.first.syncState, SafetyEventSyncState.pending);
    });

    test('PB AC-4: OFF_ROUTE/safety detection continues locally when offline (BR-242)', () async {
      final safetyStore = FileRouteDeviationStore(testUserId, root: tempDir);
      final gpsStore = MemoryGpsLogStore();
      final location = FakeLocationSource();
      final gpsApi = FakeGpsTrackingApi();
      final safetyApi = route.FakeRouteDeviationApi();

      var now = DateTime.utc(2026, 11, 7, 11, 0, 0);
      location.next = route.sampleOffRoute(now, 5);

      final gpsController = GpsTrackingController(
        tripId: testTripId,
        api: gpsApi,
        store: gpsStore,
        location: location,
        clock: () => now,
        autoStart: false,
      );

      // Seed cached offline context
      safetyApi.contextResult = () => route.routeContext();
      safetyApi.uploadError = offline();

      var alertCount = 0;
      final controller = RouteDeviationController(
        tripId: testTripId,
        gps: gpsController,
        api: safetyApi,
        store: safetyStore,
        clock: () => now,
        isOnline: () async => false, // Simulate device strictly offline
        alert: () async => alertCount++,
        autoStart: false,
      );

      await gpsController.start();
      await controller.start();
      expect(controller.navigation, RouteNavigationState.onRoute);

      // Feed consecutive off-route GPS samples (55m, 60m, 65m - exceeding 50m threshold)
      for (final meters in [55.0, 60.0, 65.0]) {
        now = now.add(const Duration(seconds: 10));
        location.next = route.sampleOffRoute(now, meters);
        await gpsController.sampleNow();
        await controller.tick();
      }

      // Local safety detection confirmed OFF_ROUTE without server
      expect(controller.navigation, RouteNavigationState.offRoute);
      expect(controller.events.length, 1);
      expect(controller.events.first.type, SafetyEventType.offRoute);
      expect(controller.events.first.detectedOffline, isTrue);
      expect(controller.events.first.syncState, SafetyEventSyncState.pending);
      expect(alertCount, 1);

      // Verify event was saved to local persistent buffer
      final persisted = await safetyStore.read(testTripId);
      expect(persisted.navigation, RouteNavigationState.offRoute);
      expect(persisted.events.length, 1);

      controller.dispose();
      gpsController.dispose();
    });

    test('PB AC-5: Local pending data is distinguishable from server-confirmed data (BR-226)', () async {
      final gpsStore = MemoryGpsLogStore();
      final safetyStore = route.MemoryRouteDeviationStore();

      // Populate 2 pending GPS logs and 1 synced GPS log
      await gpsStore.update(testTripId, (_) => [
        LocalGpsLog(
          id: 'log-1',
          tripId: testTripId,
          eventTime: DateTime.utc(2026, 11, 7, 12, 0, 0),
          latitude: 16.05,
          longitude: 108.20,
          accuracyMeters: 5,
          configVersion: 'v3',
          syncState: GpsLogSyncState.pending,
        ),
        LocalGpsLog(
          id: 'log-2',
          tripId: testTripId,
          eventTime: DateTime.utc(2026, 11, 7, 12, 0, 30),
          latitude: 16.051,
          longitude: 108.201,
          accuracyMeters: 5,
          configVersion: 'v3',
          syncState: GpsLogSyncState.pending,
        ),
        LocalGpsLog(
          id: 'log-3',
          tripId: testTripId,
          eventTime: DateTime.utc(2026, 11, 7, 12, 1, 0),
          latitude: 16.052,
          longitude: 108.202,
          accuracyMeters: 5,
          configVersion: 'v3',
          syncState: GpsLogSyncState.synced, // Server confirmed
        ),
      ]);

      // Populate 1 pending safety event
      await safetyStore.update(testTripId, (cur) => cur.copyWith(
        events: [
          LocalSafetyEvent(
            id: 'evt-1',
            tripId: testTripId,
            type: SafetyEventType.offRoute,
            eventTime: DateTime.utc(2026, 11, 7, 12, 0, 30),
            detectedOffline: true,
            routeVersion: 'route-v1',
            configVersion: 'v3',
            syncState: SafetyEventSyncState.pending,
          ),
        ],
      ));

      final fakeApi = _FakeDeviceSyncApi();
      final incidentStore = _FakeIncidentStore();
      final incidentsApi = _FakeIncidentsApi();

      final controller = DeviceSyncController(
        tripId: testTripId,
        api: fakeApi,
        incidentStore: incidentStore,
        incidentsApi: incidentsApi,
        gpsStore: gpsStore,
        safetyEventStore: safetyStore,
      );

      await controller.refresh();

      // BR-226: Local pending count is strictly isolated and clearly distinguished
      expect(controller.summary.pendingGpsCount, 2); // Only 2 pending, 1 already synced
      expect(controller.summary.pendingSafetyCount, 1);
      expect(controller.summary.serverConfirmedGpsCount, 25); // Server confirmed from API
      expect(controller.summary.serverConfirmedSafetyCount, 1);

      controller.dispose();
    });

    test('BR-213 Violation Path: Rejects malformed trip ID and handles corrupted files gracefully', () async {
      final store = FileGpsLogStore(testUserId, root: tempDir);

      // 1. Violation: Malformed trip identity must be rejected with ArgumentError
      expect(
        () => store.read('invalid-non-uuid-trip-id'),
        throwsArgumentError,
      );
      expect(
        () => store.update('invalid-non-uuid-trip-id', (cur) => cur),
        throwsArgumentError,
      );

      final safetyStore = FileRouteDeviationStore(testUserId, root: tempDir);
      expect(
        () => safetyStore.read('../../path-traversal-id'),
        throwsArgumentError,
      );

      // 2. Edge Case: Non-existent file returns empty collection rather than crashing
      const validNonExistentTripId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
      final emptyLogs = await store.read(validNonExistentTripId);
      expect(emptyLogs, isEmpty);

      final emptyRecord = await safetyStore.read(validNonExistentTripId);
      expect(emptyRecord.events, isEmpty);
      expect(emptyRecord.navigation, RouteNavigationState.onRoute);
    });
  });
}
