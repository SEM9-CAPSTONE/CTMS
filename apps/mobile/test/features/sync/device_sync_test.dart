import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/gps_tracking/domain/gps_tracking_models.dart';
import 'package:mobile/features/incidents/data/incident_store.dart';
import 'package:mobile/features/incidents/data/incidents_api.dart';
import 'package:mobile/features/incidents/domain/trip_incident.dart';
import 'package:mobile/features/route_deviation/domain/route_deviation_models.dart';
import 'package:mobile/features/sync/application/device_sync_controller.dart';
import 'package:mobile/features/sync/data/device_sync_api.dart';
import 'package:mobile/features/sync/domain/device_sync_models.dart';
import 'package:mobile/features/sync/presentation/device_sync_status_screen.dart';

import '../gps_tracking/gps_fakes.dart' as gps;
import '../route_deviation/route_deviation_fakes.dart' as route;

class FakeDeviceSyncApi implements DeviceSyncApi {
  Map<String, Object?> response = {
    'tripId': 'trip-test',
    'userId': 'user-1',
    'participantRole': 'porter',
    'serverConfirmedGpsCount': 25,
    'serverConfirmedSafetyCount': 1,
    'lastReceivedAt': '2026-10-23T14:30:00.000Z',
    'packageVersion': 'pkg-v3',
    'configVersion': 'v3',
  };

  @override
  Future<Map<String, Object?>> getStatus(String tripId) async => response;
}

class FakeIncidentStore implements IncidentStore {
  final List<LocalIncident> records = [];

  @override
  Future<List<LocalIncident>> read() async => List.unmodifiable(records);

  @override
  Future<void> put(LocalIncident record) async {
    records.removeWhere((r) => r.payload['id'] == record.payload['id']);
    records.add(record);
  }

  @override
  Future<List<IncidentTrip>> readTrips() async => [];

  @override
  Future<void> saveTrips(List<IncidentTrip> trips) async {}
}

class FakeIncidentsApi implements IncidentsApi {
  int reportCalls = 0;

  @override
  Future<List<IncidentTrip>> assignedTrips() async => [];

  @override
  Future<List<IncidentJson>> list(String tripId) async => [];

  @override
  Future<IncidentJson> report(String tripId, IncidentJson payload) async {
    reportCalls++;
    return payload;
  }

  @override
  Future<IncidentJson> upload(String tripId, String id, Uint8List bytes) async =>
      {};
}

