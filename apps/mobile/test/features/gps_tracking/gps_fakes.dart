import 'package:mobile/core/api/api_exception.dart';
import 'package:mobile/features/gps_tracking/application/gps_location_source.dart';
import 'package:mobile/features/gps_tracking/data/gps_log_store.dart';
import 'package:mobile/features/gps_tracking/data/gps_tracking_api.dart';
import 'package:mobile/features/gps_tracking/domain/gps_tracking_models.dart';

const tripId = '11111111-1111-4111-8111-111111111111';

GpsTrackingContext trackingContext({bool eligible = true, String? reason}) => GpsTrackingContext(
  tripId: tripId,
  eligible: eligible,
  reason: reason,
  participantRole: 'camper',
  samplingIntervalSeconds: 10,
  loggingIntervalSeconds: 30,
  configVersion: 'v3',
);

GpsSample sampleAt(DateTime capturedAt, {double latitude = 11.5, double longitude = 108.4}) =>
    GpsSample(
      capturedAt: capturedAt,
      latitude: latitude,
      longitude: longitude,
      accuracyMeters: 8,
      altitudeMeters: 1100,
    );

class MemoryGpsLogStore implements GpsLogStore {
  final Map<String, List<LocalGpsLog>> logs = {};

  @override
  Future<List<LocalGpsLog>> read(String tripId) async => List.of(logs[tripId] ?? const []);

  @override
  Future<List<LocalGpsLog>> update(
    String tripId,
    List<LocalGpsLog> Function(List<LocalGpsLog> current) transform,
  ) async {
    final next = transform(List.of(logs[tripId] ?? const []));
    logs[tripId] = next;
    return List.of(next);
  }
}

class FakeGpsTrackingApi implements GpsTrackingApi {
  GpsTrackingContext Function() contextResult = trackingContext;
  Object? contextError;

  /// Outcome per log id; missing ids are accepted.
  final Map<String, ({String status, String? reason})> outcomes = {};
  Object? uploadError;
  final List<List<LocalGpsLog>> uploads = [];

  @override
  Future<GpsTrackingContext> context(String tripId) async {
    if (contextError != null) throw contextError!;
    return contextResult();
  }

  @override
  Future<List<GpsLogUploadResult>> upload(String tripId, List<LocalGpsLog> logs) async {
    uploads.add(logs);
    if (uploadError != null) throw uploadError!;
    return [
      for (final log in logs)
        GpsLogUploadResult(
          id: log.id,
          status: outcomes[log.id]?.status ?? 'accepted',
          reason: outcomes[log.id]?.reason,
        ),
    ];
  }
}

class FakeLocationSource implements GpsLocationSource {
  GpsPermissionState permission = GpsPermissionState.granted;
  GpsPermissionState? afterRequest;
  GpsSample? next;
  Object? sampleError;
  int sampleCalls = 0;
  int requestCalls = 0;

  @override
  Future<GpsPermissionState> checkPermission() async => permission;

  @override
  Future<GpsPermissionState> requestPermission() async {
    requestCalls++;
    if (afterRequest != null) permission = afterRequest!;
    return permission;
  }

  @override
  Future<GpsSample> currentSample({required Duration timeLimit}) async {
    sampleCalls++;
    if (sampleError != null) throw sampleError!;
    if (next == null) throw StateError('no fix');
    return next!;
  }
}

ApiException offline() => ApiException('Không thể kết nối máy chủ.');

ApiException httpError(int status) => ApiException('Lỗi máy chủ', statusCode: status);
