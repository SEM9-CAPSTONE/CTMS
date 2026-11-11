import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';

import '../../auth/application/auth_controller.dart';
import '../../gps_tracking/application/gps_location_source.dart';
import '../../gps_tracking/application/gps_tracking_controller.dart';
import '../../offline_packages/data/package_download_store.dart';
import '../../offline_packages/data/package_integrity_service.dart';
import '../../offline_packages/data/offline_basemap_store.dart';
import '../data/offline_map_package_reader.dart';
import '../domain/offline_map_models.dart';

/// Provider cung cấp bộ đọc gói bản đồ ngoại tuyến đã xác thực.
final offlineMapPackageReaderProvider =
    FutureProvider.autoDispose<OfflineMapPackageReader>((ref) async {
      if (kIsWeb) {
        throw UnsupportedError('Offline packages require device file storage.');
      }
      final userId = ref.watch(authControllerProvider).valueOrNull?.id;
      if (userId == null) {
        throw StateError('Người dùng chưa đăng nhập.');
      }
      final directory = await getApplicationSupportDirectory();
      final store = PackageDownloadStore(
        Directory('${directory.path}/offline-packages/$userId'),
      );
      final integrity = PackageIntegrityService(store);
      return DefaultOfflineMapPackageReader(store: store, integrity: integrity);
    });

/// Provider quản lý toàn bộ logic ngữ cảnh bản đồ và vị trí GPS offline cho chuyến đi.
final offlineMapControllerProvider = ChangeNotifierProvider.autoDispose
    .family<OfflineMapController, String>((ref, tripId) {
      final gps = ref.watch(gpsTrackingControllerProvider(tripId).notifier);
      final locationSource = ref.watch(gpsLocationSourceProvider);

      final controller = OfflineMapController(
        tripId: tripId,
        packageReaderFuture: () =>
            ref.read(offlineMapPackageReaderProvider.future),
        gps: gps,
        locationSource: locationSource,
        basemapPathFor: (context) async {
          final store = await ref.read(offlineBasemapStoreProvider.future);
          final active = await store.coreStore.active(tripId);
          if (active == null ||
              active.id != context.packageId ||
              active.packageVersion.toString() !=
                  context.packageVersion.toString()) {
            return null;
          }
          return store.verifiedPath(active);
        },
      );
      ref.onDispose(controller.dispose);
      return controller;
    });

/// Quản lý logic ngữ cảnh bản đồ offline và vị trí GPS thật cho một chuyến đi (CTMS-307).
///
/// Phục vụ hiển thị cho màn hình bản đồ ngoại tuyến (CTMS-308):
/// 1. Đọc và xác thực route + checkpoints từ gói offline đang active.
/// 2. Tái sử dụng nguồn GPS thô từ [GpsTrackingController] mà không tạo luồng theo dõi trùng lặp.
/// 3. Phân biệt rõ các trạng thái: thiếu package, package hỏng, thu hồi quyền, GPS tắt, tín hiệu yếu.
/// 4. Tuyệt đối không tạo tọa độ giả khi mất tín hiệu.
class OfflineMapController extends ChangeNotifier {
  OfflineMapController({
    required this.tripId,
    OfflineMapPackageReader? packageReader,
    Future<OfflineMapPackageReader> Function()? packageReaderFuture,
    this.gps,
    this.locationSource,
    this.basemapPathFor,
    DateTime Function()? clock,
    this.autoStart = true,
  }) : _packageReader = packageReader,
       _packageReaderFuture = packageReaderFuture,
       _clock = clock ?? DateTime.now {
    _state = OfflineMapState(tripId: tripId);
    gps?.addListener(_onGpsChanged);
    if (autoStart) {
      unawaited(start());
    }
  }

  final String tripId;
  final OfflineMapPackageReader? _packageReader;
  final Future<OfflineMapPackageReader> Function()? _packageReaderFuture;
  final GpsTrackingController? gps;
  final GpsLocationSource? locationSource;
  final Future<String?> Function(OfflineMapContext)? basemapPathFor;
  String? basemapPath;
  final DateTime Function() _clock;
  final bool autoStart;

  late OfflineMapState _state;
  OfflineMapState get state => _state;

  bool _disposed = false;
  Timer? _staleTicker;
  DateTime? _lastSampleCapturedAt;
  bool _lastKnownStale = false;

  DateTime get now => _clock();

  void _emit(OfflineMapState newState) {
    if (_disposed) return;
    _state = newState;
    if (_state.location.sample != null) {
      _lastKnownStale = _state.location.isStale(_clock());
    } else {
      _lastKnownStale = false;
    }
    notifyListeners();
  }

