import 'dart:math';

import '../../../core/api/api_exception.dart';
import '../data/checkpoint_arrival_api.dart';
import '../data/checkpoint_arrival_store.dart';
import '../domain/checkpoint_arrival_models.dart';

/// Single-flight lock theo từng tripId để chống chạy trùng đồng bộ song song.
final Map<String, Future<CheckpointArrivalRecord>> _inFlightSync = {};

/// Các mã HTTP chắc chắn là lỗi vĩnh viễn (dữ liệu sai cú pháp, không có quyền).
const Set<int> _terminalHttpStatusCodes = {400, 403, 422};

/// Điều phối đồng bộ các bản ghi checkpoint arrival của một chuyến đi lên máy chủ.
Future<CheckpointArrivalRecord> synchronizeCheckpointArrivals({
  required String tripId,
  required CheckpointArrivalStore store,
  required CheckpointArrivalApi api,
  required DateTime now,
  bool isOnline = true,
}) async {
  // 1. Chống chạy trùng (Single-flight): Nếu đang có lượt sync cho tripId này, chờ lượt đó
  if (_inFlightSync.containsKey(tripId)) {
    return _inFlightSync[tripId]!;
  }

  final syncOperation = _executeSync(
    tripId: tripId,
    store: store,
    api: api,
    now: now,
    isOnline: isOnline,
  );

  _inFlightSync[tripId] = syncOperation;
  try {
    return await syncOperation;
  } finally {
    _inFlightSync.remove(tripId);
  }
}

