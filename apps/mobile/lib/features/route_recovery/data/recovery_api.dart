import '../../../core/api/api_client.dart';
import '../../../core/api/api_endpoints.dart';
import '../domain/recovery_state.dart';

class RecoveryConfirmation {
  const RecoveryConfirmation(this.evidence, this.observedAt);
  final RecoveryEvidence evidence;
  final DateTime observedAt;
}

abstract interface class RecoveryApi {
  Future<RecoveryConfirmation> check(RecoveryBinding binding);
}

class HttpRecoveryApi implements RecoveryApi {
  HttpRecoveryApi(this.client);
  final ApiClient client;
  @override
  Future<RecoveryConfirmation> check(RecoveryBinding binding) async {
    final context = binding.context;
    final response = await client.get<Map<String, Object?>>(
      ApiEndpoints.trips.routeRecoveryContext(context.tripId),
      queryParameters: {
        'packageId': context.packageId,
        'packageVersion': context.packageVersion,
      },
    );
    return parseRecoveryConfirmation(binding, response.data!);
  }
}

RecoveryConfirmation parseRecoveryConfirmation(
  RecoveryBinding binding,
  Map<String, Object?> body,
) {
  final context = binding.context;
  final requested = body['requested'];
  if (body['tripId'] != context.tripId ||
      requested is! Map ||
      requested['packageId'] != context.packageId ||
      requested['packageVersion'] != context.packageVersion) {
    throw const FormatException('Recovery identity mismatch');
  }
  final status = switch (body['status']) {
    'AVAILABLE' => RecoveryEvidence.available,
    'STALE' => RecoveryEvidence.stale,
    'MISMATCH' => RecoveryEvidence.mismatch,
    'UNAVAILABLE' when body['reason'] == 'ARTIFACT_UNAVAILABLE' =>
      RecoveryEvidence.artifactInvalid,
    'UNAVAILABLE' => RecoveryEvidence.unavailable,
    _ => throw const FormatException('Unsupported recovery status'),
  };
  if (status == RecoveryEvidence.available ||
      status == RecoveryEvidence.stale) {
    final package = body['package'];
    final geometry = body['geometry'];
    final conventions = body['conventions'];
    if (package is! Map ||
        package['id'] != context.packageId ||
        package['version'] != context.packageVersion ||
        package['sha256'] != context.packageSha256 ||
        package['routeId'] != context.route.routeId ||
        package['routeFingerprint'] != context.route.fingerprint ||
        geometry is! Map ||
        geometry['type'] != 'LineString' ||
        geometry['coordinates'] is! List ||
        conventions is! Map ||
        conventions['coordinateSystem'] != 'EPSG:4326' ||
        conventions['coordinateOrder'] != 'longitude,latitude' ||
        conventions['distanceUnit'] != 'metre' ||
        conventions['bearingReference'] != 'true-north-clockwise' ||
        conventions['bearingRange'] != '[0,360)') {
      throw const FormatException('Recovery contract mismatch');
    }
    final coordinates = geometry['coordinates'] as List;
    if (coordinates.length != context.route.points.length) {
      throw const FormatException('Recovery geometry mismatch');
    }
    for (var i = 0; i < coordinates.length; i++) {
      final p = coordinates[i];
      final local = context.route.points[i];
      if (p is! List ||
          p.length != 2 ||
          p[0] != local.longitude ||
          p[1] != local.latitude) {
        throw const FormatException('Recovery geometry mismatch');
      }
    }
  }
  final timestamp = body['observedAt'];
  final observedAt = timestamp is String ? DateTime.tryParse(timestamp) : null;
  if (observedAt == null) {
    throw const FormatException('Recovery observation time missing');
  }
  return RecoveryConfirmation(status, observedAt.toUtc());
}