  /// Khởi tạo: đọc active package từ disk và thiết lập trạng thái định vị ban đầu.
  Future<void> start() async {
    try {
      await reloadPackage();
      if (_disposed) return;
      _startStaleTicker();
      if (gps != null) {
        _onGpsChanged();
      } else if (locationSource != null) {
        await refreshLocation();
      }
    } catch (e) {
      if (_disposed) return;
      // Tránh để UI bị kẹt ở trạng thái loading nếu có ngoại lệ bất ngờ xảy ra
      if (_state.packageStatus == OfflineMapPackageStatus.loading) {
        _emit(
          _state.copyWith(
            packageStatus: OfflineMapPackageStatus.packageInvalid,
            clearContext: true,
            errorMessage: 'Lỗi khởi chạy bản đồ: $e',
          ),
        );
      }
    }
  }

  DateTime _lastReloadPackageAt = DateTime.fromMillisecondsSinceEpoch(0);

  /// Tải lại gói dữ liệu ngoại tuyến active cho chuyến đi.
  /// Debounce 2 giây để tránh đọc đĩa trùng lặp khi nhiều màn hình cùng gọi reload (ví dụ panel + full-screen screen cùng nhận resume).
  Future<void> reloadPackage({bool force = false}) async {
    if (_disposed) return;
    final currentTime = _clock();
    if (!force &&
        currentTime.difference(_lastReloadPackageAt) <
            const Duration(seconds: 2)) {
      return;
    }
    _lastReloadPackageAt = currentTime;
    basemapPath = null;

    _emit(
      _state.copyWith(
        packageStatus: OfflineMapPackageStatus.loading,
        clearError: true,
      ),
    );

    try {
      final reader = _packageReader ?? (await _packageReaderFuture?.call());
      if (_disposed) return;
      if (reader == null) {
        _emit(
          _state.copyWith(
            packageStatus: OfflineMapPackageStatus.packageMissing,
            errorMessage: 'Chưa khởi tạo được bộ đọc gói ngoại tuyến.',
          ),
        );
        return;
      }

      final context = await reader.readActivePackage(tripId);
      if (_disposed) return;
      if (context == null) {
        _emit(
          _state.copyWith(
            packageStatus: OfflineMapPackageStatus.packageMissing,
            clearContext: true,
          ),
        );
      } else {
        try {
          basemapPath = await basemapPathFor?.call(context);
        } catch (_) {
          basemapPath = null;
        }
        if (_disposed) return;
        _emit(
          _state.copyWith(
            packageStatus: OfflineMapPackageStatus.ready,
            context: context,
            clearError: true,
          ),
        );
      }
    } on UnsupportedError {
      _emit(
        _state.copyWith(
          packageStatus: OfflineMapPackageStatus.unsupportedPlatform,
          clearContext: true,
          errorMessage:
              'Gói bản đồ ngoại tuyến hiện chỉ hỗ trợ ứng dụng trên thiết bị Android/iOS.',
        ),
      );
    } on OfflineMapAccessDeniedException catch (e) {
      basemapPath = null;
      _emit(
        _state.copyWith(
          packageStatus: OfflineMapPackageStatus.accessDenied,
          clearContext: true,
          errorMessage: e.message,
        ),
      );
    } on OfflineMapPackageInvalidException catch (e) {
      _emit(
        _state.copyWith(
          packageStatus: OfflineMapPackageStatus.packageInvalid,
          clearContext: true,
          errorMessage: e.message,
        ),
      );
    } catch (e) {
      _emit(
        _state.copyWith(
          packageStatus: OfflineMapPackageStatus.packageInvalid,
          clearContext: true,
          errorMessage: 'Lỗi không xác định khi đọc gói: $e',
        ),
      );
    }
  }

  /// Timer nhẹ định kỳ re-evaluate cờ [isStale] khi thời gian trôi qua.
  /// Chỉ kích hoạt [notifyListeners] khi trạng thái stale thực sự thay đổi,
  /// hoàn toàn không đo GPS và không tạo luồng GPS thứ hai.
  void _startStaleTicker() {
    _staleTicker?.cancel();
    _staleTicker = Timer.periodic(kStaleCheckInterval, (_) {
      if (_disposed || _state.location.sample == null) return;
      final currentlyStale = _state.location.isStale(_clock());
      if (currentlyStale != _lastKnownStale) {
        _lastKnownStale = currentlyStale;
        notifyListeners();
      }
    });
  }

