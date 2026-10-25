import 'dart:math';

import '../../../core/api/api_exception.dart';
import '../data/gps_log_store.dart';
import '../data/gps_tracking_api.dart';
import '../domain/gps_tracking_models.dart';

/// Server maximum per upload (`POST /trips/:tripId/gps-logs`).
const gpsLogUploadBatchSize = 100;

bool isRetryableGpsUploadError(Object error) {
  if (error is! ApiException) return true;
  final status = error.statusCode;
  return status == null || status == 401 || status == 408 || status == 429 || status >= 500;
}

/// Uploads due pending logs of one Trip and records each outcome locally.
/// `accepted`/`duplicate` mark the log synced; `rejected` is final (failed, with
/// the server reason); a transport error keeps it pending with backoff.
Future<List<LocalGpsLog>> synchronizeGpsLogs({
  required String tripId,
  required GpsLogStore store,
  required GpsTrackingApi api,
  required DateTime now,
}) async {
  var logs = await store.read(tripId);
  final due = logs.where((log) => log.isDueForSync(now)).toList();
  Future<void> record(Map<String, LocalGpsLog> updates) async {
    logs = await store.update(
      tripId,
      (current) => [for (final log in current) updates[log.id] ?? log],
    );
  }

  for (var start = 0; start < due.length; start += gpsLogUploadBatchSize) {
    final batch = due.sublist(start, min(start + gpsLogUploadBatchSize, due.length));
    final updates = <String, LocalGpsLog>{};
    try {
      final results = await api.upload(tripId, batch);
      final byId = {for (final result in results) result.id: result};
      for (final log in batch) {
        final result = byId[log.id];
        if (result == null) continue;
        updates[log.id] = result.status == 'rejected'
            ? log.delivery(
                syncState: GpsLogSyncState.failed,
                rejectionReason: result.reason,
                attempts: log.attempts + 1,
              )
            : log.delivery(syncState: GpsLogSyncState.synced, attempts: log.attempts + 1);
      }
    } catch (error) {
      final retryable = isRetryableGpsUploadError(error);
      final message = error is ApiException ? error.message : 'Không thể kết nối máy chủ. Sẽ thử lại.';
      for (final log in batch) {
        updates[log.id] = log.delivery(
          syncState: retryable ? GpsLogSyncState.pending : GpsLogSyncState.failed,
          attempts: log.attempts + 1,
          nextAttemptAt: retryable
              ? now.add(Duration(seconds: min(300, 5 * pow(2, min(log.attempts, 6)).toInt())))
              : null,
          error: message,
        );
      }
      await record(updates);
      if (retryable) break;
      continue;
    }
    await record(updates);
  }
  return logs;
}
