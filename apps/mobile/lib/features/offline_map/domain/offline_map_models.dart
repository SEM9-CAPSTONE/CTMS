import 'dart:math';

import '../../gps_tracking/domain/gps_tracking_models.dart';

/// Ngưỡng độ chính xác GPS tối đa để coi tín hiệu là tốt (BR-236).
/// <= 20.0m là [GpsSignalQuality.good]; > 20.0m là [GpsSignalQuality.poor].
const double kPoorAccuracyThresholdMeters = 20.0;

/// Ngưỡng thời gian tối đa để một mẫu GPS được coi là còn mới (fresh).
/// Nếu mẫu cũ hơn 30s hoặc timestamp ở tương lai lệch quá [kGpsFutureSkewTolerance] thì [isStale] = true.
const Duration kGpsSampleStaleDuration = Duration(seconds: 30);

/// Dung sai độ lệch tối đa cho phép của timestamp GPS ở tương lai (do đồng hồ máy bị lệch nhẹ).
const Duration kGpsFutureSkewTolerance = Duration(seconds: 5);

/// Chu kỳ kiểm tra định kỳ trạng thái stale của GPS khi có sample hợp lệ.
const Duration kStaleCheckInterval = Duration(seconds: 5);

/// Giới hạn kích thước giải nén tối đa cho mỗi file payload trong package (chống ZIP bomb).
const int kMaxPayloadSizeBytes = 5 * 1024 * 1024; // 5 MB

/// Trạng thái gói dữ liệu ngoại tuyến của chuyến đi.
enum OfflineMapPackageStatus {
  loading,
  ready,
  packageMissing,
  packageInvalid,
  accessDenied,
}

/// Trạng thái phần cứng & quyền truy cập GPS của thiết bị.
enum OfflineMapGpsStatus {
  checking,
  ready,
  serviceDisabled,
  permissionDenied,
  permissionDeniedForever,
  unavailable,
}

/// Chất lượng tín hiệu định vị GPS suy ra từ sai số [accuracyMeters].
enum GpsSignalQuality {
  good,
  poor,
}

/// Một điểm tọa độ hợp lệ trên tuyến đường trekking.
class OfflineRoutePoint {
  const OfflineRoutePoint({
    required this.latitude,
    required this.longitude,
    this.altitudeMeters,
  });

  final double latitude;
  final double longitude;
  final double? altitudeMeters;

  /// Tạo điểm tọa độ từ mảng GeoJSON RFC 7946: `[longitude, latitude, elevation?]`.
  factory OfflineRoutePoint.fromGeoJsonCoordinate(List<Object?> coords) {
    if (coords.length < 2) {
      throw const FormatException('GeoJSON coordinate requires at least [longitude, latitude]');
    }
    final rawLon = coords[0];
    final rawLat = coords[1];
    if (rawLon is! num || rawLat is! num) {
      throw const FormatException('Coordinates must be numeric');
    }
    final lon = rawLon.toDouble();
    final lat = rawLat.toDouble();

    if (lon.isNaN || lon.isInfinite || lat.isNaN || lat.isInfinite) {
      throw const FormatException('Coordinates cannot be NaN or Infinite');
    }
    if (lat < -90.0 || lat > 90.0) {
      throw FormatException('Latitude out of range [-90, 90]: $lat');
    }
    if (lon < -180.0 || lon > 180.0) {
      throw FormatException('Longitude out of range [-180, 180]: $lon');
    }

    double? alt;
    if (coords.length >= 3 && coords[2] is num) {
      final rawAlt = (coords[2] as num).toDouble();
      if (!rawAlt.isNaN && !rawAlt.isInfinite) {
        alt = rawAlt;
      }
    }

    return OfflineRoutePoint(
      latitude: lat,
      longitude: lon,
      altitudeMeters: alt,
    );
  }

  /// Tính khoảng cách Haversine (mét) tới một điểm khác.
  double distanceTo(OfflineRoutePoint other) {
    const earthRadiusMeters = 6371000.0;
    final dLat = (other.latitude - latitude) * pi / 180.0;
    final dLon = (other.longitude - longitude) * pi / 180.0;
    final lat1 = latitude * pi / 180.0;
    final lat2 = other.latitude * pi / 180.0;

    final a = sin(dLat / 2) * sin(dLat / 2) +
        cos(lat1) * cos(lat2) * sin(dLon / 2) * sin(dLon / 2);
    final c = 2 * atan2(sqrt(a), sqrt(1 - a));
    return earthRadiusMeters * c;
  }
}