  /// Lắng nghe cập nhật từ [GpsTrackingController] khi chuyến đi đang bật tracking.
  void _onGpsChanged() {
    if (_disposed || gps == null) return;

    final gpsStatus = gps!.status;
    switch (gpsStatus) {
      case GpsTrackingStatus.permissionDenied:
        _emit(
          _state.copyWith(
            location: const OfflineMapLocationState(
              status: OfflineMapGpsStatus.permissionDenied,
              errorMessage: 'Chưa cấp quyền truy cập vị trí.',
            ),
          ),
        );
        return;

      case GpsTrackingStatus.permissionDeniedForever:
        _emit(
          _state.copyWith(
            location: const OfflineMapLocationState(
              status: OfflineMapGpsStatus.permissionDeniedForever,
              errorMessage:
                  'Quyền vị trí đã bị từ chối vĩnh viễn trong cài đặt.',
            ),
          ),
        );
        return;

      case GpsTrackingStatus.serviceDisabled:
        _emit(
          _state.copyWith(
            location: const OfflineMapLocationState(
              status: OfflineMapGpsStatus.serviceDisabled,
              errorMessage: 'Dịch vụ định vị GPS trên thiết bị đang tắt.',
            ),
          ),
        );
        return;

      case GpsTrackingStatus.unavailable:
      case GpsTrackingStatus.notEligible:
        _emit(
          _state.copyWith(
            location: const OfflineMapLocationState(
              status: OfflineMapGpsStatus.unavailable,
              errorMessage: 'Tính năng theo dõi vị trí hiện không khả dụng.',
            ),
          ),
        );
        return;

      case GpsTrackingStatus.checking:
        if (_state.location.sample == null) {
          _emit(
            _state.copyWith(
              location: const OfflineMapLocationState(
                status: OfflineMapGpsStatus.checking,
              ),
            ),
          );
        }
        break;

      case GpsTrackingStatus.active:
        break;
    }

    final sample = gps!.lastSample;
    if (sample != null && sample.capturedAt != _lastSampleCapturedAt) {
      _lastSampleCapturedAt = sample.capturedAt;
      _emit(
        _state.copyWith(
          location: OfflineMapLocationState(
            sample: sample,
            status: OfflineMapGpsStatus.ready,
          ),
        ),
      );
    }
  }

  DateTime _lastRefreshLocationAt = DateTime.fromMillisecondsSinceEpoch(0);
  bool _isRefreshingLocation = false;

  /// Lấy mẫu vị trí đơn lẻ qua [locationSource] khi không có [GpsTrackingController] đang chạy.
  /// Debounce 2 giây và cờ [_isRefreshingLocation] để tránh đo GPS trùng lặp
  /// khi nhiều widget (Panel + Screen) cùng nhận sự kiện resume.
  Future<void> refreshLocation({bool force = false}) async {
    if (_disposed) return;
    final currentTime = _clock();
    if (!force &&
        currentTime.difference(_lastRefreshLocationAt) <
            const Duration(seconds: 2)) {
      return;
    }
    if (_isRefreshingLocation) return;
    _isRefreshingLocation = true;
    _lastRefreshLocationAt = currentTime;

    try {
      // Nếu GPS tracking đang hoạt động thì giao toàn quyền cho luồng chính, không gọi song song
      if (gps != null && gps!.isTracking) {
        await gps!.sampleNow();
        return;
      }

      if (locationSource == null) return;

      final permission = await locationSource!.checkPermission();
      if (_disposed) return;
      switch (permission) {
        case GpsPermissionState.denied:
          _emit(
            _state.copyWith(
              location: const OfflineMapLocationState(
                status: OfflineMapGpsStatus.permissionDenied,
                errorMessage: 'Chưa cấp quyền truy cập vị trí.',
              ),
            ),
          );
          return;

        case GpsPermissionState.deniedForever:
          _emit(
            _state.copyWith(
              location: const OfflineMapLocationState(
                status: OfflineMapGpsStatus.permissionDeniedForever,
                errorMessage: 'Quyền vị trí bị từ chối vĩnh viễn.',
              ),
            ),
          );
          return;

        case GpsPermissionState.serviceDisabled:
          _emit(
            _state.copyWith(
              location: const OfflineMapLocationState(
                status: OfflineMapGpsStatus.serviceDisabled,
                errorMessage: 'Dịch vụ GPS trên thiết bị đang tắt.',
              ),
            ),
          );
          return;

        case GpsPermissionState.granted:
          break;
      }

      try {
        final sample = await locationSource!.currentSample(
          timeLimit: const Duration(seconds: 8),
        );
        if (_disposed) return;
        _lastSampleCapturedAt = sample.capturedAt;
        _emit(
          _state.copyWith(
            location: OfflineMapLocationState(
              sample: sample,
              status: OfflineMapGpsStatus.ready,
            ),
          ),
        );
      } catch (_) {
        if (_disposed) return;
        // Khi mất fix hoặc timeout: không tạo tọa độ giả
        if (_state.location.sample == null) {
          _emit(
            _state.copyWith(
              location: const OfflineMapLocationState(
                status: OfflineMapGpsStatus.unavailable,
                errorMessage: 'Chưa nhận được tín hiệu định vị vệ tinh.',
              ),
            ),
          );
        }
      }
    } finally {
      _isRefreshingLocation = false;
    }
  }

  @override
  void dispose() {
    if (_disposed) return;
    _disposed = true;
    _staleTicker?.cancel();
    _staleTicker = null;
    try {
      gps?.removeListener(_onGpsChanged);
    } catch (_) {
      // Phòng ngừa ngoại lệ nếu gps controller đã bị dispose trước
    }
    super.dispose();
  }
}
