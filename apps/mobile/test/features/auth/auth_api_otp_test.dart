import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/api/api_exception.dart';
import 'package:mobile/core/storage/token_storage.dart';
import 'package:mobile/features/auth/data/auth_api.dart';

/// CTMS-02 [Mobile]. Real [ApiClient] with only the network boundary faked
/// (`dio.httpClientAdapter`) -- same "fake the edge, keep the real code
/// under test" approach as campsite_search_repository_test.dart.
class _FakeTokenStorage extends TokenStorage {
  _FakeTokenStorage() : super(const FlutterSecureStorage());

  @override
  Future<String?> readAccessToken() async => null;

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

ResponseBody _jsonResponse(Map<String, dynamic> data, int statusCode) {
  return ResponseBody.fromString(
    jsonEncode(data),
    statusCode,
    headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    },
  );
}

const _verifiedAccountJson = {
  'id': 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'email': 'camper@example.com',
  'phone': '0912345678',
  'role': 'camper',
  'roles': ['camper'],
  'status': 'active',
};

void main() {
  late _FakeAdapter adapter;
  late AuthApi authApi;

  setUp(() {
    adapter = _FakeAdapter();
    final client = ApiClient(_FakeTokenStorage());
    client.dio.httpClientAdapter = adapter;
    authApi = AuthApi(client);
  });

  group('AuthApi.sendOtp', () {
    test('POSTs userId and the wire value of the chosen channel to /auth/send-otp', () async {
      adapter.onFetch = (_) => _jsonResponse(_verifiedAccountJson, 200);

      await authApi.sendOtp(userId: 'user-1', channel: OtpChannel.email);

      final request = adapter.lastRequest!;
      expect(request.path, '/auth/send-otp');
      expect(request.method, 'POST');
      expect(request.data, {'userId': 'user-1', 'channel': 'email'});
    });

    test('a phone channel sends the literal wire value "phone", not the enum name', () async {
      adapter.onFetch = (_) => _jsonResponse(_verifiedAccountJson, 200);

      await authApi.sendOtp(userId: 'user-1', channel: OtpChannel.phone);

      expect(adapter.lastRequest!.data['channel'], 'phone');
    });

    test('parses the RegisterResult response shape', () async {
      adapter.onFetch = (_) => _jsonResponse(_verifiedAccountJson, 200);

      final result = await authApi.sendOtp(userId: 'user-1', channel: OtpChannel.email);

      expect(result.id, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
      expect(result.status, 'active');
    });

    test('propagates a 409 (resend limit / delivery failed) as an ApiException', () async {
      adapter.onFetch = (_) => _jsonResponse({'message': 'Resend limit reached'}, 409);

      await expectLater(
        authApi.sendOtp(userId: 'user-1', channel: OtpChannel.email),
        throwsA(isA<ApiException>().having((e) => e.statusCode, 'statusCode', 409)),
      );
    });

    test('propagates a 422 (invalid input) as an ApiException', () async {
      adapter.onFetch = (_) => _jsonResponse({'message': 'Invalid input'}, 422);

      await expectLater(
        authApi.sendOtp(userId: 'user-1', channel: OtpChannel.email),
        throwsA(isA<ApiException>().having((e) => e.statusCode, 'statusCode', 422)),
      );
    });
  });

  group('AuthApi.resendOtp', () {
    test('POSTs the same payload shape to /auth/resend', () async {
      adapter.onFetch = (_) => _jsonResponse(_verifiedAccountJson, 200);

      await authApi.resendOtp(userId: 'user-1', channel: OtpChannel.phone);

      final request = adapter.lastRequest!;
      expect(request.path, '/auth/resend');
      expect(request.data, {'userId': 'user-1', 'channel': 'phone'});
    });
  });

  group('AuthApi.verifyOtp', () {
    test('POSTs userId and code to /auth/verify', () async {
      adapter.onFetch = (_) => _jsonResponse(_verifiedAccountJson, 200);

      await authApi.verifyOtp(userId: 'user-1', code: '123456');

      final request = adapter.lastRequest!;
      expect(request.path, '/auth/verify');
      expect(request.data, {'userId': 'user-1', 'code': '123456'});
    });

    test('a successful verify parses the activated account', () async {
      adapter.onFetch = (_) => _jsonResponse(_verifiedAccountJson, 200);

      final result = await authApi.verifyOtp(userId: 'user-1', code: '123456');

      expect(result.status, 'active');
    });

    test('propagates a 404 (no pending OTP) as an ApiException', () async {
      adapter.onFetch = (_) => _jsonResponse({'message': 'No pending OTP'}, 404);

      await expectLater(
        authApi.verifyOtp(userId: 'user-1', code: '000000'),
        throwsA(isA<ApiException>().having((e) => e.statusCode, 'statusCode', 404)),
      );
    });

    test('propagates a 409 (incorrect or expired OTP) as an ApiException', () async {
      adapter.onFetch = (_) => _jsonResponse({'message': 'Incorrect or expired OTP'}, 409);

      await expectLater(
        authApi.verifyOtp(userId: 'user-1', code: 'wrong0'),
        throwsA(isA<ApiException>().having((e) => e.statusCode, 'statusCode', 409)),
      );
    });
  });
}
