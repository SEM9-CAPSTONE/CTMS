import '../../../core/api/api_exception.dart';
import '../data/sos_api.dart';
import '../domain/sos_alert.dart';

bool isRetryableSosError(Object error) {
  if (error is! ApiException) return true;
  final status = error.statusCode;
  return status == null ||
      status == 401 ||
      status == 408 ||
      status == 429 ||
      status >= 500;
}

Future<LocalSosAlert> synchronizeSosAlert(
  LocalSosAlert record,
  SosApi api,
  DateTime now, {
  bool Function()? isActive,
}) async {
  if (record.syncState == SosSyncState.synced) return record;
  if (isActive?.call() == false) return record;

  try {
    final serverAlert = await api.create(
      record.tripId,
      id: record.id,
      emergencyType: record.emergencyType,
      notes: record.notes,
      latitude: record.location?.latitude,
      longitude: record.location?.longitude,
      batteryLevel: record.batteryLevel,
      eventTime: record.eventTime,
    );

    return record.delivery(
      syncState: SosSyncState.synced,
      serverAlert: serverAlert,
      error: null,
      lastAttemptAt: now,
    );
  } catch (error) {
    final retryable = isRetryableSosError(error);
    final message = error is ApiException
        ? error.message
        : error.toString();

    return record.delivery(
      syncState: retryable ? SosSyncState.pending : SosSyncState.failed,
      attempts: record.attempts + 1,
      error: message,
      lastAttemptAt: now,
    );
  }
}
