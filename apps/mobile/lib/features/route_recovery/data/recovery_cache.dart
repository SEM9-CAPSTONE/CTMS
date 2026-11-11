import 'package:flutter_secure_storage/flutter_secure_storage.dart';

abstract interface class RecoveryCache {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
}

class SecureRecoveryCache implements RecoveryCache {
  SecureRecoveryCache(
    this.userId, {
    this.storage = const FlutterSecureStorage(),
  });
  final String userId;
  final FlutterSecureStorage storage;
  final Map<String, String> _session = {};
  String _key(String key) => 'route_recovery:$userId:$key';
  @override
  Future<String?> read(String key) async =>
      _session[key] ?? await storage.read(key: _key(key));
  @override
  Future<void> write(String key, String value) async {
    _session[key] = value;
    await storage.write(key: _key(key), value: value);
  }
}
