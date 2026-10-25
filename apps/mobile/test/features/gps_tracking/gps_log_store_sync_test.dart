import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/gps_tracking/application/gps_log_sync.dart';
import 'package:mobile/features/gps_tracking/data/gps_log_store.dart';
import 'package:mobile/features/gps_tracking/data/gps_tracking_api.dart';
import 'package:mobile/features/gps_tracking/domain/gps_tracking_models.dart';

import 'gps_fakes.dart';

LocalGpsLog newLog(DateTime at) => LocalGpsLog.fromSample(
  id: newGpsLogId(),
  tripId: tripId,
  sample: sampleAt(at),
  configVersion: 'v3',
);

void main() {
  group('FileGpsLogStore', () {
    late Directory root;
    setUp(() => root = Directory.systemTemp.createTempSync('ctms-gps-'));
    tearDown(() => root.deleteSync(recursive: true));

    test('persists logs per account and survives a new store instance', () async {
      final log = newLog(DateTime.utc(2026, 10, 25, 1));
      await FileGpsLogStore('user-a', root: root).update(tripId, (current) => [...current, log]);

      expect((await FileGpsLogStore('user-a', root: root).read(tripId)).single.id, log.id);
      expect(await FileGpsLogStore('user-b', root: root).read(tripId), isEmpty);
    });

    test('serializes concurrent updates so no appended log is lost', () async {
      final store = FileGpsLogStore('user-a', root: root);
      await Future.wait([
        for (var i = 0; i < 20; i++)
          store.update(tripId, (current) => [...current, newLog(DateTime.utc(2026, 10, 25, 1, 0, i))]),
      ]);
      expect(await store.read(tripId), hasLength(20));
    });

    test('rejects a malformed trip identity', () async {
      await expectLater(FileGpsLogStore('user-a', root: root).read('../escape'), throwsArgumentError);
    });
  });

  group('synchronizeGpsLogs', () {
    final now = DateTime.utc(2026, 10, 25, 2);

    test('marks accepted and duplicate logs synced and rejected logs failed with reason', () async {
      final store = MemoryGpsLogStore();
      final api = FakeGpsTrackingApi();
      final accepted = newLog(DateTime.utc(2026, 10, 25, 1));
      final duplicate = newLog(DateTime.utc(2026, 10, 25, 1, 0, 30));
      final rejected = newLog(DateTime.utc(2026, 10, 25, 1, 1));
      store.logs[tripId] = [accepted, duplicate, rejected];
      api.outcomes[duplicate.id] = (status: 'duplicate', reason: null);
      api.outcomes[rejected.id] = (status: 'rejected', reason: 'EVENT_TIME_OUTSIDE_PARTICIPATION');

      final result = await synchronizeGpsLogs(tripId: tripId, store: store, api: api, now: now);

      final byId = {for (final log in result) log.id: log};
      expect(byId[accepted.id]!.syncState, GpsLogSyncState.synced);
      expect(byId[duplicate.id]!.syncState, GpsLogSyncState.synced);
      expect(byId[rejected.id]!.syncState, GpsLogSyncState.failed);
      expect(byId[rejected.id]!.rejectionReason, 'EVENT_TIME_OUTSIDE_PARTICIPATION');
    });

    test('keeps logs pending with backoff when offline and skips them until due', () async {
      final store = MemoryGpsLogStore();
      final api = FakeGpsTrackingApi()..uploadError = offline();
      final log = newLog(DateTime.utc(2026, 10, 25, 1));
      store.logs[tripId] = [log];

      final first = await synchronizeGpsLogs(tripId: tripId, store: store, api: api, now: now);
      expect(first.single.syncState, GpsLogSyncState.pending);
      expect(first.single.attempts, 1);
      expect(first.single.nextAttemptAt, now.add(const Duration(seconds: 5)));

      api.uploadError = null;
      await synchronizeGpsLogs(tripId: tripId, store: store, api: api, now: now);
      expect(api.uploads, hasLength(1), reason: 'not due yet');

      final later = await synchronizeGpsLogs(
        tripId: tripId,
        store: store,
        api: api,
        now: now.add(const Duration(seconds: 6)),
      );
      expect(later.single.syncState, GpsLogSyncState.synced);
    });

    test('fails logs on a non-retryable error such as 422', () async {
      final store = MemoryGpsLogStore();
      final api = FakeGpsTrackingApi()..uploadError = httpError(422);
      store.logs[tripId] = [newLog(DateTime.utc(2026, 10, 25, 1))];

      final result = await synchronizeGpsLogs(tripId: tripId, store: store, api: api, now: now);
      expect(result.single.syncState, GpsLogSyncState.failed);
    });

    test('uploads in batches of at most 100 logs', () async {
      final store = MemoryGpsLogStore();
      final api = FakeGpsTrackingApi();
      store.logs[tripId] = [
        for (var i = 0; i < 230; i++) newLog(DateTime.utc(2026, 10, 25, 1).add(Duration(seconds: 30 * i))),
      ];

      await synchronizeGpsLogs(tripId: tripId, store: store, api: api, now: now);
      expect(api.uploads.map((batch) => batch.length), [100, 100, 30]);
    });

    test('does not lose a log appended while an upload is in flight', () async {
      final store = MemoryGpsLogStore();
      final api = _AppendDuringUploadApi(store);
      store.logs[tripId] = [newLog(DateTime.utc(2026, 10, 25, 1))];

      final result = await synchronizeGpsLogs(tripId: tripId, store: store, api: api, now: now);
      expect(result, hasLength(2));
      expect(result.where((log) => log.syncState == GpsLogSyncState.pending), hasLength(1));
    });
  });
}

class _AppendDuringUploadApi extends FakeGpsTrackingApi {
  _AppendDuringUploadApi(this.store);
  final MemoryGpsLogStore store;

  @override
  Future<List<GpsLogUploadResult>> upload(String tripId, List<LocalGpsLog> logs) async {
    await store.update(tripId, (current) => [...current, newLog(DateTime.utc(2026, 10, 25, 1, 5))]);
    return super.upload(tripId, logs);
  }
}
