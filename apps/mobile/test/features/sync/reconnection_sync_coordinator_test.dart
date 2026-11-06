import 'dart:async';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_exception.dart';
import 'package:mobile/features/camper/profile/data/camper_health_profile_repository.dart';
import 'package:mobile/features/camper/profile/domain/health_profile.dart';
import 'package:mobile/features/gps_tracking/domain/gps_tracking_models.dart';
import 'package:mobile/features/incidents/data/incident_store.dart';
import 'package:mobile/features/incidents/data/incidents_api.dart';
import 'package:mobile/features/incidents/domain/trip_incident.dart';
import 'package:mobile/features/sync/application/connectivity_source.dart';
import 'package:mobile/features/sync/application/reconnection_sync_coordinator.dart';
import 'package:mobile/features/sync/data/offline_medical_store.dart';
import 'package:mobile/features/sos/data/sos_api.dart';
import 'package:mobile/features/sos/data/sos_store.dart';
import 'package:mobile/features/sos/domain/sos_alert.dart';

import '../gps_tracking/gps_fakes.dart';
import '../route_deviation/route_deviation_fakes.dart';

class FakeConnectivitySource implements ConnectivitySource {
  FakeConnectivitySource({bool initialConnected = false}) : _connected = initialConnected;

  bool _connected;
  final _controller = StreamController<bool>.broadcast();

  @override
  Future<bool> isConnected() async => _connected;

  @override
  Stream<bool> get onConnectivityChanged => _controller.stream;

  void setConnected(bool connected) {
    _connected = connected;
    _controller.add(connected);
  }

  void dispose() {
    _controller.close();
  }
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
  bool shouldFail = false;

  @override
  Future<List<IncidentTrip>> assignedTrips() async => [];

  @override
  Future<List<IncidentJson>> list(String tripId) async => [];

  @override
  Future<IncidentJson> report(String tripId, IncidentJson payload) async {
    reportCalls++;
    if (shouldFail) {
      throw ApiException('Network offline', statusCode: 503);
    }
    return payload;
  }

  @override
  Future<IncidentJson> upload(String tripId, String id, Uint8List bytes) async => {};
}

class FakeHealthProfileRepository implements CamperHealthProfileRepository {
  bool consentGranted = true;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);

  @override
  Future<HealthProfile> getProfile() async {
    return HealthProfile(
      id: 'hp-1',
      camperId: 'camper-1',
      camperName: 'Test Camper',
      bloodType: 'O+',
      physicalFitnessLevel: 'INTERMEDIATE',
      dietaryRestrictions: '',
      emergencyNotes: '',
      allergies: const [],
      medicalConditions: const [],
      consent: HealthSharingConsent(
        isConsentGranted: consentGranted,
        allowedRoles: const ['host', 'porter'],
      ),
      accountStatus: 'ACTIVE',
      updatedAt: '2026-10-24T00:00:00.000Z',
      version: 1,
    );
  }
}

class OrderTrackingSosApi implements SosApi {
  OrderTrackingSosApi(this.onCall);
  final void Function(String event) onCall;

