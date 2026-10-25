import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../auth/application/auth_controller.dart';
import '../data/gps_log_store.dart';
import '../data/gps_tracking_api.dart';
import '../domain/gps_tracking_models.dart';
import 'gps_location_source.dart';
import 'gps_log_sync.dart';

enum GpsTrackingStatus {
  checking,
  active,
  notEligible,
  permissionDenied,
  permissionDeniedForever,
  serviceDisabled,
  unavailable,
}

/// How long a sample may take; a slower fix is treated as "no new sample".
const gpsSampleTimeLimit = Duration(seconds: 8);

/// Eligibility (Trip ongoing, participation) is re-read from the server this often.
const gpsEligibilityRecheckInterval = Duration(minutes: 5);

/// Records GPS breadcrumbs for one Trip while the app is open (CTMS-059):
/// samples every [GpsTrackingContext.samplingIntervalSeconds] (10 s, BR-368),
/// persists the latest fresh sample at every logging boundary (30 s, BR-396),
/// keeps logs locally first and uploads them when possible. Tracking runs only
/// while the server says the caller is eligible (BR-237) and location
/// permission is granted, and stops as soon as either is lost.
class GpsTrackingController extends ChangeNotifier {
  GpsTrackingController({
    required this.tripId,
    required this.api,
    required this.store,
    required this.location,
    DateTime Function()? clock,
    this.autoStart = true,
  }) : _clock = clock ?? DateTime.now {
    if (autoStart) unawaited(start());
  }

  final String tripId;
  final GpsTrackingApi api;
  final GpsLogStore store;
  final GpsLocationSource location;
  final bool autoStart;
  final DateTime Function() _clock;

  GpsTrackingStatus status = GpsTrackingStatus.checking;
  GpsTrackingContext? context;
  GpsSample? lastSample;
  DateTime? lastSampleFailureAt;
  DateTime? lastBoundaryAt;
  bool lastBoundarySkipped = false;
  List<LocalGpsLog> logs = const [];
  bool syncing = false;
  String? error;

  Timer? _sampleTimer;
  Timer? _logTimer;
  Timer? _recheckTimer;
  bool _disposed = false;
  bool _sampling = false;

  int get pendingCount => logs.where((log) => log.syncState == GpsLogSyncState.pending).length;
  int get syncedCount => logs.where((log) => log.syncState == GpsLogSyncState.synced).length;
  int get failedCount => logs.where((log) => log.syncState == GpsLogSyncState.failed).length;
  bool get isTracking => _sampleTimer != null;

  void _changed() {
    if (!_disposed) notifyListeners();
  }

  /// Loads the local buffer, checks eligibility and permission, then starts timers.
  Future<void> start() async {
    logs = await store.read(tripId);
    _changed();
    await refreshEligibility();
  }

  Future<void> refreshEligibility() async {
    try {
      context = await api.context(tripId);
      error = null;
    } catch (_) {
      // Offline: keep the last known decision; a new session stays unavailable
      // until the server confirms eligibility.
      if (context == null) {
        _stopTimers();
        status = GpsTrackingStatus.unavailable;
        error = 'Chưa xác nhận được điều kiện ghi GPS với máy chủ.';
        _changed();
        return;
      }
    }
    final current = context!;
    if (!current.eligible) {
      _stopTimers();
      status = GpsTrackingStatus.notEligible;
      _changed();
      return;
    }
    await _applyPermission(await location.checkPermission());
  }

  Future<void> requestPermission() async {
    await _applyPermission(await location.requestPermission());
  }

  Future<void> _applyPermission(GpsPermissionState permission) async {
    switch (permission) {
      case GpsPermissionState.granted:
        status = GpsTrackingStatus.active;
        _startTimers();
        _changed();
        if (lastSample == null) await sampleNow();
      case GpsPermissionState.denied:
        _stopTimers();
        status = GpsTrackingStatus.permissionDenied;
        _changed();
      case GpsPermissionState.deniedForever:
        _stopTimers();
        status = GpsTrackingStatus.permissionDeniedForever;
        _changed();
      case GpsPermissionState.serviceDisabled:
        _stopTimers();
        status = GpsTrackingStatus.serviceDisabled;
        _changed();
    }
  }

