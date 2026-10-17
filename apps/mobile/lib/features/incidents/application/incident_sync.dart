import 'dart:math';
import '../../../core/api/api_exception.dart';
import '../data/incidents_api.dart';
import '../domain/trip_incident.dart';

bool isRetryableIncidentError(Object error) {
  if (error is! ApiException) return true;
  final status = error.statusCode;
  return status == null ||
      status == 401 ||
      status == 408 ||
      status == 429 ||
      status >= 500;
}

Future<LocalIncident> synchronizeIncident(
  LocalIncident record,
  IncidentsApi api,
  DateTime now, {
  bool Function()? isActive,
}) async {
  var current = record;
  try {
    if (isActive?.call() == false) return current;
    if (current.syncState != IncidentSyncState.synced) {
      final server = await api.report(current.tripId, current.payload);
      current = current.delivery(
        sync: IncidentSyncState.synced,
        server: server,
        media: server['media'] != null
            ? IncidentMediaState.uploaded
            : current.mediaState,
      );
    }
    if (current.mediaState == IncidentMediaState.pending &&
        current.photo != null) {
      if (isActive?.call() == false) return current;
      final server = await api.upload(
        current.tripId,
        current.id,
        current.photo!,
      );
      current = current.delivery(
        media: IncidentMediaState.uploaded,
        server: server,
        clearPhoto: true,
      );
    }
    return current;
  } catch (error) {
    final retryable = isRetryableIncidentError(error);
    final parentSynced = current.syncState == IncidentSyncState.synced;
    return current.delivery(
      sync: retryable || parentSynced
          ? current.syncState
          : IncidentSyncState.failed,
      media: !retryable && parentSynced
          ? IncidentMediaState.failed
          : current.mediaState,
      attempts: current.attempts + 1,
      nextAttemptAt: retryable
          ? now.add(
              Duration(
                seconds: min(300, 5 * pow(2, min(current.attempts, 6)).toInt()),
              ),
            )
          : null,
      error: error is ApiException
          ? error.message
          : 'Không thể kết nối máy chủ. Sẽ thử lại.',
    );
  }
}