void main() {
  group('DeviceSyncController (CTMS-067)', () {
    test('loads local pending counts and server confirmed data (BR-226)',
        () async {
      final fakeApi = FakeDeviceSyncApi();
      final fakeStore = FakeIncidentStore();
      final fakeIncidentsApi = FakeIncidentsApi();

      // Add a pending incident locally
      fakeStore.records.add(
        const LocalIncident(
          tripId: 'trip-test',
          syncState: IncidentSyncState.pending,
          payload: {
            'id': 'inc-1',
            'category': 'injury',
            'severity': 'high',
            'description': 'Té ngã',
            'occurredAt': '2026-10-23T14:00:00.000Z',
          },
        ),
      );

      final controller = DeviceSyncController(
        tripId: 'trip-test',
        api: fakeApi,
        incidentStore: fakeStore,
        incidentsApi: fakeIncidentsApi,
      );

      await controller.refresh();

      // Verify pending vs server-confirmed distinction (PB AC-1, AC-2, AC-6, BR-226)
      expect(controller.summary.pendingSafetyCount, equals(1));
      expect(controller.summary.serverConfirmedGpsCount, equals(25));
      expect(controller.summary.serverConfirmedSafetyCount, equals(1));
      expect(controller.summary.configVersion, equals('v3'));
      expect(controller.summary.packageVersion, equals('pkg-v3'));
      expect(controller.summary.state, equals(DeviceSyncState.pending));
    });

    test('retries pending records when retry is triggered (PB AC-5)', () async {
      final fakeApi = FakeDeviceSyncApi();
      final fakeStore = FakeIncidentStore();
      final fakeIncidentsApi = FakeIncidentsApi();

      fakeStore.records.add(
        const LocalIncident(
          tripId: 'trip-test',
          syncState: IncidentSyncState.failed,
          error: 'Mất kết nối mạng',
          payload: {
            'id': 'inc-fail',
            'category': 'other',
            'severity': 'low',
            'description': 'Lạc đường',
            'occurredAt': '2026-10-23T14:00:00.000Z',
          },
        ),
      );

      final controller = DeviceSyncController(
        tripId: 'trip-test',
        api: fakeApi,
        incidentStore: fakeStore,
        incidentsApi: fakeIncidentsApi,
      );

      await controller.refresh();
      expect(controller.summary.state, equals(DeviceSyncState.failed));

      await controller.retry();
      expect(fakeIncidentsApi.reportCalls, equals(1));
    });
  });

  group('DeviceSyncController with GPS breadcrumbs (CTMS-059)', () {
    LocalGpsLog gpsLog() => LocalGpsLog.fromSample(
      id: newGpsLogId(),
      tripId: gps.tripId,
      sample: gps.sampleAt(DateTime.utc(2026, 10, 25, 1)),
      configVersion: 'v3',
    );

    test('counts locally buffered GPS logs as pending', () async {
      final gpsStore = gps.MemoryGpsLogStore()..logs[gps.tripId] = [gpsLog(), gpsLog()];
      final controller = DeviceSyncController(
        tripId: gps.tripId,
        api: FakeDeviceSyncApi(),
        incidentStore: FakeIncidentStore(),
        incidentsApi: FakeIncidentsApi(),
        gpsStore: gpsStore,
        gpsApi: gps.FakeGpsTrackingApi(),
      );

      await controller.refresh();

      expect(controller.summary.pendingGpsCount, 2);
      expect(controller.summary.state, DeviceSyncState.pending);
    });

    test('retry also uploads pending GPS logs', () async {
      final gpsStore = gps.MemoryGpsLogStore()..logs[gps.tripId] = [gpsLog()];
      final gpsApi = gps.FakeGpsTrackingApi();
      final controller = DeviceSyncController(
        tripId: gps.tripId,
        api: FakeDeviceSyncApi(),
        incidentStore: FakeIncidentStore(),
        incidentsApi: FakeIncidentsApi(),
        gpsStore: gpsStore,
        gpsApi: gpsApi,
      );

      await controller.retry();

      expect(gpsApi.uploads, hasLength(1));
      expect(controller.summary.pendingGpsCount, 0);
    });
  });

  group('DeviceSyncController with route-deviation safety events (CTMS-060)', () {
    DeviceSyncController build(route.MemoryRouteDeviationStore store, route.FakeRouteDeviationApi api) =>
        DeviceSyncController(
          tripId: gps.tripId,
          api: FakeDeviceSyncApi(),
          incidentStore: FakeIncidentStore(),
          incidentsApi: FakeIncidentsApi(),
          safetyEventStore: store,
          safetyEventApi: api,
        );

    test('counts locally confirmed safety events as pending safety data', () async {
      final store = route.MemoryRouteDeviationStore()
        ..records[gps.tripId] = RouteDeviationRecord(
          events: [route.offRouteEvent(DateTime.utc(2026, 10, 31, 3))],
        );
      final controller = build(store, route.FakeRouteDeviationApi());

      await controller.refresh();

      expect(controller.summary.pendingSafetyCount, 1);
      expect(controller.summary.state, DeviceSyncState.pending);
    });

    test('retry also uploads pending safety events', () async {
      final store = route.MemoryRouteDeviationStore()
        ..records[gps.tripId] = RouteDeviationRecord(
          events: [route.offRouteEvent(DateTime.utc(2026, 10, 31, 3))],
        );
      final api = route.FakeRouteDeviationApi();
      final controller = build(store, api);

      await controller.retry();

      expect(api.uploads, hasLength(1));
      expect(controller.summary.pendingSafetyCount, 0);
      expect(store.records[gps.tripId]!.events.single.syncState, SafetyEventSyncState.synced);
    });
  });

  group('DeviceSyncStatusScreen Widget Test', () {
    testWidgets('renders sync screen with metrics, version and retry button',
        (tester) async {
      final fakeApi = FakeDeviceSyncApi();
      final fakeStore = FakeIncidentStore();
      final fakeIncidentsApi = FakeIncidentsApi();

      final controller = DeviceSyncController(
        tripId: 'trip-test',
        api: fakeApi,
        incidentStore: fakeStore,
        incidentsApi: fakeIncidentsApi,
      );

      await controller.refresh();

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            deviceSyncControllerProvider('trip-test')
                .overrideWith((ref) => controller),
          ],
          child: const MaterialApp(
            home: DeviceSyncStatusScreen(tripId: 'trip-test'),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Title & Headings
      expect(find.text('Đồng bộ thiết bị'), findsOneWidget);
      expect(find.text('Bản ghi GPS (Breadcrumbs)'), findsOneWidget);
      expect(find.text('Sự cố an toàn'), findsOneWidget);
      expect(find.text('Thông tin hệ thống'), findsOneWidget);

      // Distinguishes local vs server confirmed (BR-226)
      expect(find.text('Chờ đồng bộ tại thiết bị'), findsNWidgets(2));
      expect(find.text('Máy chủ đã xác nhận'), findsNWidgets(2));

      // Retry button (PB AC-5)
      expect(find.text('Đồng bộ ngay'), findsOneWidget);
    });
  });
}
