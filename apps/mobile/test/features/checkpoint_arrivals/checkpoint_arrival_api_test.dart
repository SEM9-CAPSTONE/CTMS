import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/storage/token_storage.dart';
import 'package:mobile/features/checkpoint_arrivals/data/checkpoint_arrival_api.dart';
import 'package:mobile/features/checkpoint_arrivals/domain/checkpoint_arrival_models.dart';

class FakeTokenStorage extends TokenStorage {
  FakeTokenStorage() : super(const FlutterSecureStorage());

  @override
  Future<String?> readAccessToken() async => 'fake-access-token';
  @override
  Future<String?> readRefreshToken() async => 'fake-refresh-token';
}

void main() {
  group('CheckpointArrivalResultItem JSON Contract Parsing', () {
    test('parses accepted record response with visitId and receivedAt', () {
      final json = {
        'id': 'ea28d74e-ad0f-4efd-a3a0-83cf0e552ae7',
        'clientId': 'ea28d74e-ad0f-4efd-a3a0-83cf0e552ae7',
        'status': 'accepted',
        'reason': null,
        'retryable': false,
        'visitId': 'ea28d74e-ad0f-4efd-a3a0-83cf0e552ae7',
        'receivedAt': '2026-11-09T01:00:00.000Z',
      };

      final item = CheckpointArrivalResultItem.fromJson(json);

      expect(item.id, equals('ea28d74e-ad0f-4efd-a3a0-83cf0e552ae7'));
      expect(item.clientId, equals('ea28d74e-ad0f-4efd-a3a0-83cf0e552ae7'));
      expect(item.isAccepted, isTrue);
      expect(item.isRejected, isFalse);
      expect(item.retryable, isFalse);
      expect(item.visitId, equals('ea28d74e-ad0f-4efd-a3a0-83cf0e552ae7'));
      expect(item.receivedAt, equals(DateTime.utc(2026, 11, 9, 1, 0, 0)));
    });

    test('parses duplicate record response', () {
      final json = {
        'id': 'ea28d74e-ad0f-4efd-a3a0-83cf0e552ae7',
        'clientId': 'ea28d74e-ad0f-4efd-a3a0-83cf0e552ae7',
        'status': 'duplicate',
        'reason': null,
        'retryable': false,
        'visitId': 'orig-visit-uuid',
        'receivedAt': '2026-11-09T00:50:00.000Z',
      };

      final item = CheckpointArrivalResultItem.fromJson(json);

      expect(item.isDuplicate, isTrue);
      expect(item.visitId, equals('orig-visit-uuid'));
    });

    test('parses transient processing_error (retryable: true)', () {
      final json = {
        'id': 'error-uuid',
        'clientId': 'error-uuid',
        'status': 'rejected',
        'reason': 'processing_error',
        'retryable': true,
        'visitId': null,
        'receivedAt': null,
      };

      final item = CheckpointArrivalResultItem.fromJson(json);

      expect(item.isRejected, isTrue);
      expect(item.reason, equals(CheckpointArrivalRejection.processingError));
      expect(item.retryable, isTrue);
    });

    test('parses terminal rejection (retryable: false, threshold_not_met)', () {
      final json = {
        'id': 'term-uuid',
        'clientId': 'term-uuid',
        'status': 'rejected',
        'reason': 'threshold_not_met',
        'retryable': false,
        'visitId': null,
        'receivedAt': null,
      };

      final item = CheckpointArrivalResultItem.fromJson(json);

      expect(item.isRejected, isTrue);
      expect(item.reason, equals(CheckpointArrivalRejection.thresholdNotMet));
      expect(item.retryable, isFalse);
    });

    test('defaults to retryable: true if retryable is omitted or null in server response (safety-first)', () {
      final jsonMissingRetryable = {
        'id': 'missing-retryable',
        'clientId': 'missing-retryable',
        'status': 'rejected',
        'reason': 'unknown_error',
        'retryable': null,
      };

      final item = CheckpointArrivalResultItem.fromJson(jsonMissingRetryable);

      // Nếu BE không gửi retryable -> Mobile coi là true để giữ lại dữ liệu
      expect(item.retryable, isTrue);
    });
  });

  group('CheckpointArrivalApi Requests and Error Handling', () {
    late ApiClient apiClient;
    late CheckpointArrivalApi api;

    setUp(() {
      apiClient = ApiClient(FakeTokenStorage());
      api = CheckpointArrivalApi(apiClient);
    });

    test('handles 409 Conflict by throwing CheckpointContextNotReadyException without evicting', () async {
      // Mock Dio adapter throwing 409
      apiClient.dio.httpClientAdapter = _MockHttpClientAdapter(
        statusCode: 409,
        data: {'message': 'Active package checkpoint context is not available'},
      );

      final arrival = LocalCheckpointArrival(
        id: 'arr-test',
        tripId: 'trip-1',
        checkpointId: 'cp-1',
        routeId: 'r-1',
        routeVersion: 'v1',
        packageId: 'pkg-1',
        packageVersion: 'v1',
        detectedOffline: true,
        confirmedAt: DateTime.now(),
        samples: const [],
      );

      expect(
        () => api.syncBatch(tripId: 'trip-1', arrivals: [arrival]),
        throwsA(isA<CheckpointContextNotReadyException>()),
      );
    });
  });
}

class _MockHttpClientAdapter implements HttpClientAdapter {
  _MockHttpClientAdapter({required this.statusCode, required this.data});

  final int statusCode;
  final Map<String, dynamic> data;

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<dynamic>? requestStream, Future<void>? cancelFuture) async {
    return ResponseBody.fromString(
      jsonEncode(data),
      statusCode,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}
