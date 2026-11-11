import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../../core/api/api_exception.dart';
import '../domain/gps_tracking_models.dart';
import 'gps_tracking_api.dart';

/// A server-confirmed decision survives tab disposal while offline. Never infer
/// eligibility from the presence of breadcrumbs or from package contents.
class CachedGpsTrackingApi implements GpsTrackingApi {
  CachedGpsTrackingApi(
    this.remote,
    this.userId, {
    FlutterSecureStorage? storage,
    DateTime Function()? clock,
  }) : storage = storage ?? const FlutterSecureStorage(),
       clock = clock ?? DateTime.now;
  final GpsTrackingApi remote;
  final String userId;
  final FlutterSecureStorage storage;
  final DateTime Function() clock;

  String _key(String trip) => 'gps_eligibility_${userId}_$trip';

  @override
  Future<GpsTrackingContext> context(String tripId) async {
    try {
      final value = await remote.context(tripId);
      if (value.tripId != tripId) {
        throw const FormatException('GPS trip mismatch');
      }
      try {
        if (value.eligible && value.startsAt != null && value.endsAt != null) {
          await storage.write(
            key: _key(tripId),
            value: jsonEncode({
              'tripId': value.tripId,
              'eligible': value.eligible,
              'reason': value.reason,
              'participantRole': value.participantRole,
              'samplingIntervalSeconds': value.samplingIntervalSeconds,
              'loggingIntervalSeconds': value.loggingIntervalSeconds,
              'configVersion': value.configVersion,
              'startsAt': value.startsAt!.toUtc().toIso8601String(),
              'endsAt': value.endsAt!.toUtc().toIso8601String(),
            }),
          );
        } else {
          await storage.delete(key: _key(tripId));
        }
      } catch (_) {
        // Storage failure must not invalidate a fresh authoritative decision.
      }
      return value;
    } on ApiException catch (error) {
      final offline =
          error.kind == ApiExceptionKind.network ||
          error.kind == ApiExceptionKind.timeout;
      if (!offline) {
        try {
          await storage.delete(key: _key(tripId));
        } catch (_) {}
        rethrow;
      }
      try {
        final raw = await storage.read(key: _key(tripId));
        if (raw != null) {
          final cached = GpsTrackingContext.fromJson(
            Map<String, Object?>.from(jsonDecode(raw) as Map),
          );
          final now = clock();
          if (cached.tripId == tripId &&
              cached.eligible &&
              cached.startsAt != null &&
              cached.endsAt != null &&
              !now.isBefore(cached.startsAt!) &&
              now.isBefore(cached.endsAt!) &&
              cached.samplingIntervalSeconds > 0 &&
              cached.loggingIntervalSeconds > 0) {
            return cached;
          }
        }
      } catch (_) {
        // Missing/corrupt local data is never permission to record.
      }
      rethrow;
    }
  }

  @override
  Future<List<GpsLogUploadResult>> upload(
    String tripId,
    List<LocalGpsLog> logs,
  ) => remote.upload(tripId, logs);
}
