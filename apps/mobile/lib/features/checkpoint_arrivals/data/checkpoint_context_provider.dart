import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/api_endpoints.dart';
import '../domain/checkpoint_arrival_models.dart';

/// Hợp đồng cung cấp ngữ cảnh điểm kiểm tra đã ghim cho chuyến đi (CTMS-061).
abstract interface class CheckpointContextProvider {
  /// Lấy ngữ cảnh điểm kiểm tra cho chuyến đi (từ API hoặc cache nội bộ).
  Future<CheckpointArrivalContext?> getContext(String tripId);

  /// Lưu trữ ngữ cảnh vào bộ nhớ cục bộ theo khóa 4 thành phần
  /// `(tripId, routeVersion, packageId, packageVersion)`.
  Future<void> cacheContext(CheckpointArrivalContext context);

  /// Đọc ngữ cảnh đã lưu trong bộ nhớ cục bộ.
  Future<CheckpointArrivalContext?> getCachedContext(
    String tripId, {
    String? routeVersion,
    String? packageId,
    String? packageVersion,
  });
}

/// Bộ nhớ đệm file cục bộ cho ngữ cảnh điểm kiểm tra, được khóa chính xác theo
/// 4 trường định danh: `(tripId, routeVersion, packageId, packageVersion)`.
/// Sử dụng cơ chế ghi nguyên tử (.tmp + rename) và đồng bộ bất đồng bộ.
class FileCheckpointContextCache implements CheckpointContextProvider {
  FileCheckpointContextCache({this.root});

  final Directory? root;
  Future<void> _writes = Future.value();

  static String compositeKey({
    required String tripId,
    required String routeVersion,
    required String packageId,
    required String packageVersion,
  }) =>
      '$tripId::$routeVersion::$packageId::$packageVersion';

  Future<File> _file(String tripId) async {
    final Directory base;
    if (root != null) {
      base = root!;
    } else if (kIsWeb) {
      base = Directory.systemTemp;
    } else {
      base = await getApplicationSupportDirectory();
    }
    final dir = Directory('${base.path}/checkpoint_contexts');
    if (!await dir.exists()) {
      await dir.create(recursive: true);
    }
    return File('${dir.path}/$tripId.json');
  }

  Future<Map<String, dynamic>> _readAll(String tripId) async {
    try {
      final file = await _file(tripId);
      if (!await file.exists()) return {};
      final content = await file.readAsString();
      if (content.trim().isEmpty) return {};
      final decoded = jsonDecode(content);
      if (decoded is Map<String, dynamic>) {
        return decoded;
      }
      return {};
    } catch (_) {
      return {};
    }
  }

  @override
  Future<CheckpointArrivalContext?> getContext(String tripId) =>
      getCachedContext(tripId);

  @override
  Future<void> cacheContext(CheckpointArrivalContext context) {
    if (kIsWeb) return Future.value();
    final next = _writes.then((_) async {
      final file = await _file(context.tripId);
      final currentMap = await _readAll(context.tripId);

      final key = compositeKey(
        tripId: context.tripId,
        routeVersion: context.routeVersion,
        packageId: context.packageId,
        packageVersion: context.packageVersion,
      );

      currentMap[key] = context.toJson();
      currentMap['_latestKey'] = key;

      final temp = File('${file.path}.tmp');
      await temp.writeAsString(jsonEncode(currentMap), flush: true);
      if (await file.exists()) {
        await file.delete();
      }
      await temp.rename(file.path);
    });
    _writes = next.then((_) {}, onError: (Object _) {});
    return next;
  }

