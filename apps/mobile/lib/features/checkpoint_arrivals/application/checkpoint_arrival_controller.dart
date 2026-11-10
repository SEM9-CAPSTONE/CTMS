import 'dart:async';
import 'dart:math';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../auth/application/auth_controller.dart';
import '../../gps_tracking/application/gps_location_source.dart';
import '../../gps_tracking/application/gps_tracking_controller.dart';
import '../../gps_tracking/domain/gps_tracking_models.dart';
import '../data/checkpoint_arrival_api.dart';
import '../data/checkpoint_arrival_store.dart';
import '../data/checkpoint_context_provider.dart';
import '../domain/checkpoint_arrival_detector.dart';
import '../domain/checkpoint_arrival_models.dart';
import 'checkpoint_arrival_sync.dart';

enum CheckpointArrivalStatus {
  checking,
  active,
  paused,
  unavailable,
}

/// Phát âm thanh và rung thông báo khi Camper đến một Checkpoint (CTMS-061).
Future<void> playCheckpointReachedAlert() async {
  try {
    await HapticFeedback.heavyImpact();
    await SystemSound.play(SystemSoundType.alert);
  } catch (_) {}
}

Future<bool> _deviceIsOnline() async {
  try {
    final results = await Connectivity().checkConnectivity();
    return !results.contains(ConnectivityResult.none);
  } catch (_) {
    return true;
  }
}

/// Tạo UUID v4 RFC 4122 cho sự kiện đến điểm kiểm tra.
String newCheckpointArrivalId() {
  final random = Random.secure();
  final bytes = List<int>.generate(16, (_) => random.nextInt(256));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  final hex = bytes.map((v) => v.toRadixString(16).padLeft(2, '0')).join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-'
      '${hex.substring(16, 20)}-${hex.substring(20)}';
}

/// Quản lý vòng đời và trạng thái phát hiện tự động điểm kiểm tra (CTMS-061).
/// Tiêu thụ mẫu GPS thô 10s trực tiếp từ [GpsTrackingController] mà không tạo
/// luồng GPS thứ hai, bảo đảm 3 mẫu hợp lệ liên tiếp trong bán kính 20m.
class CheckpointArrivalController extends ChangeNotifier {
  CheckpointArrivalController({
    required this.tripId,
    required this.gps,
    required this.api,
    required this.store,
    required this.contextProvider,
    DateTime Function()? clock,
    Future<bool> Function()? isOnline,
    Future<void> Function()? alert,
    this.autoStart = true,
  })  : _clock = clock ?? DateTime.now,
        _isOnline = isOnline ?? _deviceIsOnline,
        _alert = alert ?? playCheckpointReachedAlert {
    gps.addListener(_onGpsChanged);
    if (autoStart) {
      unawaited(start());
    }
  }

  final String tripId;
  final GpsTrackingController gps;
  final CheckpointArrivalApi api;
  final CheckpointArrivalStore store;
  final CheckpointContextProvider contextProvider;
  final bool autoStart;
  final DateTime Function() _clock;
  final Future<bool> Function() _isOnline;
  final Future<void> Function() _alert;

  CheckpointArrivalStatus status = CheckpointArrivalStatus.checking;
  CheckpointArrivalRecord record = const CheckpointArrivalRecord();
  CheckpointArrivalContext? context;
  CheckpointArrivalDetector? detector;

  bool syncing = false;
  String? error;

  /// Hàng đợi thông báo khi đến Checkpoint (tránh xung đột hiển thị nếu phát hiện nhiều điểm)
  final List<RouteCheckpoint> _reachedQueue = [];
  RouteCheckpoint? activeReachedDialog;

  bool _started = false;
  bool _disposed = false;
  DateTime? _lastProcessedSampleAt;
  Future<void> _queue = Future.value();
  Future<void>? _syncRun;
  bool _syncAgain = false;
  bool _forceAgain = false;

  @visibleForTesting
  Future<void> get processingQueue => _queue;

  int get reachedCount => record.arrivals.length;
  int get totalCount => context?.checkpoints.length ?? 0;
  int get pendingCount =>
      record.arrivals.where((a) => a.syncState == CheckpointSyncState.pending).length;
  int get syncedCount =>
      record.arrivals.where((a) => a.syncState == CheckpointSyncState.synced).length;
  int get pausedCount =>
      record.arrivals.where((a) => a.syncState == CheckpointSyncState.paused).length;
  int get failedCount =>
      record.arrivals.where((a) => a.syncState == CheckpointSyncState.failed).length;

