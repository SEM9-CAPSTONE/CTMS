import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/api_exception.dart';
import '../data/sos_api.dart';
import '../domain/sos_alert.dart';

class SosController extends ChangeNotifier {
  SosController({
    required this.tripId,
    required this.api,
  }) {
    load();
  }

  final String tripId;
  final SosApi api;

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

    try {
      alerts = await api.list(tripId);
      loading = false;
      notifyListeners();
    } catch (e) {
      loading = false;
      error = e is ApiException ? e.message : 'Không thể tải danh sách cảnh báo SOS';
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
      // If not in alerts, prepend
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

  Future<SosAlert?> triggerSos({
    String emergencyType = 'other',
    String? notes,
  }) async {
    submitting = true;
    error = null;
    notifyListeners();

    try {
      final created = await api.create(
        tripId,
        emergencyType: emergencyType,
        notes: notes,
      );
      alerts = [created, ...alerts];
      submitting = false;
      notifyListeners();
      return created;
    } catch (e) {
      submitting = false;
      error = e is ApiException ? e.message : 'Không thể gửi cảnh báo SOS';
      notifyListeners();
      return null;
    }
  }
}

final sosApiProvider = Provider<SosApi>((ref) {
  return HttpSosApi(ref.watch(apiClientProvider));
});

final sosControllerProvider =
    ChangeNotifierProvider.family<SosController, String>((ref, tripId) {
      final api = ref.watch(sosApiProvider);
      return SosController(tripId: tripId, api: api);
    });
