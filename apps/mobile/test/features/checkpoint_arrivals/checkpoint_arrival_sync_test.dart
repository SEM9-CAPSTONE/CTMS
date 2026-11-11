import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_exception.dart';
import 'package:mobile/features/checkpoint_arrivals/application/checkpoint_arrival_sync.dart';
import 'package:mobile/features/checkpoint_arrivals/data/checkpoint_arrival_api.dart';
import 'package:mobile/features/checkpoint_arrivals/data/checkpoint_arrival_store.dart';
import 'package:mobile/features/checkpoint_arrivals/domain/checkpoint_arrival_models.dart';

class MockApi implements CheckpointArrivalApi {
  int callCount = 0;
  List<LocalCheckpointArrival> lastSentArrivals = [];
  CheckpointArrivalSyncResponse Function(String tripId, List<LocalCheckpointArrival> arrivals)? onSync;

  @override
  Future<CheckpointArrivalSyncResponse> syncBatch({
    required String tripId,
    required List<LocalCheckpointArrival> arrivals,
  }) async {
    callCount++;
    lastSentArrivals = arrivals;
    if (onSync != null) {
      return onSync!(tripId, arrivals);
    }
    return CheckpointArrivalSyncResponse(
      results: [
        for (final a in arrivals)
          CheckpointArrivalResultItem(
            id: a.id,
            clientId: a.id,
            status: 'accepted',
            retryable: false,
            visitId: a.id,
            receivedAt: DateTime.utc(2026, 11, 9, 8, 0, 0),
          ),
      ],
    );
  }
}

void main() {
  late Directory tempDir;
  late CheckpointArrivalStore store;
  late MockApi api;
  final now = DateTime.utc(2026, 11, 9, 8, 0, 0);

  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('sync_test_');
    store = FileCheckpointArrivalStore('user-1', root: tempDir);
    api = MockApi();
  });

  tearDown(() async {
    if (await tempDir.exists()) {
      await tempDir.delete(recursive: true);
    }
  });

  LocalCheckpointArrival createArrival(String id, {int attempts = 0}) =>
      LocalCheckpointArrival(
        id: id,
        tripId: 'trip-1',
        checkpointId: 'cp-$id',
        routeId: 'r-1',
        routeVersion: 'v1',
        packageId: 'p-1',
        packageVersion: 'v1',
        detectedOffline: true,
        confirmedAt: now,
        attempts: attempts,
        samples: const [],
      );

  group('synchronizeCheckpointArrivals (Fault Tolerance & Edge Cases)', () {
    test('401 error: does NOT mark failed, does NOT burn attempts, preserves batch', () async {
      await store.update('trip-1', (cur) => cur.copyWith(arrivals: [createArrival('a1', attempts: 0)]));

      api.onSync = (tripId, arrivals) => throw ApiException('Unauthorized', statusCode: 401);

      await synchronizeCheckpointArrivals(
        tripId: 'trip-1',
        store: store,
        api: api,
        now: now,
        isOnline: true,
      );

      final record = await store.read('trip-1');
      expect(record.arrivals.first.syncState, equals(CheckpointSyncState.pending));
      expect(record.arrivals.first.attempts, equals(0)); // attempts KHÔNG bị tăng!
      expect(record.arrivals.first.lastError, contains('Chưa xác thực hoặc phiên hết hạn'));
    });

    test('network transport error: does NOT burn attempts, only delays nextRetryAt', () async {
      await store.update('trip-1', (cur) => cur.copyWith(arrivals: [createArrival('a1', attempts: 2)]));

      api.onSync = (tripId, arrivals) => throw ApiException('Connection timeout', kind: ApiExceptionKind.timeout);

      await synchronizeCheckpointArrivals(
        tripId: 'trip-1',
        store: store,
        api: api,
        now: now,
        isOnline: true,
      );

      final record = await store.read('trip-1');
      expect(record.arrivals.first.syncState, equals(CheckpointSyncState.pending));
      expect(record.arrivals.first.attempts, equals(2)); // attempts giữ nguyên, không đốt quota!
      expect(record.arrivals.first.nextRetryAt, isNotNull);
    });

    test('HTTP 429 / 500 error: increases attempts and pauses when exceeding 5 attempts', () async {
      await store.update('trip-1', (cur) => cur.copyWith(arrivals: [createArrival('a1', attempts: 4)]));

      api.onSync = (tripId, arrivals) => throw ApiException('Too many requests', statusCode: 429);

      await synchronizeCheckpointArrivals(
        tripId: 'trip-1',
        store: store,
        api: api,
        now: now,
        isOnline: true,
      );

      final record = await store.read('trip-1');
      expect(record.arrivals.first.syncState, equals(CheckpointSyncState.paused)); // Đạt 5 lần -> paused
      expect(record.arrivals.first.attempts, equals(5));
    });

    test('terminal HTTP 403 / 422: marks failed for review, does not delete blindly', () async {
      await store.update('trip-1', (cur) => cur.copyWith(arrivals: [createArrival('a1')]));

      api.onSync = (tripId, arrivals) => throw ApiException('Forbidden', statusCode: 403);

      await synchronizeCheckpointArrivals(
        tripId: 'trip-1',
        store: store,
        api: api,
        now: now,
        isOnline: true,
      );

      final record = await store.read('trip-1');
      expect(record.arrivals.first.syncState, equals(CheckpointSyncState.failed));
      expect(record.arrivals.first.lastError, contains('Lỗi HTTP 403'));
      expect(record.pendingQueue, isEmpty); // Đã rời queue gửi
    });

    test('missing clientId in response: treated as transient error with backoff and paused ceiling', () async {
      await store.update('trip-1', (cur) => cur.copyWith(arrivals: [createArrival('a1', attempts: 4)]));

      // Server trả về kết quả rỗng (thiếu clientId của a1)
      api.onSync = (tripId, arrivals) => const CheckpointArrivalSyncResponse(results: []);

      await synchronizeCheckpointArrivals(
        tripId: 'trip-1',
        store: store,
        api: api,
        now: now,
        isOnline: true,
      );

      final record = await store.read('trip-1');
      expect(record.arrivals.first.attempts, equals(5));
      expect(record.arrivals.first.syncState, equals(CheckpointSyncState.paused));
    });

    test('single-flight: concurrent calls execute only once', () async {
      await store.update('trip-1', (cur) => cur.copyWith(arrivals: [createArrival('a1')]));

      // Gọi đồng thời 2 lần synchronizeCheckpointArrivals
      final futures = await Future.wait([
        synchronizeCheckpointArrivals(tripId: 'trip-1', store: store, api: api, now: now, isOnline: true),
        synchronizeCheckpointArrivals(tripId: 'trip-1', store: store, api: api, now: now, isOnline: true),
      ]);

      expect(api.callCount, equals(1)); // Chỉ gọi API đúng 1 lần!
      expect(futures[0].syncedCount, equals(1));
      expect(futures[1].syncedCount, equals(1));
    });

    test('offline mode: returns immediately without sending or burning attempts', () async {
      await store.update('trip-1', (cur) => cur.copyWith(arrivals: [createArrival('a1')]));

      await synchronizeCheckpointArrivals(
        tripId: 'trip-1',
        store: store,
        api: api,
        now: now,
        isOnline: false, // Thiết bị đang offline
      );

      expect(api.callCount, equals(0)); // Không gọi mạng
      final record = await store.read('trip-1');
      expect(record.arrivals.first.attempts, equals(0)); // Không đốt attempts
    });
  });
}
