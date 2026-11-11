import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../../core/api/api_client.dart';

/// CTMS-383 `PUT` / `DELETE /me/push-devices`.
abstract interface class PushDevicesApi {
  Future<void> register(String token, String platform);
  Future<void> unregister(String token);
}

class HttpPushDevicesApi implements PushDevicesApi {
  HttpPushDevicesApi(this.client);
  final ApiClient client;

  static const _path = '/me/push-devices';

  @override
  Future<void> register(String token, String platform) async {
    await client.put<Object?>(
      _path,
      data: {'token': token, 'platform': platform},
    );
  }

  @override
  Future<void> unregister(String token) async {
    await client.delete<Object?>(_path, data: {'token': token});
  }
}

/// Event ids already shown on this device, so a repeated delivery is shown once (AC-4).
abstract interface class PushSeenStore {
  Future<List<String>> read();
  Future<void> save(List<String> keys);
}

/// Most recent keys kept on this device.
const pushSeenLimit = 200;

class SecurePushSeenStore implements PushSeenStore {
  SecurePushSeenStore([FlutterSecureStorage? storage])
    : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;
  static const _key = 'ctms_push_seen_event_ids';

  @override
  Future<List<String>> read() async {
    try {
      final raw = await _storage.read(key: _key);
      if (raw == null || raw.isEmpty) return [];
      return (jsonDecode(raw) as List).cast<String>();
    } catch (_) {
      return [];
    }
  }

  @override
  Future<void> save(List<String> keys) async {
    try {
      await _storage.write(key: _key, value: jsonEncode(keys));
    } catch (_) {
      // Losing the list only means a repeated push could be shown again; never block the user.
    }
  }
}

class InMemoryPushSeenStore implements PushSeenStore {
  List<String> keys = [];

  @override
  Future<List<String>> read() async => [...keys];

  @override
  Future<void> save(List<String> next) async => keys = [...next];
}