/// Hình học tuyến đường ngoại tuyến được phân tích từ `route.geojson`.
class OfflineRouteGeometry {
  const OfflineRouteGeometry({
    required this.routeId,
    this.fingerprint,
    required this.points,
  });

  final String routeId;
  final String? fingerprint;
  final List<OfflineRoutePoint> points;

  factory OfflineRouteGeometry.fromGeoJson(Map<String, Object?> json) {
    final type = json['type'];
    if (type != 'Feature') {
      throw const FormatException('route.geojson must be a GeoJSON Feature');
    }
    final properties = json['properties'];
    final routeId = (properties is Map<String, Object?> ? properties['routeId'] : null) as String?;
    if (routeId == null || routeId.isEmpty) {
      throw const FormatException('route.geojson properties missing routeId');
    }
    final fingerprint = properties is Map<String, Object?> ? properties['fingerprint'] as String? : null;

    final geometry = json['geometry'];
    if (geometry is! Map<String, Object?> || geometry['type'] != 'LineString') {
      throw const FormatException('route.geojson geometry must be LineString');
    }
    final rawCoords = geometry['coordinates'];
    if (rawCoords is! List || rawCoords.length < 2) {
      throw const FormatException('Route LineString must contain at least 2 points');
    }

    final points = <OfflineRoutePoint>[];
    for (final raw in rawCoords) {
      if (raw is! List) {
        throw const FormatException('Coordinate must be a list');
      }
      points.add(OfflineRoutePoint.fromGeoJsonCoordinate(raw));
    }

    return OfflineRouteGeometry(
      routeId: routeId,
      fingerprint: fingerprint,
      points: List.unmodifiable(points),
    );
  }

  double get minLatitude => points.map((p) => p.latitude).reduce(min);
  double get maxLatitude => points.map((p) => p.latitude).reduce(max);
  double get minLongitude => points.map((p) => p.longitude).reduce(min);
  double get maxLongitude => points.map((p) => p.longitude).reduce(max);

  double get centerLatitude => (minLatitude + maxLatitude) / 2.0;
  double get centerLongitude => (minLongitude + maxLongitude) / 2.0;
}

/// Một trạm kiểm tra ngoại tuyến từ `checkpoints.json`.
class OfflineMapCheckpoint {
  const OfflineMapCheckpoint({
    required this.id,
    required this.routeId,
    required this.name,
    required this.type,
    required this.latitude,
    required this.longitude,
    required this.radiusMeters,
    this.instructions,
    this.routePosition,
    this.expectedArrivalOffset,
  });

  final String id;
  final String routeId;
  final String name;
  final String type;
  final double latitude;
  final double longitude;
  final double radiusMeters;
  final String? instructions;
  final int? routePosition;
  final int? expectedArrivalOffset;

  factory OfflineMapCheckpoint.fromJson(Map<String, Object?> json) {
    final id = json['id'];
    final routeId = json['routeId'];
    final name = json['name'];
    final type = json['type'];
    final radiusMeters = json['radiusMeters'];

    if (id is! String || routeId is! String || name is! String || type is! String) {
      throw const FormatException('Checkpoint missing mandatory string fields');
    }
    final radius = (radiusMeters is num) ? radiusMeters.toDouble() : 20.0;
    if (radius.isNaN || radius.isInfinite || radius <= 0) {
      throw const FormatException('Invalid checkpoint radiusMeters');
    }

    final location = json['location'];
    if (location is! Map<String, Object?> || location['type'] != 'Point') {
      throw const FormatException('Checkpoint location must be GeoJSON Point');
    }
    final coords = location['coordinates'];
    if (coords is! List || coords.length < 2) {
      throw const FormatException('Checkpoint Point location coordinates invalid');
    }

    final rawLon = coords[0];
    final rawLat = coords[1];
    if (rawLon is! num || rawLat is! num) {
      throw const FormatException('Checkpoint coordinates must be numeric');
    }
    final lon = rawLon.toDouble();
    final lat = rawLat.toDouble();
    if (lon.isNaN || lon.isInfinite || lat.isNaN || lat.isInfinite) {
      throw const FormatException('Checkpoint coordinates cannot be NaN or Infinite');
    }
    if (lat < -90.0 || lat > 90.0 || lon < -180.0 || lon > 180.0) {
      throw const FormatException('Checkpoint coordinates out of geographical range');
    }

    return OfflineMapCheckpoint(
      id: id,
      routeId: routeId,
      name: name,
      type: type,
      latitude: lat,
      longitude: lon,
      radiusMeters: radius,
      instructions: json['instructions'] as String?,
      routePosition: (json['routePosition'] as num?)?.toInt(),
      expectedArrivalOffset: (json['expectedArrivalOffset'] as num?)?.toInt(),
    );
  }
}

