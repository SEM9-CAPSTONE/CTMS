import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/storage/token_storage.dart';
import 'package:mobile/features/checkpoint_arrivals/data/checkpoint_context_provider.dart';
import 'package:mobile/features/checkpoint_arrivals/domain/checkpoint_arrival_models.dart';

class _FakeTokenStorage extends TokenStorage {
  _FakeTokenStorage() : super(const FlutterSecureStorage());

  @override
  Future<String?> readAccessToken() async => 'test-token';
  @override
  Future<String?> readRefreshToken() async => 'test-refresh-token';
}

class _MockHttpClientAdapter implements HttpClientAdapter {
  _MockHttpClientAdapter({required this.statusCode, required this.data});

  final int statusCode;
  final dynamic data;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    final bytes = utf8.encode(jsonEncode(data));
    return ResponseBody.fromBytes(
      bytes,
      statusCode,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

class _FailingHttpClientAdapter implements HttpClientAdapter {
  _FailingHttpClientAdapter({required this.statusCode});

  final int statusCode;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    throw DioException(
      requestOptions: options,
      response: Response(requestOptions: options, statusCode: statusCode),
      type: DioExceptionType.badResponse,
    );
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory tempDir;

  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('cp_ctx_test_');
  });

  tearDown(() async {
    if (await tempDir.exists()) {
      await tempDir.delete(recursive: true);
    }
  });

  group('FileCheckpointContextCache (Composite 4-Field Key & Atomic Persistence)', () {
    test('persists and restores context across new cache instances', () async {
      final cache1 = FileCheckpointContextCache(root: tempDir);
      const sampleContext = CheckpointArrivalContext(
        tripId: 'trip-001',
        routeId: 'route-001',
        routeVersion: 'rv-1',
        packageId: 'pkg-001',
        packageVersion: 'pv-1',
        checkpoints: [
          RouteCheckpoint(
            id: 'cp-01',
            latitude: 11.5432,
            longitude: 108.4521,
            name: 'Trạm kiểm lâm',
          ),
        ],
      );

      await cache1.cacheContext(sampleContext);

      // Tạo instance mới cùng thư mục để kiểm tra khả năng phục hồi sau restart
      final cache2 = FileCheckpointContextCache(root: tempDir);
      final restored = await cache2.getCachedContext(
        'trip-001',
        routeVersion: 'rv-1',
        packageId: 'pkg-001',
        packageVersion: 'pv-1',
      );

      expect(restored, isNotNull);
      expect(restored!.tripId, equals('trip-001'));
      expect(restored.routeVersion, equals('rv-1'));
      expect(restored.packageId, equals('pkg-001'));
      expect(restored.packageVersion, equals('pv-1'));
      expect(restored.checkpoints.length, equals(1));
      expect(restored.checkpoints.first.name, equals('Trạm kiểm lâm'));
    });

    test('distinguishes different versions by composite 4-field key', () async {
      final cache = FileCheckpointContextCache(root: tempDir);
      const ctxV1 = CheckpointArrivalContext(
        tripId: 'trip-001',
        routeId: 'route-001',
        routeVersion: 'rv-1',
        packageId: 'pkg-001',
        packageVersion: 'pv-1',
        checkpoints: [
          RouteCheckpoint(id: 'cp-01', latitude: 10.0, longitude: 106.0),
        ],
      );
      const ctxV2 = CheckpointArrivalContext(
        tripId: 'trip-001',
        routeId: 'route-001',
        routeVersion: 'rv-2',
        packageId: 'pkg-002',
        packageVersion: 'pv-2',
        checkpoints: [
          RouteCheckpoint(id: 'cp-02', latitude: 11.0, longitude: 107.0),
        ],
      );

      await cache.cacheContext(ctxV1);
      await cache.cacheContext(ctxV2);

      final queryV1 = await cache.getCachedContext(
        'trip-001',
        routeVersion: 'rv-1',
        packageId: 'pkg-001',
        packageVersion: 'pv-1',
      );
      final queryV2 = await cache.getCachedContext(
        'trip-001',
        routeVersion: 'rv-2',
        packageId: 'pkg-002',
        packageVersion: 'pv-2',
      );

      expect(queryV1?.packageVersion, equals('pv-1'));
      expect(queryV1?.checkpoints.first.id, equals('cp-01'));
      expect(queryV2?.packageVersion, equals('pv-2'));
      expect(queryV2?.checkpoints.first.id, equals('cp-02'));

      // Bản ghi mới nhất được trả về khi không chỉ định đầy đủ bộ 4 khóa
      final latest = await cache.getContext('trip-001');
      expect(latest?.packageVersion, equals('pv-2'));
    });
  });

