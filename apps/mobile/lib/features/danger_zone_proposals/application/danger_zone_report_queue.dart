import 'dart:math';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_exception.dart';
import '../../auth/application/auth_controller.dart';
import '../../auth/domain/user_role.dart';
import '../data/danger_zone_report_store.dart';
import '../data/danger_zone_reports_api.dart';
import '../domain/danger_zone_report.dart';

String dangerReportError(Object error) {
  if (error is ApiException) {
    final code = error.errorData is Map
        ? (error.errorData as Map)['code']
        : null;
    if (code == 'PROPOSAL_GPS_STALE') {
      return 'Vị trí đã cũ. Vui lòng lấy lại GPS và tạo báo cáo mới.';
    }
    if (code == 'PROPOSAL_OUTSIDE_TRIP') {
      return 'Thời điểm ghi nhận nằm ngoài thời gian chuyến đi.';
    }
    if (code == 'PROPOSAL_REQUEST_CONFLICT') {
      return 'Nội dung báo cáo không khớp với lần gửi trước.';
    }
    if (error.statusCode == 401) {
      return 'Vui lòng đăng nhập lại để gửi báo cáo.';
    }
    if (error.statusCode == 403 || error.statusCode == 404) {
      return 'Bạn không còn quyền gửi báo cáo cho chuyến này.';
    }
    if (error.statusCode == 422 || error.statusCode == 400) {
      return 'Thông tin báo cáo không hợp lệ. Vui lòng kiểm tra lại.';
    }
    if (error.statusCode == 409) {
      return 'Không thể tiếp nhận báo cáo cho chuyến này. Vui lòng kiểm tra lại.';
    }
  }
  return 'Chưa gửi được báo cáo. Ứng dụng sẽ thử lại khi có kết nối.';
}

String dangerPhotoError(Object error) {
  if (error is ApiException) {
    final code = error.errorData is Map
        ? (error.errorData as Map)['code']
        : null;
    if (code == 'PROPOSAL_PHOTO_INVALID' || error.statusCode == 413) {
      return 'Ảnh không hợp lệ. Chỉ gửi ảnh JPEG, PNG hoặc WebP tối đa 5 MB.';
    }
    if (code == 'PROPOSAL_PHOTO_LIMIT') {
      return 'Báo cáo đã đủ $dangerReportMaxPhotos ảnh.';
    }
    if (code == 'PROPOSAL_ALREADY_DECIDED') {
      return 'Báo cáo đã được xét duyệt nên không gửi thêm ảnh.';
    }
    if (error.statusCode == 401) {
      return 'Vui lòng đăng nhập lại để gửi ảnh.';
    }
    if (error.statusCode == 403 || error.statusCode == 404) {
      return 'Bạn không còn quyền gửi ảnh cho báo cáo này.';
    }
  }
  return 'Chưa gửi được ảnh. Ứng dụng sẽ thử lại khi có kết nối.';
}

class DangerZoneReportQueue extends ChangeNotifier with WidgetsBindingObserver {
  DangerZoneReportQueue({
    required this.account,
    required this.store,
    required this.api,
    DateTime Function()? clock,
  }) : clock = clock ?? DateTime.now {
    WidgetsBinding.instance.addObserver(this);
    ready = _load();
  }
  final String account;
  final DangerZoneReportStore store;
  final DangerZoneReportsApi api;
  final DateTime Function() clock;
  final cancel = CancelToken();
  late final Future<void> ready;
  List<DangerZoneReport> records = [];
  final Map<String, List<ReportJson>> remote = {};
  final Map<String, String> listErrors = {};
  final Set<String> restrictedTrips = {};
  String? loadError;
  bool _disposed = false;
  bool _flushing = false;
  String? _inFlightId;
  int commits = 0;
  void _changed() {
    if (!_disposed) notifyListeners();
  }