Future<CheckpointArrivalRecord> _executeSync({
  required String tripId,
  required CheckpointArrivalStore store,
  required CheckpointArrivalApi api,
  required DateTime now,
  required bool isOnline,
}) async {
  var record = await store.read(tripId);
  if (!isOnline) {
    // Không có mạng -> Không cố gửi để tránh đốt phí ngân sách attempts
    return record;
  }

  final due = record.dueQueue;
  if (due.isEmpty) return record;

  // 2. Chia lô tối đa 100 bản ghi, gửi lần lượt hết các lô trong cùng một đợt sync:
  for (var start = 0; start < due.length; start += checkpointArrivalBatchSize) {
    final batch = due.sublist(start, min(start + checkpointArrivalBatchSize, due.length));
    final fieldUpdates = <String, LocalCheckpointArrival Function(LocalCheckpointArrival current)>{};

    try {
      final response = await api.syncBatch(tripId: tripId, arrivals: batch);
      final byClientId = {for (final r in response.results) r.clientId: r};

      for (final arrival in batch) {
        final result = byClientId[arrival.id];

        if (result == null || (result.status != 'accepted' && result.status != 'duplicate' && result.status != 'rejected')) {
          // Kết quả thiếu clientId hoặc status lạ -> coi là lỗi tạm thời, có backoff và trần paused
          final nextAttempts = arrival.attempts + 1;
          final delay = calculateCheckpointBackoff(nextAttempts);
          fieldUpdates[arrival.id] = (cur) => cur.copyWith(
            attempts: nextAttempts,
            syncState: nextAttempts >= 5 ? CheckpointSyncState.paused : CheckpointSyncState.pending,
            nextRetryAt: now.add(delay),
            lastError: 'Máy chủ phản hồi thiếu mã bản ghi hoặc trạng thái không hợp lệ',
          );
          continue;
        }

        if (result.isAccepted || result.isDuplicate) {
          // Server xác nhận thành công
          fieldUpdates[arrival.id] = (cur) => cur.copyWith(
            syncState: CheckpointSyncState.synced,
            serverVisitId: result.visitId,
            serverReceivedAt: result.receivedAt ?? now,
            lastError: null,
          );
        } else if (result.isRejected) {
          final nextAttempts = arrival.attempts + 1;
          if (result.retryable) {
            // Lỗi tạm thời (processing_error) -> backoff (5s..60s), sau 5 lần thì paused
            final delay = calculateCheckpointBackoff(nextAttempts);
            fieldUpdates[arrival.id] = (cur) => cur.copyWith(
              attempts: nextAttempts,
              syncState: nextAttempts >= 5 ? CheckpointSyncState.paused : CheckpointSyncState.pending,
              nextRetryAt: now.add(delay),
              lastError: 'Lỗi máy chủ tạm thời: ${result.reason?.wireValue ?? "processing_error"}',
              rejectionReason: result.reason,
            );
          } else {
            // Lỗi vĩnh viễn (threshold_not_met, id_conflict) -> Rời khỏi queue gửi, nhưng giữ trên đĩa
            fieldUpdates[arrival.id] = (cur) => cur.copyWith(
              attempts: nextAttempts,
              syncState: CheckpointSyncState.failed,
              rejectionReason: result.reason,
              lastError: 'Từ chối vĩnh viễn: ${result.reason?.wireValue}',
            );
          }
        }
      }
    } on CheckpointContextNotReadyException {
      // HTTP 409: Ngữ cảnh chưa sẵn sàng -> Giữ nguyên toàn bộ lô trong queue, không tăng attempts
      break;
    } on ApiException catch (e) {
      final statusCode = e.statusCode;

      if (statusCode != null && _terminalHttpStatusCodes.contains(statusCode)) {
        // Lỗi 400, 403, 422: Đánh dấu failed để xem xét, không xóa mù quáng
        for (final arrival in batch) {
          fieldUpdates[arrival.id] = (cur) => cur.copyWith(
            attempts: arrival.attempts + 1,
            syncState: CheckpointSyncState.failed,
            lastError: 'Lỗi HTTP $statusCode: ${e.message}',
          );
        }
      } else if (statusCode == 401) {
        // 401: Phiên hết hạn (refresh token không thành công) -> Dừng đồng bộ, giữ nguyên batch, KHÔNG tăng attempts
        for (final arrival in batch) {
          fieldUpdates[arrival.id] = (cur) => cur.copyWith(
            nextRetryAt: now.add(const Duration(seconds: 30)),
            lastError: 'Chưa xác thực hoặc phiên hết hạn. Chờ đăng nhập lại.',
          );
        }
        await _applyFieldUpdates(store, tripId, fieldUpdates);
        break; // Dừng lô này
      } else if (e.kind == ApiExceptionKind.network || e.kind == ApiExceptionKind.timeout) {
        // Mất mạng hoặc timeout: KHÔNG đốt số lần thử (attempts), chỉ lùi nextRetryAt
        final backoffDelay = calculateCheckpointBackoff(batch.first.attempts);
        for (final arrival in batch) {
          fieldUpdates[arrival.id] = (cur) => cur.copyWith(
            nextRetryAt: now.add(backoffDelay),
            lastError: e.message,
          );
        }
        await _applyFieldUpdates(store, tripId, fieldUpdates);
        break;
      } else {
        // Lỗi 408, 429, 5xx: Máy chủ có phản hồi lỗi -> Tăng attempts và backoff
        for (final arrival in batch) {
          final nextAttempts = arrival.attempts + 1;
          fieldUpdates[arrival.id] = (cur) => cur.copyWith(
            attempts: nextAttempts,
            syncState: nextAttempts >= 5 ? CheckpointSyncState.paused : CheckpointSyncState.pending,
            nextRetryAt: now.add(calculateCheckpointBackoff(nextAttempts)),
            lastError: 'Lỗi máy chủ HTTP $statusCode: ${e.message}',
          );
        }
        await _applyFieldUpdates(store, tripId, fieldUpdates);
        break;
      }
    } catch (unhandledError) {
      // Ngoại lệ không xác định (JSON parse, TypeError) -> Ghi log, tăng attempts để không nghẽn
      for (final arrival in batch) {
        final nextAttempts = arrival.attempts + 1;
        fieldUpdates[arrival.id] = (cur) => cur.copyWith(
          attempts: nextAttempts,
          syncState: nextAttempts >= 5 ? CheckpointSyncState.paused : CheckpointSyncState.pending,
          nextRetryAt: now.add(calculateCheckpointBackoff(nextAttempts)),
          lastError: 'Lỗi cục bộ không xác định: $unhandledError',
        );
      }
    }

    record = await _applyFieldUpdates(store, tripId, fieldUpdates);
  }

  return record;
}

/// Áp dụng các thay đổi từng trường lên bản ghi hiện tại mà không ghi đè các arrival mới vừa thêm.
Future<CheckpointArrivalRecord> _applyFieldUpdates(
  CheckpointArrivalStore store,
  String tripId,
  Map<String, LocalCheckpointArrival Function(LocalCheckpointArrival current)> updates,
) {
  if (updates.isEmpty) return store.read(tripId);
  return store.update(tripId, (current) {
    final updatedArrivals = current.arrivals.map((a) {
      final transform = updates[a.id];
      return transform != null ? transform(a) : a;
    }).toList();
    return current.copyWith(arrivals: updatedArrivals);
  });
}

