import 'dart:math';

import '../../../core/api/api_exception.dart';
import '../../gps_tracking/application/gps_log_sync.dart';
import '../data/route_deviation_api.dart';
import '../data/route_deviation_store.dart';
import '../domain/route_deviation_models.dart';

/// Server maximum per upload (`POST /trips/:tripId/safety-events`).
const safetyEventUploadBatchSize = 100;

/// Uploads due pending safety events of one Trip and records each outcome locally.
/// `accepted`/`duplicate` mark the event synced; `rejected` is final (failed, with
/// the server reason); a transport error keeps it pending with backoff (BR-245).
Future<RouteDeviationRecord> synchronizeSafetyEvents({
  required String tripId,
  required RouteDeviationStore store,
  required RouteDeviationApi api,
  required DateTime now,
}) async {
  var record = await store.read(tripId);
  final due = record.events.where((event) => event.isDueForSync(now)).toList();
  Future<void> save(Map<String, LocalSafetyEvent> updates) async {
    record = await store.update(
      tripId,
      (current) => current.copyWith(
        events: [for (final event in current.events) updates[event.id] ?? event],
      ),
    );
  }

  for (var start = 0; start < due.length; start += safetyEventUploadBatchSize) {
    final batch = due.sublist(start, min(start + safetyEventUploadBatchSize, due.length));
    final updates = <String, LocalSafetyEvent>{};
    try {
      final results = await api.upload(tripId, batch);
      final byId = {for (final result in results) result.id: result};
      for (final event in batch) {
        final result = byId[event.id];
        if (result == null) continue;
        updates[event.id] = result.status == 'rejected'
            ? event.delivery(
                syncState: SafetyEventSyncState.failed,
                rejectionReason: result.reason,
                attempts: event.attempts + 1,
              )
            : event.delivery(syncState: SafetyEventSyncState.synced, attempts: event.attempts + 1);
      }
    } catch (error) {
      final retryable = isRetryableGpsUploadError(error);
      final message = error is ApiException ? error.message : 'Không thể kết nối máy chủ. Sẽ thử lại.';
      for (final event in batch) {
        updates[event.id] = event.delivery(
          syncState: retryable ? SafetyEventSyncState.pending : SafetyEventSyncState.failed,
          attempts: event.attempts + 1,
          nextAttemptAt: retryable
              ? now.add(Duration(seconds: min(300, 5 * pow(2, min(event.attempts, 6)).toInt())))
              : null,
          error: message,
        );
      }
      await save(updates);
      if (retryable) break;
      continue;
    }
    await save(updates);
  }
  return record;
}