  void _startTimers() {
    final current = context;
    if (current == null || _sampleTimer != null) return;
    _sampleTimer = Timer.periodic(
      Duration(seconds: current.samplingIntervalSeconds),
      (_) => unawaited(sampleNow()),
    );
    _logTimer = Timer.periodic(
      Duration(seconds: current.loggingIntervalSeconds),
      (_) => unawaited(logBoundary()),
    );
    _recheckTimer = Timer.periodic(
      gpsEligibilityRecheckInterval,
      (_) => unawaited(refreshEligibility()),
    );
  }

  void _stopTimers() {
    _sampleTimer?.cancel();
    _logTimer?.cancel();
    _recheckTimer?.cancel();
    _sampleTimer = null;
    _logTimer = null;
    _recheckTimer = null;
  }

  /// Takes one runtime sample. A failed fix leaves [lastSample] untouched and is
  /// shown as stale; a revoked permission stops tracking (BR-237).
  Future<void> sampleNow() async {
    if (status != GpsTrackingStatus.active || _sampling) return;
    _sampling = true;
    try {
      lastSample = await location.currentSample(timeLimit: gpsSampleTimeLimit);
      lastSampleFailureAt = null;
    } catch (_) {
      lastSampleFailureAt = _clock();
      final permission = await location.checkPermission();
      if (permission != GpsPermissionState.granted) {
        await _applyPermission(permission);
        return;
      }
    } finally {
      _sampling = false;
      _changed();
    }
  }

  /// Logging boundary: persists the latest sample captured since the previous
  /// boundary, or nothing when no fresh sample exists (BR-396).
  Future<void> logBoundary() async {
    final current = context;
    if (status != GpsTrackingStatus.active || current == null) return;
    final boundary = _clock();
    final sample = selectBoundarySample(
      latest: lastSample,
      previousBoundary: lastBoundaryAt,
      boundary: boundary,
      loggingInterval: Duration(seconds: current.loggingIntervalSeconds),
    );
    lastBoundaryAt = boundary;
    lastBoundarySkipped = sample == null;
    if (sample != null) {
      final log = LocalGpsLog.fromSample(
        id: newGpsLogId(),
        tripId: tripId,
        sample: sample,
        configVersion: current.configVersion,
      );
      logs = await store.update(tripId, (current) => [...current, log]);
    }
    _changed();
    await syncNow();
  }

  /// Uploads due pending logs; offline errors keep them pending for later.
  Future<void> syncNow({bool force = false}) async {
    if (syncing) return;
    syncing = true;
    _changed();
    try {
      if (force) {
        // "Đồng bộ ngay" skips the retry backoff of pending logs.
        logs = await store.update(
          tripId,
          (current) => [
            for (final log in current)
              log.syncState == GpsLogSyncState.pending
                  ? log.delivery(syncState: GpsLogSyncState.pending, attempts: log.attempts)
                  : log,
          ],
        );
      }
      logs = await synchronizeGpsLogs(tripId: tripId, store: store, api: api, now: _clock());
    } finally {
      syncing = false;
      _changed();
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _stopTimers();
    super.dispose();
  }
}

final gpsTrackingApiProvider = Provider<GpsTrackingApi>(
  (ref) => HttpGpsTrackingApi(ref.watch(apiClientProvider)),
);

final gpsLocationSourceProvider = Provider<GpsLocationSource>(
  (ref) => const GeolocatorLocationSource(),
);

/// One buffer instance per signed-in account, shared by tracking and the
/// device sync screen so their writes are serialized.
final gpsLogStoreProvider = Provider<GpsLogStore>((ref) {
  final user = ref.watch(authControllerProvider).valueOrNull;
  return FileGpsLogStore(user?.id ?? 'anonymous');
});

final gpsTrackingControllerProvider = ChangeNotifierProvider.autoDispose
    .family<GpsTrackingController, String>((ref, tripId) {
      return GpsTrackingController(
        tripId: tripId,
        api: ref.watch(gpsTrackingApiProvider),
        store: ref.watch(gpsLogStoreProvider),
        location: ref.watch(gpsLocationSourceProvider),
      );
    });