  Future<void> _load() async {
    try {
      await store.moveLegacyPhotos();
    } catch (_) {
      // Cleanup is best effort; reports themselves are still readable.
    }
    try {
      final loaded = await store.read(account);
      if (_disposed) return;
      records = loaded;
      loadError = null;
    } catch (_) {
      loadError = 'Không đọc được báo cáo đã lưu. Vui lòng thử lại.';
    }
    _changed();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      commits++;
      _changed();
    }
  }

  Future<void> _put(DangerZoneReport report) async {
    await store.put(account, report);
    if (_disposed) return;
    records = [...records.where((v) => v.id != report.id), report];
    _changed();
  }

  Future<void> commit(
    DangerZoneReport report, {
    List<Uint8List> photos = const [],
  }) async {
    await ready;
    if (loadError != null) await _load();
    if (_disposed || loadError != null) throw StateError('Storage unavailable');
    await store.putPhotos(account, report.id, photos);
    await _put(
      DangerZoneReport(
        tripId: report.tripId,
        payload: report.payload,
        photoCount: photos.length,
      ),
    );
    if (_disposed) return;
    commits++;
    _changed();
  }

  Future<void> retry(DangerZoneReport report) async {
    // Only the report currently being sent must not be overwritten; other
    // rows are read from the flush snapshot and are safe to reset.
    if (_disposed || report.id == _inFlightId) return;
    await _put(report.delivery(photoFailed: false));
    commits++;
    _changed();
  }

  Future<void> refresh(String tripId) async {
    try {
      final rows = await api.list(account, tripId, cancel);
      if (_disposed) return;
      remote[tripId] = rows;
      restrictedTrips.remove(tripId);
      listErrors.remove(tripId);
      for (final row in rows) {
        final local = records
            .where((v) => v.tripId == tripId && v.id == row['clientRequestId'])
            .firstOrNull;
        if (local != null) await _put(local.delivery(server: row));
      }
    } catch (error) {
      if (_disposed) return;
      if (error is ApiException && [401, 403, 404].contains(error.statusCode)) {
        remote.remove(tripId);
        restrictedTrips.add(tripId);
      }
      listErrors[tripId] = dangerReportError(error);
    }
    _changed();
  }

  /// Returns true while transient failures or delayed work remain.
  Future<bool> flush() async {
    await ready;
    if (_disposed || _flushing) return false;
    if (loadError != null) {
      await _load();
      if (loadError != null) return true;
    }
    _flushing = true;
    try {
      for (final record in List<DangerZoneReport>.of(records)) {
        if (_disposed) return false;
        if (!record.pending ||
            (record.nextAttemptAt?.isAfter(clock()) ?? false)) {
          continue;
        }
        _inFlightId = record.id;
        var current = record;
        try {
          if (current.server == null) {
            final server = await api.send(
              account,
              current.tripId,
              current.payload,
              cancel,
            );
            if (_disposed) return false;
            current = current.delivery(server: server);
            await _put(current);
          }
          // The report reaches the Admin first; photos follow in their saved order.
          while (current.photosPending) {
            final index = current.photosSent;
            final bytes = await store.readPhoto(account, current.id, index);
            if (_disposed) return false;
            if (bytes == null) {
              current = current.delivery(
                photoFailed: true,
                photoError: 'Không tìm thấy ảnh đã lưu trên máy.',
              );
              await _put(current);
              break;
            }
            final server = await api.uploadPhoto(
              account,
              current.tripId,
              current.server!['id'] as String,
              bytes,
              cancel,
            );
            if (_disposed) return false;
            current = current.delivery(
              server: server,
              photosSent: index + 1,
              photoFailed: false,
            );
            await _put(current);
            await store.deletePhoto(account, current.id, index);
          }
        } catch (error) {
          if (_disposed) return false;
          final status = error is ApiException ? error.statusCode : null;
          final retry =
              status == null || status == 408 || status == 429 || status >= 500;
          final photoStep = current.server != null;
          await _put(
            current.delivery(
              failed: !photoStep && !retry,
              attempts: current.attempts + 1,
              nextAttemptAt: retry
                  ? clock().add(
                      Duration(
                        seconds: min(
                          300,
                          5 * pow(2, min(current.attempts, 6)).toInt(),
                        ),
                      ),
                    )
                  : null,
              error: photoStep ? null : dangerReportError(error),
              photoFailed: photoStep ? !retry : null,
              photoError: photoStep ? dangerPhotoError(error) : null,
            ),
          );
        } finally {
          _inFlightId = null;
        }
      }
      return records.any((v) => v.pending);
    } catch (_) {
      loadError = 'Không cập nhật được báo cáo đã lưu. Ứng dụng sẽ thử lại.';
      return true;
    } finally {
      _flushing = false;
      _changed();
    }
  }

  @override
  void dispose() {
    _disposed = true;
    cancel.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }
}

final dangerZoneReportQueueProvider =
    ChangeNotifierProvider<DangerZoneReportQueue?>((ref) {
      final user = ref.watch(authControllerProvider).valueOrNull;
      if (user == null ||
          !(user.role == UserRole.porter ||
              user.roles.contains(UserRole.porter))) {
        return null;
      }
      return DangerZoneReportQueue(
        account: user.id,
        store: ref.watch(dangerZoneReportStoreProvider),
        api: ref.watch(dangerZoneReportsApiProvider),
      );
    });