  List<CheckpointUiItem> get uiItems {
    final currentContext = context;
    if (currentContext == null) return const [];

    final arrivalsByCpId = {
      for (final a in record.arrivals) a.checkpointId: a,
    };

    final currentGps = gps.lastSample;

    return currentContext.checkpoints.map((cp) {
      final arrival = arrivalsByCpId[cp.id];
      final distanceMeters = currentGps != null
          ? calculateHaversineDistanceMeters(
              lat1: currentGps.latitude,
              lon1: currentGps.longitude,
              lat2: cp.latitude,
              lon2: cp.longitude,
            )
          : null;

      return CheckpointUiItem(
        checkpoint: cp,
        isReached: arrival != null,
        confirmedAt: arrival?.confirmedAt,
        syncState: arrival?.syncState,
        lastDistanceMeters: distanceMeters,
        qualifyingSamplesCount: detector?.candidateCountFor(cp.id) ?? 0,
      );
    }).toList();
  }

  void _changed() {
    if (!_disposed) notifyListeners();
  }

  Future<void> _enqueue(Future<void> Function() step) {
    final next = _queue.then((_) => _disposed ? null : step());
    _queue = next.then((_) {}, onError: (Object _) {});
    return next;
  }

  Future<void> start() async {
    record = await store.read(tripId);
    _changed();
    await refreshContext();
    _started = true;
    _onGpsChanged();
    unawaited(syncNow());
  }

  Future<void> refreshContext() async {
    try {
      context = await contextProvider.getContext(tripId);
      error = null;
    } catch (e) {
      error = 'Không thể tải dữ liệu điểm kiểm tra: $e';
    }

    _updateStatus();
    _initDetector();
  }

  void _updateStatus() {
    final current = context;
    if (current == null || current.checkpoints.isEmpty) {
      status = CheckpointArrivalStatus.unavailable;
    } else if (gps.isTracking) {
      status = CheckpointArrivalStatus.active;
    } else {
      status = CheckpointArrivalStatus.paused;
    }
    _changed();
  }

  void _initDetector() {
    final current = context;
    if (current == null || current.checkpoints.isEmpty) {
      detector = null;
      return;
    }

    final confirmedIds = record.arrivals.map((a) => a.checkpointId).toSet();
    detector = CheckpointArrivalDetector(
      context: current,
      initialReachedCheckpointIds: confirmedIds,
    );
  }

  void _onGpsChanged() {
    if (!_started || _disposed) return;
    _updateStatus();

    if (status != CheckpointArrivalStatus.active || detector == null) return;

    final sample = gps.lastSample;
    if (sample != null && sample.capturedAt != _lastProcessedSampleAt) {
      _lastProcessedSampleAt = sample.capturedAt;
      unawaited(processSample(sample));
    }
  }

  Future<void> processSample(GpsSample sample) {
    return _enqueue(() async {
      if (detector == null || context == null) return;

      final newlyReached = detector!.onSample(sample);
      _changed();
      if (newlyReached.isEmpty) return;

      final isOnline = await _isOnline();
      final currentCtx = context!;

      for (final item in newlyReached) {
        // Kiểm tra xem đã ghi nhận trước đó chưa
        final alreadyRecorded =
            record.arrivals.any((a) => a.checkpointId == item.checkpoint.id);
        if (alreadyRecorded) continue;

        final arrival = LocalCheckpointArrival(
          id: newCheckpointArrivalId(),
          tripId: tripId,
          checkpointId: item.checkpoint.id,
          routeId: currentCtx.routeId,
          routeVersion: currentCtx.routeVersion,
          packageId: currentCtx.packageId,
          packageVersion: currentCtx.packageVersion,
          detectedOffline: !isOnline,
          confirmedAt: item.detectedAt,
          samples: item.samples
              .map((s) => CheckpointArrivalSample.fromGpsSample(s))
              .toList(),
          syncState: CheckpointSyncState.pending,
          attempts: 0,
        );

        // 1. Lưu ngay vào bộ nhớ cục bộ nguyên tử
        record = await store.update(
          tripId,
          (current) => current.copyWith(
            arrivals: [...current.arrivals, arrival],
          ),
        );

        // 2. Kích hoạt báo động rung và chuông
        await _alert();

        // 3. Đưa vào hàng đợi hiển thị pop-up thông báo
        _enqueueReachedDialog(item.checkpoint);

        // 4. Kích hoạt đồng bộ ngầm
        unawaited(syncNow());
      }

      _changed();
    });
  }

  void _enqueueReachedDialog(RouteCheckpoint cp) {
    if (activeReachedDialog == null) {
      activeReachedDialog = cp;
    } else {
      _reachedQueue.add(cp);
    }
    _changed();
  }

  void dismissReachedDialog() {
    if (_reachedQueue.isNotEmpty) {
      activeReachedDialog = _reachedQueue.removeAt(0);
    } else {
      activeReachedDialog = null;
    }
    _changed();
  }

