import '../../offline_map/domain/offline_map_models.dart';
import '../../route_deviation/domain/route_deviation_detector.dart';
import 'recovery_geometry.dart';

enum RecoveryEvidence {
  artifactInvalid,
  checking,
  available,
  stale,
  mismatch,
  unavailable,
  offline,
  unverified,
  restricted,
  error,
}

enum RecoveryDisplay {
  artifactInvalid,
  loading,
  packageMissing,
  restricted,
  staleRoute,
  mismatch,
  unavailable,
  serverError,
  unverified,
  gpsMissing,
  gpsStale,
  gpsPoor,
  contextMismatch,
  notOffRoute,
  ready,
  offlineReady,
}

class RecoveryInput {
  const RecoveryInput(
    this.map, {
    this.offRoute = false,
    this.detectionActive = false,
    this.detectionRouteId,
    this.detectionCoordinates = const [],
  });
  final OfflineMapState map;
  final bool offRoute;
  final bool detectionActive;
  final String? detectionRouteId;
  final List<List<double>> detectionCoordinates;
  bool get matchesDetector {
    final route = map.context?.route;
    if (route == null ||
        route.routeId != detectionRouteId ||
        route.points.length != detectionCoordinates.length) {
      return false;
    }
    for (var i = 0; i < route.points.length; i++) {
      final p = detectionCoordinates[i];
      if (p.length < 2 ||
          p[0] != route.points[i].longitude ||
          p[1] != route.points[i].latitude) {
        return false;
      }
    }
    return true;
  }
}

class RecoveryBinding {
  RecoveryBinding(this.context);
  final OfflineMapContext context;
  String get key =>
      '${context.tripId}:${context.packageId}:${context.packageVersion}:${context.packageSha256}:${context.route.fingerprint}';
  bool get valid =>
      context.packageVersion > 0 &&
      context.packageId.isNotEmpty &&
      RegExp(r'^[a-f0-9]{64}$').hasMatch(context.packageSha256 ?? '') &&
      RegExp(r'^[a-f0-9]{64}$').hasMatch(context.route.fingerprint ?? '');
}

/// Single decision table, used by the card and map overlay. Never mutates a detector.
RecoveryDisplay decideRecovery(
  RecoveryInput input,
  RecoveryEvidence evidence,
  DateTime now,
) {
  if (evidence == RecoveryEvidence.restricted ||
      input.map.packageStatus == OfflineMapPackageStatus.accessDenied) {
    return RecoveryDisplay.restricted;
  }
  if (input.map.packageStatus == OfflineMapPackageStatus.loading) {
    return RecoveryDisplay.loading;
  }
  if (input.map.packageStatus == OfflineMapPackageStatus.packageInvalid) {
    return RecoveryDisplay.artifactInvalid;
  }
  if (!input.map.hasUsableMap) return RecoveryDisplay.packageMissing;
  switch (evidence) {
    case RecoveryEvidence.artifactInvalid:
      return RecoveryDisplay.artifactInvalid;
    case RecoveryEvidence.checking:
      return RecoveryDisplay.loading;
    case RecoveryEvidence.stale:
      return RecoveryDisplay.staleRoute;
    case RecoveryEvidence.mismatch:
      return RecoveryDisplay.mismatch;
    case RecoveryEvidence.unavailable:
      return RecoveryDisplay.unavailable;
    case RecoveryEvidence.error:
      return RecoveryDisplay.serverError;
    case RecoveryEvidence.unverified:
      return RecoveryDisplay.unverified;
    case RecoveryEvidence.restricted:
      return RecoveryDisplay.restricted;
    case RecoveryEvidence.available:
    case RecoveryEvidence.offline:
      break;
  }
  final location = input.map.location;
  final sample = location.sample;
  if (location.status != OfflineMapGpsStatus.ready ||
      sample == null ||
      !RecoveryPoint(sample.latitude, sample.longitude).valid ||
      !sample.accuracyMeters.isFinite ||
      sample.accuracyMeters < 0) {
    return RecoveryDisplay.gpsMissing;
  }
  if (location.isStale(now)) return RecoveryDisplay.gpsStale;
  if (sample.accuracyMeters > validSampleMaxAccuracyMeters) {
    return RecoveryDisplay.gpsPoor;
  }
  if (!input.matchesDetector) return RecoveryDisplay.contextMismatch;
  if (!input.detectionActive || !input.offRoute) {
    return RecoveryDisplay.notOffRoute;
  }
  return evidence == RecoveryEvidence.offline
      ? RecoveryDisplay.offlineReady
      : RecoveryDisplay.ready;
}

class RecoveryView {
  const RecoveryView(this.display, {this.target, this.observedAt});
  final RecoveryDisplay display;
  final RecoveryTarget? target;
  final DateTime? observedAt;
  bool get guides =>
      target != null &&
      (display == RecoveryDisplay.ready ||
          display == RecoveryDisplay.offlineReady);
}

/// Guidance validity is separate from GPS quality and checkpoint arrival status.
String? recoveryMapNotice(RecoveryDisplay state) => switch (state) {
  RecoveryDisplay.ready || RecoveryDisplay.notOffRoute => null,
  RecoveryDisplay.offlineReady =>
    'Tuyến đã lưu · Chưa xác thực lại với máy chủ',
  RecoveryDisplay.artifactInvalid => 'Thiếu/hỏng dữ liệu tuyến · Tạm ẩn hướng',
  RecoveryDisplay.staleRoute => 'Dữ liệu tuyến đã cũ · Tạm ẩn hướng',
  RecoveryDisplay.mismatch ||
  RecoveryDisplay.contextMismatch => 'Dữ liệu tuyến không khớp · Tạm ẩn hướng',
  RecoveryDisplay.gpsStale => 'GPS đã cũ · Tạm ẩn hướng',
  RecoveryDisplay.gpsPoor => 'GPS yếu · Tạm ẩn hướng',
  RecoveryDisplay.gpsMissing => 'Chưa có GPS · Chưa có hướng quay lại',
  RecoveryDisplay.loading => 'Đang xác thực tuyến',
  _ => 'Tuyến chưa dùng để hướng dẫn',
};
