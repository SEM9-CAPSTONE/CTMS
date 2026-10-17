import 'dart:io';
import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_exception.dart';
import 'package:mobile/features/incidents/application/incident_sync.dart';
import 'package:mobile/features/incidents/data/incident_store.dart';
import 'package:mobile/features/incidents/data/incidents_api.dart';
import 'package:mobile/features/incidents/domain/trip_incident.dart';

class FakeIncidentsApi implements IncidentsApi {
  final Map<String, IncidentJson> authoritative = {};
  Object? reportError;
  Object? uploadError;
  bool loseFirstResponse = false;
  int reports = 0;
  int uploads = 0;
  @override
  Future<List<IncidentTrip>> assignedTrips() async => [];
  @override
  Future<List<IncidentJson>> list(String tripId) async =>
      authoritative.values.toList();
  @override
  Future<IncidentJson> report(String tripId, IncidentJson payload) async {
    reports++;
    if (reportError != null) throw reportError!;
    final incident = authoritative.putIfAbsent(
      payload['id'] as String,
      () => {...payload, 'tripId': tripId, 'media': null},
    );
    if (loseFirstResponse) {
      loseFirstResponse = false;
      throw ApiException('timeout', kind: ApiExceptionKind.timeout);
    }
    return incident;
  }

  @override
  Future<IncidentJson> upload(String tripId, String id, Uint8List bytes) async {
    uploads++;
    if (uploadError != null) throw uploadError!;
    return {
      ...authoritative[id]!,
      'media': {'url': '/uploads/photo.jpg'},
    };
  }
}

LocalIncident event({bool photo = false}) => LocalIncident(
  tripId: 'trip-a',
  payload: {
    'id': newIncidentId(),
    'category': 'injury',
    'severity': 'high',
    'description': 'Trượt chân',
    'occurredAt': '2026-10-16T03:00:00.000Z',
    'location': {
      'latitude': 16.1,
      'longitude': 108.2,
      'accuracyMeters': 9.0,
      'capturedAt': '2026-10-16T02:59:59.000Z',
    },
    'capturedOffline': true,
  },
  photo: photo ? Uint8List.fromList([255, 216, 255, 224]) : null,
  mediaState: photo ? IncidentMediaState.pending : IncidentMediaState.none,
);

void main() {
  final now = DateTime.utc(2026, 10, 16, 4);
  test(
    'lost acknowledgement resends original identity/time/location without duplicate',
    () async {
      final api = FakeIncidentsApi()..loseFirstResponse = true;
      final original = event();
      final pending = await synchronizeIncident(original, api, now);
      expect(pending.syncState, IncidentSyncState.pending);
      expect(pending.nextAttemptAt, now.add(const Duration(seconds: 5)));
      expect(pending.due(now), false);
      expect(pending.payload, original.payload);
      final synced = await synchronizeIncident(
        pending,
        api,
        pending.nextAttemptAt!,
      );
      expect(synced.syncState, IncidentSyncState.synced);
      expect(api.authoritative.length, 1);
      expect(api.reports, 2);
      expect(synced.payload, original.payload);
    },
  );
  test(
    'permanent assignment rejection is failed and stops automatic retries',
    () async {
      final api = FakeIncidentsApi()
        ..reportError = ApiException('not assigned', statusCode: 403);
      final failed = await synchronizeIncident(event(), api, now);
      expect(failed.syncState, IncidentSyncState.failed);
      expect(failed.hasWork, false);
      expect(failed.error, 'not assigned');
    },
  );
  for (final status in [401, 408, 429, 503]) {
    test('HTTP $status preserves pending report for retry', () async {
      final api = FakeIncidentsApi()
        ..reportError = ApiException('retry', statusCode: status);
      final pending = await synchronizeIncident(event(), api, now);
      expect(pending.syncState, IncidentSyncState.pending);
      expect(pending.hasWork, true);
    });
  }
  test(
    'permanent photo failure does not invalidate confirmed incident',
    () async {
      final api = FakeIncidentsApi()
        ..uploadError = ApiException('bad image', statusCode: 422);
      final result = await synchronizeIncident(event(photo: true), api, now);
      expect(result.syncState, IncidentSyncState.synced);
      expect(result.mediaState, IncidentMediaState.failed);
      expect(result.photo, isNotNull);
      expect(api.authoritative.length, 1);
    },
  );
  test('photo retry sends only media, then releases stored bytes', () async {
    final api = FakeIncidentsApi()..uploadError = ApiException('offline');
    final result = await synchronizeIncident(event(photo: true), api, now);
    expect(result.syncState, IncidentSyncState.synced);
    expect(result.mediaState, IncidentMediaState.pending);
    api.uploadError = null;
    final uploaded = await synchronizeIncident(
      result,
      api,
      result.nextAttemptAt!,
    );
    expect(api.reports, 1);
    expect(api.uploads, 2);
    expect(uploaded.mediaState, IncidentMediaState.uploaded);
    expect(uploaded.photo, isNull);
  });
  test('session disposal between parent and media stops upload', () async {
    final api = FakeIncidentsApi();
    final result = await synchronizeIncident(
      event(photo: true),
      api,
      now,
      isActive: () => api.reports == 0,
    );
    expect(result.syncState, IncidentSyncState.synced);
    expect(result.mediaState, IncidentMediaState.pending);
    expect(api.uploads, 0);
  });
  test(
    'durable store restores event and image after restart, isolated by account',
    () async {
      final directory = await Directory.systemTemp.createTemp(
        'ctms-incident-test-',
      );
      addTearDown(() => directory.delete(recursive: true));
      final first = FileIncidentStore('porter-a', root: directory);
      final original = event(photo: true);
      await first.put(original);
      await first.saveTrips([
        const IncidentTrip(id: 'trip-a', title: 'Trip A', status: 'ongoing'),
      ]);
      final restarted = FileIncidentStore('porter-a', root: directory);
      final restored = (await restarted.read()).single;
      expect(restored.toJson(), original.toJson());
      expect(restored.syncState, IncidentSyncState.pending);
      expect((await restarted.readTrips()).single.id, 'trip-a');
      expect(
        await FileIncidentStore('porter-b', root: directory).read(),
        isEmpty,
      );
      // Acknowledgement overwrites atomically, rather than appending a second event.
      await restarted.put(restored.delivery(sync: IncidentSyncState.synced));
      expect((await first.read()).single.syncState, IncidentSyncState.synced);
    },
  );
}
