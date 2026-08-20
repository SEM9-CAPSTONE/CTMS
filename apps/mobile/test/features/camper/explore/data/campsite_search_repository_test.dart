import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/api/api_exception.dart';
import 'package:mobile/core/storage/token_storage.dart';
import 'package:mobile/features/camper/explore/data/campsite_search_repository.dart';
import 'package:mobile/features/camper/explore/domain/campsite_search_models.dart';

/// CTMS-17-T02 (mobile). Real [ApiClient] with only the network boundary
/// faked (`dio.httpClientAdapter`), the same "fake the edge, keep the real
/// code under test" approach as core/api/api_client_test.dart and Web's
/// campsites.service.test.ts (fetch stub).
class _FakeTokenStorage extends TokenStorage {
  _FakeTokenStorage() : super(const FlutterSecureStorage());

  @override
  Future<String?> readAccessToken() async => 'test-token';

  @override
  Future<String?> readRefreshToken() async => 'test-refresh-token';
}

class _FakeAdapter implements HttpClientAdapter {
  RequestOptions? lastRequest;
  late ResponseBody Function(RequestOptions options) onFetch;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    lastRequest = options;
    return onFetch(options);
  }

  @override
  void close({bool force = false}) {}
}

ResponseBody _jsonResponse(Map<String, dynamic> data, int statusCode) {
  return ResponseBody.fromString(
    jsonEncode(data),
    statusCode,
    headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    },
  );
}

const _emptyResponseJson = {
  'items': <Map<String, dynamic>>[],
  'pagination': {'page': 1, 'limit': 20, 'total': 0, 'totalPages': 0},
};

void main() {
  late _FakeAdapter adapter;
  late CampsiteSearchRepository repository;

  setUp(() {
    adapter = _FakeAdapter();
    final client = ApiClient(_FakeTokenStorage());
    client.dio.httpClientAdapter = adapter;
    repository = CampsiteSearchRepository(client);
  });

  test('sends the full filter set with page/limit and amenities comma-joined', () async {
    adapter.onFetch = (_) => _jsonResponse(_emptyResponseJson, 200);

    await repository.search(
      const CampsiteSearchParams(
        province: 'Lam Dong',
        city: 'Da Lat',
        amenities: ['wifi', 'bbq'],
        minPrice: 100,
        maxPrice: 500,
        page: 2,
        limit: 10,
      ),
    );

    final request = adapter.lastRequest!;
    expect(request.path, '/campsites');
    expect(request.queryParameters['province'], 'Lam Dong');
    expect(request.queryParameters['city'], 'Da Lat');
    expect(request.queryParameters['amenities'], 'wifi,bbq');
    expect(request.queryParameters['minPrice'], 100);
    expect(request.queryParameters['maxPrice'], 500);
    expect(request.queryParameters['page'], 2);
    expect(request.queryParameters['limit'], 10);
    expect(request.queryParameters.containsKey('status'), isFalse);
  });

  test('drops empty/omitted filters instead of sending them at all', () async {
    adapter.onFetch = (_) => _jsonResponse(_emptyResponseJson, 200);

    await repository.search(const CampsiteSearchParams(page: 1, limit: 20));

    final request = adapter.lastRequest!;
    expect(request.queryParameters.containsKey('province'), isFalse);
    expect(request.queryParameters.containsKey('city'), isFalse);
    expect(request.queryParameters.containsKey('amenities'), isFalse);
    expect(request.queryParameters.containsKey('minPrice'), isFalse);
    expect(request.queryParameters.containsKey('maxPrice'), isFalse);
    expect(request.queryParameters['page'], 1);
    expect(request.queryParameters['limit'], 20);
  });

  test('a single amenity is sent without a trailing comma', () async {
    adapter.onFetch = (_) => _jsonResponse(_emptyResponseJson, 200);

    await repository.search(
      const CampsiteSearchParams(amenities: ['wifi'], page: 1, limit: 20),
    );

    expect(adapter.lastRequest!.queryParameters['amenities'], 'wifi');
  });

  test('an empty amenities list is treated as omitted, not sent as ""', () async {
    adapter.onFetch = (_) => _jsonResponse(_emptyResponseJson, 200);

    await repository.search(
      const CampsiteSearchParams(amenities: [], page: 1, limit: 20),
    );

    expect(adapter.lastRequest!.queryParameters.containsKey('amenities'), isFalse);
  });

  test('parses a real-shaped successful response, including a null coverImage', () async {
    adapter.onFetch = (_) => _jsonResponse({
      'items': [
        {
          'id': 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          'name': 'Đà Lạt Pine Camp',
          'location': {
            'province': 'Lam Dong',
            'city': 'Da Lat',
            'latitude': 11.940419,
            'longitude': 108.458313,
          },
          'coverImage': null,
          'activeRoutes': <String>[],
        },
      ],
      'pagination': {'page': 1, 'limit': 20, 'total': 1, 'totalPages': 1},
    }, 200);

    final result = await repository.search(const CampsiteSearchParams(page: 1, limit: 20));

    expect(result.items, hasLength(1));
    expect(result.items.first.name, 'Đà Lạt Pine Camp');
    expect(result.items.first.coverImage, isNull);
    expect(result.pagination.total, 1);
  });

  test('parses a genuinely empty result set', () async {
    adapter.onFetch = (_) => _jsonResponse(_emptyResponseJson, 200);

    final result = await repository.search(const CampsiteSearchParams(page: 1, limit: 20));

    expect(result.items, isEmpty);
    expect(result.pagination.total, 0);
  });

  test('does not swallow a 401/403/422 error -- ApiException propagates with its statusCode intact', () async {
    for (final statusCode in [401, 403, 422]) {
      adapter.onFetch = (_) => _jsonResponse({'message': 'boom'}, statusCode);

      await expectLater(
        repository.search(const CampsiteSearchParams(page: 1, limit: 20)),
        throwsA(isA<ApiException>().having((e) => e.statusCode, 'statusCode', statusCode)),
      );
    }
  });
}