  @override
  Future<CheckpointArrivalContext?> getCachedContext(
    String tripId, {
    String? routeVersion,
    String? packageId,
    String? packageVersion,
  }) async {
    if (kIsWeb) return null;
    final map = await _readAll(tripId);
    if (map.isEmpty) return null;

    if (routeVersion != null && packageId != null && packageVersion != null) {
      final key = compositeKey(
        tripId: tripId,
        routeVersion: routeVersion,
        packageId: packageId,
        packageVersion: packageVersion,
      );
      final raw = map[key];
      if (raw is Map<String, dynamic>) {
        return CheckpointArrivalContext.fromJson(raw);
      }
      return null;
    }

    // Nếu không chỉ định đầy đủ bộ 4 khóa, lấy bản ghi được đánh dấu mới nhất
    final latestKey = map['_latestKey'] as String?;
    if (latestKey != null && map[latestKey] is Map<String, dynamic>) {
      return CheckpointArrivalContext.fromJson(
        map[latestKey] as Map<String, dynamic>,
      );
    }

    // Fallback: Lấy bản ghi hợp lệ đầu tiên
    for (final entry in map.entries) {
      if (entry.key.startsWith('_')) continue;
      if (entry.value is Map<String, dynamic>) {
        return CheckpointArrivalContext.fromJson(
          entry.value as Map<String, dynamic>,
        );
      }
    }
    return null;
  }
}

/// Triển khai lấy dữ liệu ngữ cảnh từ Backend Server (CTMS-313),
/// có tích hợp lưu bộ nhớ đệm cục bộ và hỗ trợ dự phòng khi offline.
class HttpCheckpointContextProvider implements CheckpointContextProvider {
  HttpCheckpointContextProvider({
    required this.client,
    CheckpointContextProvider? cache,
    this.allowDevFallback = kDebugMode,
  }) : cache = cache ?? FileCheckpointContextCache();

  final ApiClient client;
  final CheckpointContextProvider cache;
  final bool allowDevFallback;

  @override
  Future<CheckpointArrivalContext?> getContext(String tripId) async {
    try {
      final response = await client.get<Map<String, Object?>>(
        ApiEndpoints.trips.checkpointArrivalContext(tripId),
      );
      final data = response.data;
      if (data != null) {
        final context = CheckpointArrivalContext.fromJson(data);
        await cache.cacheContext(context);
        return context;
      }
    } catch (_) {
      // Backend có thể chưa triển khai endpoint hoặc máy đang offline / 404 / 409
    }

    // 1. Thử lấy từ bộ nhớ đệm đã ghim trước đó
    final cached = await cache.getCachedContext(tripId);
    if (cached != null) {
      return cached;
    }

    // 2. Nếu đang ở môi trường Debug / Test và được cho phép, tạo context dự phòng
    // để không chặn quá trình kiểm thử client khi BE đang triển khai.
    if (allowDevFallback) {
      final devContext = CheckpointArrivalContext(
        tripId: tripId,
        routeId: '8224078e-6d6f-4f29-8a9d-b4dc7068c58b',
        routeVersion: 'v1',
        packageId: tripId,
        packageVersion: 'v1-dev',
        contextSource: 'dev-fallback',
        checkpoints: const [
          RouteCheckpoint(
            id: '3822366f-0cbe-4858-93d1-c797beb0df8c',
            name: 'Điểm xuất phát Chân Đèo Hải Vân',
            latitude: 16.1850,
            longitude: 108.1300,
          ),
          RouteCheckpoint(
            id: 'd4b650b8-2fc1-487d-96e2-e82e14ed6c2a',
            name: 'Trạm dừng chân Lưng Đèo',
            latitude: 16.1950,
            longitude: 108.1380,
          ),
          RouteCheckpoint(
            id: '28a1191a-147d-43f1-9a45-d449263dfafe',
            name: 'Điểm trú bão & Sơ cứu Hải Vân Quan',
            latitude: 16.2050,
            longitude: 108.1450,
          ),
          RouteCheckpoint(
            id: '220b9a01-7862-42a9-9a8f-5b426a89475c',
            name: 'Bãi Cắm Trại Vịnh Làng Vân (Đích đến)',
            latitude: 16.2100,
            longitude: 108.1500,
          ),
        ],
      );
      return devContext;
    }

    return null;
  }

  @override
  Future<void> cacheContext(CheckpointArrivalContext context) =>
      cache.cacheContext(context);

  @override
  Future<CheckpointArrivalContext?> getCachedContext(
    String tripId, {
    String? routeVersion,
    String? packageId,
    String? packageVersion,
  }) =>
      cache.getCachedContext(
        tripId,
        routeVersion: routeVersion,
        packageId: packageId,
        packageVersion: packageVersion,
      );
}