  group('HttpCheckpointContextProvider (Network & Fallback Policies)', () {
    test('fetches from API and updates local cache on success', () async {
      final apiClient = ApiClient(_FakeTokenStorage());
      apiClient.dio.httpClientAdapter = _MockHttpClientAdapter(
        statusCode: 200,
        data: {
          'tripId': 'trip-net-1',
          'routeId': 'route-net-1',
          'routeVersion': 'rv-1',
          'packageId': 'pkg-net-1',
          'packageVersion': 'pv-1',
          'checkpoints': [
            {
              'id': 'cp-net-1',
              'latitude': 12.0,
              'longitude': 108.0,
              'name': 'Đỉnh Lang Biang',
            },
          ],
        },
      );

      final cache = FileCheckpointContextCache(root: tempDir);
      final provider = HttpCheckpointContextProvider(
        client: apiClient,
        cache: cache,
        allowDevFallback: false,
      );

      final result = await provider.getContext('trip-net-1');
      expect(result, isNotNull);
      expect(result!.tripId, equals('trip-net-1'));
      expect(result.checkpoints.first.name, equals('Đỉnh Lang Biang'));

      // Kiểm tra cache đã lưu tự động
      final cached = await cache.getCachedContext('trip-net-1');
      expect(cached, isNotNull);
      expect(cached!.checkpoints.first.id, equals('cp-net-1'));
    });

    test('falls back to local cache when network fails or returns 409', () async {
      final apiClient = ApiClient(_FakeTokenStorage());
      apiClient.dio.httpClientAdapter = _FailingHttpClientAdapter(statusCode: 409);

      final cache = FileCheckpointContextCache(root: tempDir);
      // Pre-seed cache
      await cache.cacheContext(
        const CheckpointArrivalContext(
          tripId: 'trip-offline-1',
          routeId: 'route-off',
          routeVersion: 'rv-off',
          packageId: 'pkg-off',
          packageVersion: 'pv-off',
          checkpoints: [
            RouteCheckpoint(id: 'cp-offline', latitude: 11.1, longitude: 108.1),
          ],
        ),
      );

      final provider = HttpCheckpointContextProvider(
        client: apiClient,
        cache: cache,
        allowDevFallback: false,
      );

      final result = await provider.getContext('trip-offline-1');
      expect(result, isNotNull);
      expect(result!.tripId, equals('trip-offline-1'));
      expect(result.checkpoints.first.id, equals('cp-offline'));
    });

    test('returns null cleanly in production simulation when no network and no cache', () async {
      final apiClient = ApiClient(_FakeTokenStorage());
      apiClient.dio.httpClientAdapter = _FailingHttpClientAdapter(statusCode: 500);

      final cache = FileCheckpointContextCache(root: tempDir);
      final provider = HttpCheckpointContextProvider(
        client: apiClient,
        cache: cache,
        allowDevFallback: false, // Production mode
      );

      final result = await provider.getContext('trip-empty');
      expect(result, isNull);
    });

    test('returns dev-fallback in debug mode when network and cache are unavailable', () async {
      final apiClient = ApiClient(_FakeTokenStorage());
      apiClient.dio.httpClientAdapter = _FailingHttpClientAdapter(statusCode: 500);

      final cache = FileCheckpointContextCache(root: tempDir);
      final provider = HttpCheckpointContextProvider(
        client: apiClient,
        cache: cache,
        allowDevFallback: true, // Debug mode
      );

      final result = await provider.getContext('trip-dev');
      expect(result, isNotNull);
      expect(result!.contextSource, equals('dev-fallback'));
      expect(result.packageVersion, equals('v1-dev'));
    });
  });
}