  /// Đồng bộ bản ghi lên server. Nếu đang có lượt sync chạy, lượt sau sẽ tự động
  /// được kích hoạt ngay khi lượt trước xong (chống bỏ sót bản ghi vừa xác nhận).
  Future<void> syncNow({bool force = false}) {
    final running = _syncRun;
    if (running != null) {
      _syncAgain = true;
      _forceAgain = _forceAgain || force;
      return running;
    }
    return _syncRun = _runSync(force).whenComplete(() => _syncRun = null);
  }

  Future<void> _runSync(bool initialForce) async {
    syncing = true;
    _changed();
    try {
      var currentForce = initialForce;
      do {
        _syncAgain = false;
        final runForce = currentForce || _forceAgain;
        _forceAgain = false;
        await _syncOnce(force: runForce);
        currentForce = false;
      } while (_syncAgain && !_disposed);
    } finally {
      syncing = false;
      _changed();
    }
  }

  Future<void> _syncOnce({required bool force}) async {
    try {
      if (force) {
        final currentCtx = context;
        record = await store.update(
          tripId,
          (current) => current.copyWith(
            arrivals: [
              for (final a in current.arrivals)
                (a.syncState == CheckpointSyncState.paused ||
                        a.syncState == CheckpointSyncState.failed)
                    ? a.resetForRetry().copyWith(
                        routeId: currentCtx?.routeId ?? a.routeId,
                        routeVersion: currentCtx?.routeVersion ?? a.routeVersion,
                        packageId: currentCtx?.packageId ?? a.packageId,
                        packageVersion:
                            currentCtx?.packageVersion ?? a.packageVersion,
                      )
                    : a,
            ],
          ),
        );
      }
      record = await synchronizeCheckpointArrivals(
        tripId: tripId,
        store: store,
        api: api,
        now: _clock(),
        isOnline: await _isOnline(),
      );
      error = null;
    } catch (e) {
      error = e.toString();
    }
  }

  Future<void> manualSync({bool force = true}) => syncNow(force: force);

  /// Đặt lại dữ liệu kiểm thử để quay video evidence từ đầu (0/4 trạm).
  @visibleForTesting
  Future<void> resetData() async {
    await store.clear(tripId);
    record = CheckpointArrivalRecord(tripId: tripId, userId: record.userId);
    _initDetector();
    GeolocatorLocationSource.simulatedLat = null;
    GeolocatorLocationSource.simulatedLon = null;
    _lastProcessedSampleAt = null;
    _reachedQueue.clear();
    activeReachedDialog = null;
    _changed();
  }

  /// Đặt lại riêng trạm cuối cùng (chuyển 4/4 về 3/4) để kiểm thử kịch bản ngoại tuyến.
  @visibleForTesting
  Future<void> resetLastCheckpoint() async {
    final currentCtx = context;
    if (currentCtx == null || currentCtx.checkpoints.isEmpty) return;
    final lastCp = currentCtx.checkpoints.last;
    await store.update(tripId, (current) {
      return current.copyWith(
        arrivals: current.arrivals
            .where((a) => a.checkpointId != lastCp.id)
            .toList(),
      );
    });
    record = await store.read(tripId);
    _initDetector();
    _lastProcessedSampleAt = null;
    _reachedQueue.removeWhere((cp) => cp.id == lastCp.id);
    if (activeReachedDialog?.id == lastCp.id) {
      activeReachedDialog = null;
    }
    _changed();
  }

  @override
  void dispose() {
    _disposed = true;
    gps.removeListener(_onGpsChanged);
    super.dispose();
  }
}

final checkpointContextProvider = Provider<CheckpointContextProvider>((ref) {
  return HttpCheckpointContextProvider(
    client: ref.watch(apiClientProvider),
  );
});

final checkpointArrivalApiProvider = Provider<CheckpointArrivalApi>((ref) {
  return CheckpointArrivalApi(ref.watch(apiClientProvider));
});

final checkpointArrivalStoreProvider = Provider<CheckpointArrivalStore>((ref) {
  final user = ref.watch(authControllerProvider).valueOrNull;
  return CheckpointArrivalStore.create(user?.id ?? 'anonymous');
});

final checkpointArrivalControllerProvider = ChangeNotifierProvider.autoDispose
    .family<CheckpointArrivalController, String>((ref, tripId) {
  return CheckpointArrivalController(
    tripId: tripId,
    gps: ref.watch(gpsTrackingControllerProvider(tripId).notifier),
    api: ref.watch(checkpointArrivalApiProvider),
    store: ref.watch(checkpointArrivalStoreProvider),
    contextProvider: ref.watch(checkpointContextProvider),
  );
});
