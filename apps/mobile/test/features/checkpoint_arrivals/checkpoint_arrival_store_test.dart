import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/checkpoint_arrivals/data/checkpoint_arrival_store.dart';
import 'package:mobile/features/checkpoint_arrivals/domain/checkpoint_arrival_models.dart';

void main() {
  late Directory tempDir;

  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('checkpoint_store_test_');
  });

  tearDown(() async {
    if (await tempDir.exists()) {
      await tempDir.delete(recursive: true);
    }
  });

  LocalCheckpointArrival createSampleArrival({
    String id = 'arrival-1',
    String checkpointId = 'cp-1',
    CheckpointSyncState syncState = CheckpointSyncState.pending,
    int attempts = 0,
  }) {
    return LocalCheckpointArrival(
      id: id,
      tripId: 'trip-1',
      checkpointId: checkpointId,
      routeId: 'route-1',
      routeVersion: 'v1',
      packageId: 'pkg-1',
      packageVersion: 'v1',
      detectedOffline: true,
      confirmedAt: DateTime.utc(2026, 10, 26, 8, 0, 0),
      syncState: syncState,
      attempts: attempts,
      samples: const [
        CheckpointArrivalSample(
          eventTime: '2026-10-26T08:00:00.000Z',
          latitude: 15.91234567,
          longitude: 108.12345678,
          accuracyMeters: 10.0,
        ),
        CheckpointArrivalSample(
          eventTime: '2026-10-26T08:00:10.000Z',
          latitude: 15.91234567,
          longitude: 108.12345678,
          accuracyMeters: 10.0,
        ),
        CheckpointArrivalSample(
          eventTime: '2026-10-26T08:00:20.000Z',
          latitude: 15.91234567,
          longitude: 108.12345678,
          accuracyMeters: 10.0,
        ),
      ],
    );
  }

  group('CheckpointArrivalStore (Persistence, Accounts, and Queue Rules)', () {
    test('isolates records by userId on the same tripId', () async {
      final storeA = FileCheckpointArrivalStore('user-A', root: tempDir);
      final storeB = FileCheckpointArrivalStore('user-B', root: tempDir);

      final arrivalA = createSampleArrival(id: 'arr-A', checkpointId: 'cp-A');
      await storeA.update('trip-1', (current) => current.copyWith(arrivals: [arrivalA]));

      final readA = await storeA.read('trip-1');
      final readB = await storeB.read('trip-1');

      expect(readA.arrivals, hasLength(1));
      expect(readA.arrivals.first.id, equals('arr-A'));

      // user-B không bị lẫn bản ghi của user-A
      expect(readB.arrivals, isEmpty);
    });

    test('recovers persisted arrivals across new store instances (crash/restart simulation)', () async {
      final store1 = FileCheckpointArrivalStore('user-1', root: tempDir);
      final arrival = createSampleArrival(id: 'arr-saved');

      await store1.update('trip-1', (current) => current.copyWith(arrivals: [arrival]));

      // Tạo instance mới đọc lại từ ổ đĩa
      final store2 = FileCheckpointArrivalStore('user-1', root: tempDir);
      final read = await store2.read('trip-1');

      expect(read.arrivals, hasLength(1));
      expect(read.arrivals.first.id, equals('arr-saved'));
      expect(read.reachedCheckpointIds, contains('cp-1'));
    });

    test('exponential backoff calculations cap at 60s (5s..60s)', () {
      expect(calculateCheckpointBackoff(0), equals(const Duration(seconds: 5)));
      expect(calculateCheckpointBackoff(1), equals(const Duration(seconds: 10)));
      expect(calculateCheckpointBackoff(2), equals(const Duration(seconds: 20)));
      expect(calculateCheckpointBackoff(3), equals(const Duration(seconds: 40)));
      expect(calculateCheckpointBackoff(4), equals(const Duration(seconds: 60)));
      expect(calculateCheckpointBackoff(5), equals(const Duration(seconds: 60))); // capped
    });

    test('retention policy: pauses after 5 attempts without deleting, resumes on reset', () async {
      final store = FileCheckpointArrivalStore('user-1', root: tempDir);
      final arrival = createSampleArrival(id: 'arr-retry', attempts: 4);

      await store.update('trip-1', (current) => current.copyWith(arrivals: [arrival]));

      // Lần thứ 5 thất bại -> chuyển sang paused, giữ nguyên trên đĩa
      await store.update('trip-1', (current) {
        final updated = current.arrivals.map((a) {
          final nextAttempts = a.attempts + 1;
          return a.copyWith(
            attempts: nextAttempts,
            syncState: nextAttempts >= 5 ? CheckpointSyncState.paused : CheckpointSyncState.pending,
            nextRetryAt: DateTime.now().toUtc().add(calculateCheckpointBackoff(nextAttempts)),
          );
        }).toList();
        return current.copyWith(arrivals: updated);
      });

      final afterFail = await store.read('trip-1');
      expect(afterFail.arrivals, hasLength(1));
      expect(afterFail.arrivals.first.syncState, equals(CheckpointSyncState.paused));
      expect(afterFail.arrivals.first.attempts, equals(5));
      expect(afterFail.pendingQueue, isEmpty); // Tạm dừng khỏi hàng đợi gửi
      expect(afterFail.pausedCount, equals(1)); // Vẫn lưu trên máy an toàn!

      // Sự kiện phục hồi mạng / app restart / nút thử lại -> Reset budget
      await store.update('trip-1', (current) {
        final resetArrivals = current.arrivals.map((a) {
          if (a.syncState == CheckpointSyncState.paused) {
            return a.copyWith(
              syncState: CheckpointSyncState.pending,
              attempts: 0,
              nextRetryAt: null,
            );
          }
          return a;
        }).toList();
        return current.copyWith(arrivals: resetArrivals);
      });

      final afterReset = await store.read('trip-1');
      expect(afterReset.pendingQueue, hasLength(1));
      expect(afterReset.pendingQueue.first.attempts, equals(0));
    });

    test('terminal rejection (retryable: false) marks failed, preserved locally for user view', () async {
      final store = FileCheckpointArrivalStore('user-1', root: tempDir);
      final arrival = createSampleArrival(id: 'arr-terminal');

      await store.update('trip-1', (current) => current.copyWith(arrivals: [arrival]));

      await store.update('trip-1', (current) {
        final updated = current.arrivals.map((a) {
          return a.copyWith(
            syncState: CheckpointSyncState.failed,
            rejectionReason: CheckpointArrivalRejection.thresholdNotMet,
            lastError: 'Dữ liệu không đạt ngưỡng',
          );
        }).toList();
        return current.copyWith(arrivals: updated);
      });

      final read = await store.read('trip-1');
      expect(read.arrivals, hasLength(1));
      expect(read.arrivals.first.syncState, equals(CheckpointSyncState.failed));
      expect(read.arrivals.first.rejectionReason, equals(CheckpointArrivalRejection.thresholdNotMet));
      expect(read.pendingQueue, isEmpty); // Đã rời hàng đợi gửi để tránh nghẽn
      expect(read.failedCount, equals(1)); // Nhưng hiển thị được trên UI
    });

    test('fingerprint and payload byte reproducibility: matches SHA-256 verbatim', () {
      final arrival1 = createSampleArrival(id: 'arr-fp');
      final arrival2 = createSampleArrival(id: 'arr-fp');

      final fp1 = arrival1.calculateFingerprint();
      final fp2 = arrival2.calculateFingerprint();

      expect(fp1, equals(fp2));
      expect(fp1.length, equals(64)); // SHA-256 hex string

      // Kiểm tra toServerPayload giữ nguyên cấu trúc
      final payload = arrival1.toServerPayload();
      expect(payload['id'], equals('arr-fp'));
      expect(payload['checkpointId'], equals('cp-1'));
      expect(payload['detectedOffline'], isTrue);
      expect((payload['samples'] as List), hasLength(3));
    });
  });
}