/// Dữ liệu toàn vẹn của gói bản đồ ngoại tuyến đã được xác thực cho chuyến đi.
class OfflineMapContext {
  const OfflineMapContext({
    required this.tripId,
    required this.packageVersion,
    required this.packageId,
    required this.route,
    required this.checkpoints,
  });

  final String tripId;
  final int packageVersion;
  final String packageId;
  final OfflineRouteGeometry route;
  final List<OfflineMapCheckpoint> checkpoints;
}

/// Trạng thái định vị GPS hiện tại trên bản đồ.
class OfflineMapLocationState {
  const OfflineMapLocationState({
    this.sample,
    this.status = OfflineMapGpsStatus.checking,
    this.errorMessage,
  });

  final GpsSample? sample;
  final OfflineMapGpsStatus status;
  final String? errorMessage;

  /// Đánh giá chất lượng tín hiệu dựa trên [accuracyMeters].
  GpsSignalQuality? get quality {
    if (sample == null || status != OfflineMapGpsStatus.ready) return null;
    return sample!.accuracyMeters <= kPoorAccuracyThresholdMeters
        ? GpsSignalQuality.good
        : GpsSignalQuality.poor;
  }

  /// Kiểm tra xem mẫu GPS có bị trễ/cũ (stale) hoặc timestamp tương lai bất thường hay không.
  bool isStale(DateTime now) {
    if (sample == null) return false;
    final diff = now.difference(sample!.capturedAt);
    if (diff.isNegative) {
      return diff.abs() > kGpsFutureSkewTolerance;
    }
    return diff > kGpsSampleStaleDuration;
  }

  OfflineMapLocationState copyWith({
    GpsSample? sample,
    bool clearSample = false,
    OfflineMapGpsStatus? status,
    String? errorMessage,
    bool clearError = false,
  }) {
    return OfflineMapLocationState(
      sample: clearSample ? null : (sample ?? this.sample),
      status: status ?? this.status,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

/// Trạng thái tổng thể kết hợp của Bản đồ Ngoại tuyến (cho CTMS-308 UI).
class OfflineMapState {
  const OfflineMapState({
    required this.tripId,
    this.packageStatus = OfflineMapPackageStatus.loading,
    this.context,
    this.location = const OfflineMapLocationState(),
    this.errorMessage,
  });

  final String tripId;
  final OfflineMapPackageStatus packageStatus;
  final OfflineMapContext? context;
  final OfflineMapLocationState location;
  final String? errorMessage;

  /// Đã có dữ liệu tuyến & trạm kiểm tra hợp lệ để vẽ bản đồ
  bool get hasUsableMap =>
      packageStatus == OfflineMapPackageStatus.ready && context != null;

  /// Đã có vị trí GPS thật từ thiết bị
  bool get hasGpsFix => location.status == OfflineMapGpsStatus.ready && location.sample != null;

  OfflineMapState copyWith({
    OfflineMapPackageStatus? packageStatus,
    OfflineMapContext? context,
    bool clearContext = false,
    OfflineMapLocationState? location,
    String? errorMessage,
    bool clearError = false,
  }) {
    return OfflineMapState(
      tripId: tripId,
      packageStatus: packageStatus ?? this.packageStatus,
      context: clearContext ? null : (context ?? this.context),
      location: location ?? this.location,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

