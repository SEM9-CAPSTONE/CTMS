import 'dart:convert';
import 'dart:isolate';
import 'dart:typed_data';

import '../../offline_packages/data/package_download_store.dart';
import '../../offline_packages/data/package_integrity_service.dart';
import '../../offline_packages/data/package_integrity_verifier.dart';
import '../domain/offline_map_models.dart';

/// Lỗi xảy ra khi người dùng bị thu hồi quyền truy cập chuyến đi (cờ .access-denied).
class OfflineMapAccessDeniedException implements Exception {
  const OfflineMapAccessDeniedException([this.message = 'Quyền truy cập gói bản đồ bị từ chối.']);
  final String message;

  @override
  String toString() => 'OfflineMapAccessDeniedException: $message';
}

/// Lỗi xảy ra khi gói dữ liệu bị hỏng, hash sai, vượt quá 5MB hoặc GeoJSON không hợp lệ.
class OfflineMapPackageInvalidException implements Exception {
  const OfflineMapPackageInvalidException(this.message);
  final String message;

  @override
  String toString() => 'OfflineMapPackageInvalidException: $message';
}

/// Giao diện đọc dữ liệu gói bản đồ ngoại tuyến.
abstract interface class OfflineMapPackageReader {
  Future<OfflineMapContext?> readActivePackage(String tripId);
}

/// Hàm thuần chạy trong Isolate để phân tích cú pháp JSON & GeoJSON mà không block UI.
OfflineMapContext _parsePackagePayloads({
  required String tripId,
  required String packageId,
  required int packageVersion,
  required String routeRaw,
  required String checkpointsRaw,
  required String packageSha256,
}) {
  final Object? routeJson;
  final Object? checkpointsJson;
  try {
    routeJson = jsonDecode(routeRaw);
  } on FormatException catch (e) {
    throw OfflineMapPackageInvalidException('Lỗi định dạng route.geojson: ${e.message}');
  }

  try {
    checkpointsJson = jsonDecode(checkpointsRaw);
  } on FormatException catch (e) {
    throw OfflineMapPackageInvalidException('Lỗi định dạng checkpoints.json: ${e.message}');
  }

  if (routeJson is! Map<String, Object?>) {
    throw const OfflineMapPackageInvalidException('route.geojson phải là một đối tượng GeoJSON Feature');
  }
  if (checkpointsJson is! List) {
    throw const OfflineMapPackageInvalidException('checkpoints.json phải là danh sách');
  }

  final OfflineRouteGeometry route;
  try {
    route = OfflineRouteGeometry.fromGeoJson(routeJson);
  } on FormatException catch (e) {
    throw OfflineMapPackageInvalidException('Dữ liệu route.geojson không hợp lệ: ${e.message}');
  }

  final checkpoints = <OfflineMapCheckpoint>[];
  try {
    for (final item in checkpointsJson) {
      if (item is! Map<String, Object?>) {
        throw const FormatException('Mỗi checkpoint phải là JSON object');
      }
      checkpoints.add(OfflineMapCheckpoint.fromJson(item));
    }
  } on FormatException catch (e) {
    throw OfflineMapPackageInvalidException('Dữ liệu checkpoints.json không hợp lệ: ${e.message}');
  }

  return OfflineMapContext(
    tripId: tripId,
    packageVersion: packageVersion,
    packageId: packageId,
    route: route,
    checkpoints: List.unmodifiable(checkpoints),
    packageSha256: packageSha256,
  );
}

class DefaultOfflineMapPackageReader implements OfflineMapPackageReader {
  const DefaultOfflineMapPackageReader({
    required this.store,
    required this.integrity,
  });

  final PackageDownloadStore store;
  final PackageIntegrityService integrity;

  @override
  Future<OfflineMapContext?> readActivePackage(String tripId) async {
    // 1. Kiểm tra cờ .access-denied TRƯỚC TIÊN — Tuyệt đối không đụng tới file ZIP nếu bị từ chối
    if (await store.accessDenied(tripId)) {
      throw const OfflineMapAccessDeniedException();
    }

    // 2. Tìm package đang active cho tripId
    final active = await store.active(tripId);
    if (active == null) {
      return null; // Không có active package (packageMissing)
    }

    // Khóa chặt theo tripId: không bao giờ đọc chéo dữ liệu trip khác
    if (active.tripId != tripId) {
      throw const OfflineMapPackageInvalidException('Active package tripId không khớp với chuyến đi.');
    }

    // 3. Mở snapshot byte an toàn kèm kiểm tra hash SHA-256 toàn vẹn
    final opened = await integrity.openActivePackage(tripId);
    if (opened == null) {
      if (await store.accessDenied(tripId)) {
        throw const OfflineMapAccessDeniedException();
      }
      throw const OfflineMapPackageInvalidException('Không thể mở gói dữ liệu active hoặc hash không khớp.');
    }

    // 4. Giải nén trong bộ nhớ theo chuẩn schema 1 ZIP
    final Map<String, Uint8List> files;
    try {
      files = StoredPackageZip(opened.bytes).read();
    } on FormatException catch (e) {
      throw OfflineMapPackageInvalidException('Lỗi giải nén ZIP package: ${e.message}');
    }

    // 5. Kiểm tra sự tồn tại và giới hạn kích thước sau giải nén (Uncompressed Size <= 5MB)
    final routeBytes = files['route.geojson'];
    final checkpointsBytes = files['checkpoints.json'];

    if (routeBytes == null) {
      throw const OfflineMapPackageInvalidException('Gói dữ liệu thiếu file route.geojson.');
    }
    if (checkpointsBytes == null) {
      throw const OfflineMapPackageInvalidException('Gói dữ liệu thiếu file checkpoints.json.');
    }

    if (routeBytes.length > kMaxPayloadSizeBytes) {
      throw const OfflineMapPackageInvalidException(
        'route.geojson vượt quá giới hạn an toàn 5MB sau giải nén.',
      );
    }
    if (checkpointsBytes.length > kMaxPayloadSizeBytes) {
      throw const OfflineMapPackageInvalidException(
        'checkpoints.json vượt quá giới hạn an toàn 5MB sau giải nén.',
      );
    }

    // 6. Phân tích dữ liệu JSON & GeoJSON trong Isolate để không làm giật lag giao diện
    final routeRaw = utf8.decode(routeBytes);
    final checkpointsRaw = utf8.decode(checkpointsBytes);

    return Isolate.run(() => _parsePackagePayloads(
          tripId: tripId,
          packageId: opened.package.id,
          packageVersion: opened.package.packageVersion,
          routeRaw: routeRaw,
          checkpointsRaw: checkpointsRaw,
          packageSha256: opened.package.sha256,
        ));
  }
}
