import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/api/api_exception.dart';
import '../auth/application/auth_controller.dart';
import 'notification_preferences_api.dart';

enum PreferenceSaveResult { saved, failed, ignored }

class NotificationPreferencesController extends ChangeNotifier {
  NotificationPreferencesController(this.api) {
    unawaited(load());
  }

  final NotificationPreferencesApi api;
  NotificationPreferences? current;
  final _draft = <String, bool>{};
  bool loading = false;
  bool saving = false;
  bool needsReload = false;
  bool _disposed = false;
  String? error;

  bool value(NotificationCategory item) =>
      _draft[item.id] ?? item.effectiveEnabled;
  bool get dirty => changes.isNotEmpty;
  Map<String, bool> get changes => {
    for (final item in current?.categories ?? <NotificationCategory>[])
      if (item.configurable &&
          _draft.containsKey(item.id) &&
          _draft[item.id] != item.enabled)
        item.id: _draft[item.id]!,
  };

  void change(NotificationCategory item, bool enabled) {
    if (_disposed || saving || loading || !item.configurable) return;
    _draft[item.id] = enabled;
    notifyListeners();
  }

  Future<void> load() async {
    if (_disposed || loading || saving) return;
    loading = true;
    error = null;
    notifyListeners();
    try {
      final snapshot = await api.load();
      if (_disposed) return;
      current = snapshot;
      _draft.removeWhere(
        (id, _) => !snapshot.categories.any(
          (item) => item.id == id && item.configurable,
        ),
      );
      needsReload = false;
    } catch (_) {
      if (!_disposed) {
        error =
            'Chưa tải được tùy chọn thông báo. Kiểm tra kết nối rồi thử lại.';
      }
    } finally {
      if (!_disposed) {
        loading = false;
        notifyListeners();
      }
    }
  }

  Future<PreferenceSaveResult> save() async {
    final snapshot = current;
    if (_disposed ||
        saving ||
        loading ||
        needsReload ||
        snapshot == null ||
        !dirty) {
      return PreferenceSaveResult.ignored;
    }
    saving = true;
    error = null;
    notifyListeners();
    try {
      final confirmed = await api.save(snapshot.version, changes);
      if (_disposed) return PreferenceSaveResult.ignored;
      current = confirmed;
      _draft.clear();
      return PreferenceSaveResult.saved;
    } catch (failure) {
      if (_disposed) return PreferenceSaveResult.ignored;
      final status = failure is ApiException ? failure.statusCode : null;
      needsReload = status == 409;
      error = switch (status) {
        409 =>
          'Tùy chọn đã thay đổi ở phiên khác. Tải lại để xem trạng thái mới; lựa chọn chưa lưu của bạn được giữ lại.',
        422 =>
          'Một số tùy chọn không còn cho phép thay đổi. Tải lại để kiểm tra danh mục mới.',
        401 => 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
        _ =>
          'Chưa lưu được tùy chọn. Kiểm tra kết nối rồi thử lại. Lựa chọn của bạn vẫn được giữ.',
      };
      if (status == 422) needsReload = true;
      return PreferenceSaveResult.failed;
    } finally {
      if (!_disposed) {
        saving = false;
        notifyListeners();
      }
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _draft.clear();
    api.dispose();
    super.dispose();
  }
}

final notificationPreferencesProvider =
    ChangeNotifierProvider.autoDispose<NotificationPreferencesController?>((
      ref,
    ) {
      final account = ref.watch(
        authControllerProvider.select((state) => state.valueOrNull?.id),
      );
      if (account == null) return null;
      return NotificationPreferencesController(
        HttpNotificationPreferencesApi(ref.watch(apiClientProvider), account),
      );
    });