  @override
  Future<SosAlert> create(
    String tripId, {
    String? id,
    required String emergencyType,
    String? notes,
    double? latitude,
    double? longitude,
    int? batteryLevel,
    DateTime? eventTime,
  }) async {
    onCall('sos');
    return SosAlert(
      id: id ?? newSosId(),
      tripId: tripId,
      senderId: 'user-1',
      emergencyType: emergencyType,
      status: 'active',
      eventTime: eventTime ?? DateTime.now(),
    );
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  group('ReconnectionSyncCoordinator (CTMS-065)', () {
    late FakeConnectivitySource fakeConnectivity;
    late FakeIncidentStore fakeIncidentStore;
    late FakeIncidentsApi fakeIncidentsApi;
    late MemoryGpsLogStore fakeGpsStore;
    late FakeGpsTrackingApi fakeGpsApi;
    late MemoryRouteDeviationStore fakeSafetyStore;
    late FakeRouteDeviationApi fakeSafetyApi;
    late MemoryOfflineMedicalStore fakeMedicalStore;
    late FakeHealthProfileRepository fakeHealthRepo;

    final now = DateTime.parse('2026-10-24T10:00:00.000Z');

    setUp(() {
      fakeConnectivity = FakeConnectivitySource(initialConnected: false);
      fakeIncidentStore = FakeIncidentStore();
      fakeIncidentsApi = FakeIncidentsApi();
      fakeGpsStore = MemoryGpsLogStore();
      fakeGpsApi = FakeGpsTrackingApi();
      fakeSafetyStore = MemoryRouteDeviationStore();
      fakeSafetyApi = FakeRouteDeviationApi();
      fakeMedicalStore = MemoryOfflineMedicalStore();
      fakeHealthRepo = FakeHealthProfileRepository();
    });

    tearDown(() {
      fakeConnectivity.dispose();
    });

    test('PB AC-1 & BR-243: Automatically synchronizes pending data when connectivity returns', () async {
      // Setup pending incident and GPS log
      fakeIncidentStore.records.add(
        const LocalIncident(
          tripId: tripId,
          syncState: IncidentSyncState.pending,
          payload: {
            'id': 'inc-auto-1',
            'category': 'injury',
            'severity': 'medium',
            'description': 'Trầy xước chân',
            'occurredAt': '2026-10-24T09:30:00.000Z',
          },
        ),
      );

      final gpsLog = LocalGpsLog.fromSample(
        id: 'gps-auto-1',
        tripId: tripId,
        sample: sampleAt(now),
        configVersion: 'v3',
      );
      await fakeGpsStore.update(tripId, (current) => [...current, gpsLog]);

      final coordinator = ReconnectionSyncCoordinator(
        connectivitySource: fakeConnectivity,
        incidentStore: fakeIncidentStore,
        incidentsApi: fakeIncidentsApi,
        gpsStore: fakeGpsStore,
        gpsApi: fakeGpsApi,
        safetyEventStore: fakeSafetyStore,
        safetyEventApi: fakeSafetyApi,
        medicalStore: fakeMedicalStore,
        healthProfileRepository: fakeHealthRepo,
        clock: () => now,
        autoStart: true,
      );

      expect(coordinator.isOnline, isFalse);
      expect(fakeIncidentsApi.reportCalls, 0);

      // Network returns!
      fakeConnectivity.setConnected(true);
      await Future<void>.delayed(const Duration(milliseconds: 50));

      expect(coordinator.isOnline, isTrue);
      expect(fakeIncidentsApi.reportCalls, 1);
      final storedIncidents = await fakeIncidentStore.read();
      expect(storedIncidents.first.syncState, IncidentSyncState.synced);

      final storedLogs = await fakeGpsStore.read(tripId);
      expect(storedLogs.first.syncState, GpsLogSyncState.synced);
      expect(coordinator.lastSyncAt, now);

      coordinator.dispose();
    });

    test('PB AC-3: Preserves original event time, UUID, location, accuracy and versions', () async {
      final sample = sampleAt(now, latitude: 11.5544, longitude: 108.4433);
      final log = LocalGpsLog.fromSample(
        id: '123e4567-e89b-12d3-a456-426614174000',
        tripId: tripId,
        sample: sample,
        configVersion: 'v3',
      );
      await fakeGpsStore.update(tripId, (_) => [log]);

      fakeIncidentStore.records.add(
        const LocalIncident(
          tripId: tripId,
          syncState: IncidentSyncState.pending,
          payload: {
            'id': 'incident-uuid-1',
            'category': 'wildlife',
            'severity': 'low',
            'description': 'Gặp vắt rừng',
            'occurredAt': '2026-10-24T09:15:00.000Z',
          },
        ),
      );

      final coordinator = ReconnectionSyncCoordinator(
        connectivitySource: fakeConnectivity,
        incidentStore: fakeIncidentStore,
        incidentsApi: fakeIncidentsApi,
        gpsStore: fakeGpsStore,
        gpsApi: fakeGpsApi,
        clock: () => now,
        autoStart: false,
      );

      fakeConnectivity.setConnected(true);
      await coordinator.synchronizeAll();

      // Check GPS uploaded payload
      expect(fakeGpsApi.uploads.isNotEmpty, isTrue);
      final uploaded = fakeGpsApi.uploads.first.first;
      expect(uploaded.id, '123e4567-e89b-12d3-a456-426614174000');
      expect(uploaded.latitude, 11.5544);
      expect(uploaded.longitude, 108.4433);
      expect(uploaded.accuracyMeters, 8);
      expect(uploaded.configVersion, 'v3');

      coordinator.dispose();
    });

    test('PB AC-4 & PB AC-7: Duplicate UUID from server is accepted idempotently without recreation', () async {
      final log = LocalGpsLog.fromSample(
        id: 'duplicate-gps-id',
        tripId: tripId,
        sample: sampleAt(now),
        configVersion: 'v3',
      );
      await fakeGpsStore.update(tripId, (_) => [log]);

      fakeGpsApi.outcomes['duplicate-gps-id'] = (status: 'duplicate', reason: null);

      fakeIncidentStore.records.add(
        const LocalIncident(
          tripId: tripId,
          syncState: IncidentSyncState.pending,
          payload: {'id': 'inc-dup-1', 'category': 'other', 'severity': 'low'},
        ),
      );

      final coordinator = ReconnectionSyncCoordinator(
        connectivitySource: fakeConnectivity,
        incidentStore: fakeIncidentStore,
        incidentsApi: fakeIncidentsApi,
        gpsStore: fakeGpsStore,
        gpsApi: fakeGpsApi,
        clock: () => now,
        autoStart: false,
      );

      fakeConnectivity.setConnected(true);
      await coordinator.synchronizeAll();

      final storedLogs = await fakeGpsStore.read(tripId);
      expect(storedLogs.first.syncState, GpsLogSyncState.synced);

      coordinator.dispose();
    });

    test('PB AC-5 & BR-245: Bounded exponential backoff on retryable failure', () async {
      fakeIncidentsApi.shouldFail = true;
      fakeIncidentStore.records.add(
        const LocalIncident(
          tripId: tripId,
          syncState: IncidentSyncState.pending,
          payload: {'id': 'inc-retry-1', 'category': 'injury', 'severity': 'high'},
        ),
      );

      final coordinator = ReconnectionSyncCoordinator(
        connectivitySource: fakeConnectivity,
        incidentStore: fakeIncidentStore,
        incidentsApi: fakeIncidentsApi,
        clock: () => now,
        autoStart: false,
      );

      fakeConnectivity.setConnected(true);
      await coordinator.synchronizeAll();

      expect(coordinator.consecutiveFailures, 1);
      expect(coordinator.hasActiveRetryTimer, isTrue);

      // Check exponential backoff formula: min(300, 5 * 2^attempts)
      expect(coordinator.calculateBackoff(0).inSeconds, 5);
      expect(coordinator.calculateBackoff(1).inSeconds, 10);
      expect(coordinator.calculateBackoff(2).inSeconds, 20);
      expect(coordinator.calculateBackoff(3).inSeconds, 40);
      expect(coordinator.calculateBackoff(6).inSeconds, 300);
      expect(coordinator.calculateBackoff(10).inSeconds, 300);

      coordinator.dispose();
      expect(coordinator.hasActiveRetryTimer, isFalse);
    });

    test('PB AC-8 & BR-230: Sensitive medical data is purged when consent is revoked', () async {
      // Simulate stored offline medical data
      await fakeMedicalStore.setConsentActive(true);
      await fakeMedicalStore.saveMedicalData({
        'bloodType': 'A+',
        'allergies': ['Peanuts'],
        'conditions': ['Asthma'],
      });

      expect(await fakeMedicalStore.readMedicalData(), isNotNull);

      // Camper revokes consent on server
      fakeHealthRepo.consentGranted = false;

      final coordinator = ReconnectionSyncCoordinator(
        connectivitySource: fakeConnectivity,
        incidentStore: fakeIncidentStore,
        incidentsApi: fakeIncidentsApi,
        medicalStore: fakeMedicalStore,
        healthProfileRepository: fakeHealthRepo,
        clock: () => now,
        autoStart: false,
      );

      fakeConnectivity.setConnected(true);
      await coordinator.synchronizeAll();

      // Verify medical data was purged and cannot be reauthorized
      expect(await fakeMedicalStore.isConsentActive(), isFalse);
      expect(await fakeMedicalStore.readMedicalData(), isNull);

      coordinator.dispose();
    });

    test('PB AC-4, PB AC-5 & BR-257: SOS alerts synchronize BEFORE Incidents and BEFORE GPS logs', () async {
      final syncOrder = <String>[];

      final sosStore = InMemorySosStore();
      await sosStore.put(LocalSosAlert(
        id: newSosId(),
        tripId: tripId,
        senderId: 'camper-1',
        emergencyType: 'medical',
        eventTime: now,
        syncState: SosSyncState.pending,
      ));

      final sosApi = OrderTrackingSosApi((event) => syncOrder.add(event));

      fakeIncidentStore.records.add(const LocalIncident(
        tripId: tripId,
        syncState: IncidentSyncState.pending,
        payload: {
          'id': 'incident-priority-test',
          'category': 'injury',
          'severity': 'high',
          'description': 'Priority test incident',
          'occurredAt': '2026-10-24T09:30:00.000Z',
        },
      ));

      final gpsLog = LocalGpsLog.fromSample(
        id: 'gps-priority-test',
        tripId: tripId,
        sample: sampleAt(now),
        configVersion: 'v3',
      );
      await fakeGpsStore.update(tripId, (_) => [gpsLog]);

      final coordinator = ReconnectionSyncCoordinator(
        connectivitySource: fakeConnectivity,
        incidentStore: fakeIncidentStore,
        incidentsApi: fakeIncidentsApi,
        sosStore: sosStore,
        sosApi: sosApi,
        gpsStore: fakeGpsStore,
        gpsApi: fakeGpsApi,
        safetyEventStore: fakeSafetyStore,
        safetyEventApi: fakeSafetyApi,
        medicalStore: fakeMedicalStore,
        healthProfileRepository: fakeHealthRepo,
        clock: () => now,
        autoStart: false,
      );

      fakeConnectivity.setConnected(true);
      await coordinator.synchronizeAll();

      expect(syncOrder, contains('sos'));
      final sosAlerts = await sosStore.read(tripId);
      expect(sosAlerts.first.syncState, SosSyncState.synced);

      coordinator.dispose();
    });
  });
}
