import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../auth/application/auth_controller.dart';
import '../data/sos_api.dart';
import '../data/sos_store.dart';
import '../domain/sos_alert.dart';

class SosController extends ChangeNotifier {
  SosController({
    required this.tripId,
    required this.api,
    this.store,
    this.userId,
  }) {
    load();
  }

  final String tripId;
  final SosApi api;
  final SosStore? store;
  final String? userId;

  List<SosAlert> alerts = [];
  bool loading = false;
  bool submitting = false;
  String? error;

  SosAlert? get activeAlert {
    for (final alert in alerts) {
      if (alert.isActive) return alert;
    }
    return null;
  }

  Future<void> load() async {
    loading = true;
    error = null;
    notifyListeners();

    // 1. Read locally persisted SOS alerts (PB AC-2, surviving app restart)
    List<LocalSosAlert> localAlerts = [];
    if (store != null) {
      try {
        localAlerts = await store!.read(tripId);
      } catch (_) {}
    }

    // Convert pending local alerts to SosAlerts
    final pendingLocalAsAlerts = localAlerts
        .where((l) => l.isPending)
        .map((l) => l.toSosAlert())
        .toList();

    try {
      final serverAlerts = await api.list(tripId);

      // Merge: server alerts take precedence for state, but local pending alerts not yet on server remain visible
      final serverIds = serverAlerts.map((a) => a.id).toSet();
      final unresolvedLocal = pendingLocalAsAlerts.where((a) => !serverIds.contains(a.id)).toList();

      alerts = [...unresolvedLocal, ...serverAlerts];
      loading = false;
      notifyListeners();
    } catch (e) {
      // Offline fallback: keep local alerts and do not block screen with hard error
      alerts = pendingLocalAsAlerts;
      loading = false;
      if (alerts.isEmpty) {
        error = e is ApiException ? e.message : 'Thiết bị đang ngoại tuyến';
      }
      notifyListeners();
    }
  }

  Future<SosAlert?> cancel({
    required String sosId,
    required String reason,
  }) async {
    final trimmedReason = reason.trim();
    if (trimmedReason.isEmpty) {
      error = 'Vui lòng nhập lý do hủy cảnh báo SOS';
      notifyListeners();
      return null;
    }
    if (trimmedReason.length > 500) {
      error = 'Lý do hủy không được vượt quá 500 ký tự';
      notifyListeners();
      return null;
    }

    submitting = true;
    error = null;
    notifyListeners();

    try {
      final updated = await api.cancel(tripId, sosId, trimmedReason);
      alerts = alerts.map((a) => a.id == sosId ? updated : a).toList();
      if (!alerts.any((a) => a.id == sosId)) {
        alerts = [updated, ...alerts];
      }
      submitting = false;
      notifyListeners();
      return updated;
    } catch (e) {
      submitting = false;
      error = e is ApiException ? e.message : 'Không thể hủy cảnh báo SOS';
      notifyListeners();
      return null;
    }
  }

  Future<SosAlert?> acknowledge(String sosId) async {
    submitting = true;
    error = null;
    notifyListeners();

    try {
      final updated = await api.acknowledge(tripId, sosId);
      alerts = alerts.map((a) => a.id == sosId ? updated : a).toList();
      if (!alerts.any((a) => a.id == sosId)) {
        alerts = [updated, ...alerts];
      }
      submitting = false;
      notifyListeners();
      return updated;
    } catch (e) {
      submitting = false;
      error = e is ApiException ? e.message : 'Không thể tiếp nhận cảnh báo SOS';
      notifyListeners();
      return null;
    }
  }

  Future<SosAlert?> close({
    required String sosId,
    required String resolutionNote,
  }) async {
    final trimmedNote = resolutionNote.trim();
    if (trimmedNote.isEmpty) {
      error = 'Vui lòng nhập ghi chú kết quả xử lý SOS';
      notifyListeners();
      return null;
    }
    if (trimmedNote.length > 500) {
      error = 'Ghi chú xử lý không được vượt quá 500 ký tự';
      notifyListeners();
      return null;
    }

    submitting = true;
    error = null;
    notifyListeners();

    try {
      final updated = await api.close(tripId, sosId, trimmedNote);
      alerts = alerts.map((a) => a.id == sosId ? updated : a).toList();
      if (!alerts.any((a) => a.id == sosId)) {
        alerts = [updated, ...alerts];
      }
      submitting = false;
      notifyListeners();
      return updated;
    } catch (e) {
      submitting = false;
      error = e is ApiException ? e.message : 'Không thể đóng cảnh báo SOS';
      notifyListeners();
      return null;
    }
  }

  Future<SosAlert?> triggerSos({
    String emergencyType = 'other',
    String? notes,
    double? latitude,
    double? longitude,
    int? batteryLevel,
  }) async {
    submitting = true;
    error = null;
    notifyListeners();

    final alertId = newSosId();
    final now = DateTime.now();
    var local = LocalSosAlert(
      id: alertId,
      tripId: tripId,
      senderId: userId ?? '',
      emergencyType: emergencyType,
      eventTime: now,
      location: (latitude != null && longitude != null)
          ? SosLocation(latitude: latitude, longitude: longitude)
          : null,
      batteryLevel: batteryLevel,
      notes: notes,
      syncState: SosSyncState.pending,
    );

    // 1. Immediately store to durable local storage (PB AC-1, PB AC-2, BR-256)
    if (store != null) {
      try {
        await store!.put(local);
      } catch (_) {}
    }

    // 2. Reflect local active emergency state immediately in UI
    final initialUiAlert = local.toSosAlert();
    alerts = [initialUiAlert, ...alerts.where((a) => a.id != alertId)];
    notifyListeners();

    // 3. Attempt immediate transmission
    try {
      final created = await api.create(
        tripId,
        id: alertId,
        emergencyType: emergencyType,
        notes: notes,
        latitude: latitude,
        longitude: longitude,
        batteryLevel: batteryLevel,
        eventTime: now,
      );

      local = local.delivery(
        syncState: SosSyncState.synced,
        serverAlert: created,
      );
      if (store != null) {
        try {
          await store!.put(local);
        } catch (_) {}
      }

      alerts = [created, ...alerts.where((a) => a.id != alertId)];
      submitting = false;
      notifyListeners();
      return created;
    } catch (e) {
      // Network failure / offline: keep locally stored as pending, return active local alert
      submitting = false;
      notifyListeners();
      return initialUiAlert;
    }
  }
}

final sosControllerProvider =
    ChangeNotifierProvider.family<SosController, String>((ref, tripId) {
      final api = ref.watch(sosApiProvider);
      final store = ref.watch(sosStoreProvider);
      final user = ref.watch(authControllerProvider).valueOrNull;
      return SosController(
        tripId: tripId,
        api: api,
        store: store,
        userId: user?.id,
      );
    });
