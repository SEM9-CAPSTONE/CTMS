import 'dart:convert';
import 'dart:io';
import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:sqflite/sqflite.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/api_endpoints.dart';
import '../../auth/application/auth_controller.dart';
import '../domain/offline_package.dart';
import 'package_download_store.dart';
import 'device_package_storage_capacity.dart';
import 'package_storage_capacity.dart';

const maxBasemapBytes = 100 * 1024 * 1024;

class BasemapMetadata {
  BasemapMetadata(
    this.packageId,
    this.tripId,
    this.version,
    this.sha256,
    this.sizeBytes,
    this.bounds,
    this.minZoom,
    this.maxZoom,
    this.attribution,
    this.licenseUrl,
  );
  final String packageId, tripId, sha256, attribution, licenseUrl;
  final int version, sizeBytes, minZoom, maxZoom;
  final List<double> bounds;
  factory BasemapMetadata.parse(
    Map<String, Object?> json,
    OfflinePackage package,
  ) {
    final bounds = (json['bounds'] as List?)
        ?.map((v) => (v as num).toDouble())
        .toList();
    final size = json['sizeBytes'];
    final hash = json['sha256'];
    final min = json['minZoom'];
    final max = json['maxZoom'];
    if (json['packageId'] != package.id ||
        json['tripId'] != package.tripId ||
        json['packageVersion'] != package.packageVersion ||
        hash is! String ||
        !RegExp(r'^[a-f0-9]{64}$').hasMatch(hash) ||
        size is! int ||
        size <= 0 ||
        size > maxBasemapBytes ||
        bounds == null ||
        bounds.length != 4 ||
        bounds.any((v) => !v.isFinite) ||
        bounds[0] < -180 ||
        bounds[2] > 180 ||
        bounds[1] < -85.051129 ||
        bounds[3] > 85.051129 ||
        bounds[0] >= bounds[2] ||
        bounds[1] >= bounds[3] ||
        min is! int ||
        max is! int ||
        min < 0 ||
        max < min ||
        max > 20 ||
        json['attribution'] is! String ||
        (json['attribution'] as String).isEmpty ||
        json['licenseUrl'] != 'https://www.openstreetmap.org/copyright') {
      throw const FormatException(
        'Nền bản đồ không khớp chuyến đi hoặc phiên bản dữ liệu.',
      );
    }
    return BasemapMetadata(
      package.id,
      package.tripId,
      package.packageVersion,
      hash,
      size,
      bounds,
      min,
      max,
      json['attribution'] as String,
      json['licenseUrl'] as String,
    );
  }
  Map<String, Object?> toJson() => {
    'packageId': packageId,
    'tripId': tripId,
    'packageVersion': version,
    'sha256': sha256,
    'sizeBytes': sizeBytes,
    'bounds': bounds,
    'minZoom': minZoom,
    'maxZoom': maxZoom,
    'attribution': attribution,
    'licenseUrl': licenseUrl,
  };
}

final offlineBasemapStoreProvider =
    FutureProvider.autoDispose<OfflineBasemapStore>((ref) async {
      final user = ref.watch(authControllerProvider).valueOrNull?.id;
      if (user == null) throw StateError('Vui lòng đăng nhập lại.');
      final client = ref.watch(apiClientProvider);
      final support = await getApplicationSupportDirectory();
      return OfflineBasemapStore(
        Directory('${support.path}/offline-basemaps/$user'),
        client,
        PackageDownloadStore(
          Directory('${support.path}/offline-packages/$user'),
        ),
      );
    });

class OfflineBasemapStore {
  OfflineBasemapStore(this.root, this.client, this.coreStore);
  final Directory root;
  final ApiClient client;
  final PackageDownloadStore coreStore;
  static final _operations = <String, Future<void>>{};
  Directory directory(OfflinePackage package) {
    if (!OfflinePackage.isTripId(package.tripId) ||
        !OfflinePackage.isTripId(package.id)) {
      throw const FormatException('Mã gói dữ liệu không hợp lệ.');
    }
    return Directory('${root.path}/${package.tripId}/${package.id}');
  }

  Future<String?> verifiedPath(OfflinePackage package) async {
    if (await coreStore.accessDenied(package.tripId)) {
      await purge(package.tripId);
      return null;
    }
    try {
      final dir = directory(package);
      final json =
          jsonDecode(await File('${dir.path}/metadata.json').readAsString())
              as Map<String, Object?>;
      final meta = BasemapMetadata.parse(json, package);
      final file = File('${dir.path}/${meta.sha256}.mbtiles');
      if (await file.length() != meta.sizeBytes ||
          (await sha256.bind(file.openRead()).first).toString() !=
              meta.sha256) {
        return null;
      }
      return file.path;
    } on FileSystemException {
      return null;
    } on FormatException {
      return null;
    } on TypeError {
      return null;
    }
  }

  Future<void> purge(String tripId) async {
    if (!OfflinePackage.isTripId(tripId)) return;
    final dir = Directory('${root.path}/$tripId');
    if (await dir.exists()) await dir.delete(recursive: true);
  }

