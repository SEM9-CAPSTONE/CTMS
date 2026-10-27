import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/api/api_exception.dart';
import 'package:mobile/core/storage/token_storage.dart';
import 'package:mobile/features/sos/data/sos_api.dart';
import 'package:mobile/features/sos/domain/sos_alert.dart';

class _FakeTokenStorage extends TokenStorage {
  _FakeTokenStorage() : super(const FlutterSecureStorage());

  @override
  Future<String?> readAccessToken() async => 'fake-token';

  @override
  Future<String?> readRefreshToken() async => null;
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

ResponseBody _jsonResponse(dynamic data, int statusCode) {
  return ResponseBody.fromString(
    jsonEncode(data),
    statusCode,
    headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    },
  );
}

void main() {
  late _FakeAdapter adapter;
  late ApiClient client;
  late HttpSosApi api;

  setUp(() {
    adapter = _FakeAdapter();
    client = ApiClient(_FakeTokenStorage());
    client.dio.httpClientAdapter = adapter;
    api = HttpSosApi(client);
  });

  group('SosApi', () {
    const tripId = 'a1736fee-62be-4991-9478-a62288e9b80a';
    const sosId = 'e0500000-0000-4000-8000-000000000001';

    test('list calls GET /trips/:tripId/sos and parses list of SosAlert', () async {
      adapter.onFetch = (options) {
        expect(options.method, 'GET');
        expect(options.path, '/trips/$tripId/sos');
        return _jsonResponse([
          {
            'id': sosId,
            'tripId': tripId,
            'senderId': 'sender-1',
            'emergencyType': 'other',
            'status': 'active',
            'eventTime': '2026-10-27T10:00:00.000Z',
          }
        ], 200);
      };

      final alerts = await api.list(tripId);
      expect(alerts.length, 1);
      expect(alerts.first.id, sosId);
      expect(alerts.first.isActive, isTrue);
      expect(alerts.first.emergencyTypeLabel, 'Khẩn cấp khác');
    });

    test('cancel calls PATCH /trips/:tripId/sos/:sosId/cancel with reason', () async {
      adapter.onFetch = (options) {
        expect(options.method, 'PATCH');
        expect(options.path, '/trips/$tripId/sos/$sosId/cancel');
        final body = options.data as Map<String, dynamic>;
        expect(body['reason'], 'Bấm nhầm khi chụp ảnh');
        return _jsonResponse({
          'id': sosId,
          'tripId': tripId,
          'senderId': 'sender-1',
          'emergencyType': 'other',
          'status': 'cancelled',
          'eventTime': '2026-10-27T10:00:00.000Z',
          'cancelledBy': 'sender-1',
          'cancelledAt': '2026-10-27T10:05:00.000Z',
          'cancellationReason': 'Bấm nhầm khi chụp ảnh',
        }, 200);
      };

      final updated = await api.cancel(tripId, sosId, 'Bấm nhầm khi chụp ảnh');
      expect(updated.id, sosId);
      expect(updated.isCancelled, isTrue);
      expect(updated.cancellationReason, 'Bấm nhầm khi chụp ảnh');
      expect(updated.cancelledBy, 'sender-1');
    });

    test('cancel propagates 409 Conflict as ApiException when alert not active', () async {
      adapter.onFetch = (options) {
        return _jsonResponse({
          'statusCode': 409,
          'message': 'Chỉ có thể hủy SOS khi đang ở trạng thái active',
          'errorCode': 'SOS_ALREADY_RESOLVED_OR_CANCELLED',
        }, 409);
      };

      expect(
        () => api.cancel(tripId, sosId, 'Bấm nhầm'),
        throwsA(
          isA<ApiException>().having(
            (e) => e.message,
            'message',
            'Chỉ có thể hủy SOS khi đang ở trạng thái active',
          ),
        ),
      );
    });

    test('cancel propagates 403 Forbidden as ApiException when not sender', () async {
      adapter.onFetch = (options) {
        return _jsonResponse({
          'statusCode': 403,
          'message': 'Chỉ người đã phát tín hiệu SOS mới có quyền hủy cảnh báo nhầm',
          'errorCode': 'SOS_ONLY_SENDER_CAN_CANCEL',
        }, 403);
      };

      expect(
        () => api.cancel(tripId, sosId, 'Bấm nhầm'),
        throwsA(
          isA<ApiException>().having(
            (e) => e.message,
            'message',
            'Chỉ người đã phát tín hiệu SOS mới có quyền hủy cảnh báo nhầm',
          ),
        ),
      );
    });
  });
}
