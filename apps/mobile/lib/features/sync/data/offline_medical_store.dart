import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../auth/application/auth_controller.dart';

/// BR-230 / PB AC-8: Manages local offline medical data lifecycle.
/// When sharing consent is revoked, sensitive medical data must be purged or locked
/// so that stale offline synchronization never re-authorizes or leaks it.
abstract class OfflineMedicalStore {
  Future<bool> isConsentActive();
  Future<void> setConsentActive(bool active);
  Future<void> purgeMedicalData();
  Future<Map<String, Object?>?> readMedicalData();
  Future<void> saveMedicalData(Map<String, Object?> data);
}

class MemoryOfflineMedicalStore implements OfflineMedicalStore {
  bool _consentActive = true;
  Map<String, Object?>? _medicalData;

  @override
  Future<bool> isConsentActive() async => _consentActive;

  @override
  Future<void> setConsentActive(bool active) async {
    _consentActive = active;
    if (!active) {
      await purgeMedicalData();
    }
  }

  @override
  Future<void> purgeMedicalData() async {
    _medicalData = null;
  }

  @override
  Future<Map<String, Object?>?> readMedicalData() async {
    if (!_consentActive) return null;
    return _medicalData;
  }

  @override
  Future<void> saveMedicalData(Map<String, Object?> data) async {
    if (!_consentActive) return;
    _medicalData = Map.unmodifiable(data);
  }
}

final offlineMedicalStoreProvider = Provider<OfflineMedicalStore>((ref) {
  // Can be backed by secure storage or memory per authenticated user
  ref.watch(authControllerProvider);
  return MemoryOfflineMedicalStore();
});