  Future<void> download(
    OfflinePackage package,
    CancelToken cancel,
    void Function(double) progress,
  ) async {
    final key = directory(package).absolute.path;
    final previous = _operations[key];
    if (previous != null) {
      await previous;
      return;
    }
    final task = _download(package, cancel, progress);
    _operations[key] = task;
    try {
      await task;
    } finally {
      if (identical(_operations[key], task)) _operations.remove(key);
    }
  }

  Future<void> _download(
    OfflinePackage package,
    CancelToken cancel,
    void Function(double) progress,
  ) async {
    File? temporary;
    try {
      final response = await client.dio.get<Map<String, Object?>>(
        ApiEndpoints.trips.offlineBasemap(
          package.tripId,
          package.packageVersion,
        ),
        cancelToken: cancel,
      );
      final meta = BasemapMetadata.parse(response.data!, package);
      if (await verifiedPath(package) != null) {
        progress(1);
        return;
      }
      final available = await DevicePackageStorageCapacity().availableBytes();
      if (available < meta.sizeBytes + 10 * 1024 * 1024) {
        throw const PackageStorageException(
          'Không đủ dung lượng để tải nền bản đồ.',
        );
      }
      final dir = directory(package);
      await dir.create(recursive: true);
      temporary = File('${dir.path}/${meta.sha256}.part');
      final stream = await client.dio.get<ResponseBody>(
        ApiEndpoints.trips.offlineBasemap(
          package.tripId,
          package.packageVersion,
          download: true,
        ),
        cancelToken: cancel,
        options: Options(
          responseType: ResponseType.stream,
          receiveTimeout: const Duration(seconds: 60),
          headers: {'Accept-Encoding': 'identity'},
        ),
      );
      var received = 0;
      final sink = temporary.openWrite();
      try {
        await for (final chunk in stream.data!.stream) {
          _checkCancelled(cancel);
          received += chunk.length;
          if (received > meta.sizeBytes) {
            throw const FormatException(
              'Nền bản đồ vượt kích thước đã công bố.',
            );
          }
          sink.add(chunk);
          progress(received / meta.sizeBytes);
        }
      } finally {
        await sink.close();
      }
      _checkCancelled(cancel);
      if (received != meta.sizeBytes ||
          (await sha256.bind(temporary.openRead()).first).toString() !=
              meta.sha256) {
        throw const FormatException(
          'Nền bản đồ không toàn vẹn. Vui lòng tải lại.',
        );
      }
      final db = await openDatabase(
        temporary.path,
        readOnly: true,
        singleInstance: false,
      );
      try {
        final check = await db.rawQuery('PRAGMA quick_check');
        if (check.first.values.first != 'ok') {
          throw const FormatException('Nền bản đồ bị hỏng.');
        }
        final rows = await db.rawQuery('SELECT name,value FROM metadata');
        final metadata = {
          for (final row in rows)
            row['name'].toString(): row['value'].toString(),
        };
        if (metadata['format'] != 'png' ||
            metadata['bounds'] != meta.bounds.join(',') ||
            metadata['minzoom'] != meta.minZoom.toString() ||
            metadata['maxzoom'] != meta.maxZoom.toString()) {
          throw const FormatException('Phạm vi nền bản đồ không hợp lệ.');
        }
        final tileCount = await db.rawQuery(
          'SELECT COUNT(*) AS count FROM tiles',
        );
        if ((tileCount.first['count'] as int) <= 0) {
          throw const FormatException('Nền bản đồ trống.');
        }
      } finally {
        await db.close();
      }
      _checkCancelled(cancel);
      // Recheck membership before publishing a newly downloaded file; never unblock
      // the core denial marker here (only the core authorization flow may do so).
      final authorized = await client.dio.get<Map<String, Object?>>(
        ApiEndpoints.trips.offlineBasemap(
          package.tripId,
          package.packageVersion,
        ),
        cancelToken: cancel,
      );
      final confirmed = BasemapMetadata.parse(authorized.data!, package);
      if (confirmed.sha256 != meta.sha256 ||
          confirmed.sizeBytes != meta.sizeBytes) {
        throw const FormatException(
          'Phiên bản nền bản đồ đã thay đổi. Vui lòng tải lại.',
        );
      }
      if (await coreStore.accessDenied(package.tripId)) {
        throw StateError('Quyền truy cập đã bị thu hồi.');
      }
      await temporary.rename('${dir.path}/${meta.sha256}.mbtiles');
      temporary = null;
      final record = File('${dir.path}/metadata.tmp');
      await record.writeAsString(jsonEncode(meta.toJson()), flush: true);
      await record.rename('${dir.path}/metadata.json');
    } on DioException catch (e) {
      if ([401, 403, 404].contains(e.response?.statusCode)) {
        await coreStore.setAccessDenied(package.tripId, true);
        await purge(package.tripId);
      }
      rethrow;
    } finally {
      if (temporary != null && await temporary.exists()) {
        await temporary.delete();
      }
    }
  }

  void _checkCancelled(CancelToken cancel) {
    if (cancel.isCancelled) {
      throw cancel.cancelError!;
    }
  }
}
