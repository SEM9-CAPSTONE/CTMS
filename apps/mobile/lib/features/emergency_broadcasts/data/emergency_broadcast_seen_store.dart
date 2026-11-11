import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Which alerts the viewer has already acknowledged on this device. Local only: the API has no
/// read-receipt, so this never tells the Host anything.
abstract interface class EmergencyBroadcastSeenStore {
  Future<Set<String>> read(String tripId);
  Future<void> save(String tripId, Set<String> ids);
}

class SecureEmergencyBroadcastSeenStore implements EmergencyBroadcastSeenStore {
  SecureEmergencyBroadcastSeenStore([FlutterSecureStorage? storage])
    : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  String _key(String tripId) => 'ctms_emergency_broadcasts_seen_$tripId';

  @override
  Future<Set<String>> read(String tripId) async {
    try {
      final raw = await _storage.read(key: _key(tripId));
      if (raw == null || raw.isEmpty) return {};
      return (jsonDecode(raw) as List).cast<String>().toSet();
    } catch (_) {
      return {};
    }
  }

  @override
  Future<void> save(String tripId, Set<String> ids) async {
    try {
      await _storage.write(key: _key(tripId), value: jsonEncode(ids.toList()));
    } catch (_) {
      // Losing the marker only means the alert is highlighted again; never block the viewer.
    }
  }
}

class InMemoryEmergencyBroadcastSeenStore
    implements EmergencyBroadcastSeenStore {
  final Map<String, Set<String>> _ids = {};

  @override
  Future<Set<String>> read(String tripId) async => {...?_ids[tripId]};

  @override
  Future<void> save(String tripId, Set<String> ids) async =>
      _ids[tripId] = {...ids};
}
