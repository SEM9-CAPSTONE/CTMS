import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../auth/application/auth_controller.dart';
import '../../gps_tracking/application/gps_tracking_controller.dart';
import '../../gps_tracking/domain/gps_tracking_models.dart';
import '../data/route_deviation_api.dart';
import '../data/route_deviation_store.dart';
import '../domain/route_deviation_detector.dart';
import '../domain/route_deviation_models.dart';
import 'safety_event_sync.dart';

/// The only detection configuration this client implements (spec Section 8).
const supportedRouteDeviationConfigVersion = 'v3';

/// How often the GPS_DEGRADED rule is evaluated while tracking.
const routeDeviationTickInterval = Duration(seconds: 5);

enum RouteDeviationStatus { checking, active, paused, notEligible, unavailable }

/// Plays the local OFF_ROUTE warning regardless of connectivity (BR-384).
Future<void> playOffRouteAlert() async {
  await HapticFeedback.heavyImpact();
  await SystemSound.play(SystemSoundType.alert);
}

Future<bool> deviceIsOnline() async {
  try {
    final results = await Connectivity().checkConnectivity();
    return !results.contains(ConnectivityResult.none);
  } catch (_) {
    return true;
  }
}

/// Runs on-device route-deviation detection for one Trip (CTMS-060). It consumes
/// the samples already taken by [GpsTrackingController] (no second GPS stream),
/// so it is active exactly while breadcrumbs are recorded: Trip ongoing,
/// participant eligible and location permission granted. Confirmed transitions
/// are persisted with their state before anything else happens (BR-386), then
/// warned locally and synchronized when possible.
class RouteDeviationController extends ChangeNotifier {
  RouteDeviationController({
    required this.tripId,
    required this.gps,
    required this.api,
    required this.store,
    DateTime Function()? clock,
    Future<bool> Function()? isOnline,
    Future<void> Function()? alert,
    this.autoStart = true,
  }) : _clock = clock ?? DateTime.now,
       _isOnline = isOnline ?? deviceIsOnline,
       _alert = alert ?? playOffRouteAlert {
    gps.addListener(_onGpsChanged);
    if (autoStart) unawaited(start());
  }

  final String tripId;
  final GpsTrackingController gps;
  final RouteDeviationApi api;
  final RouteDeviationStore store;
  final bool autoStart;
  final DateTime Function() _clock;
  final Future<bool> Function() _isOnline;
  final Future<void> Function() _alert;

  RouteDeviationStatus status = RouteDeviationStatus.checking;
  RouteDeviationRecord record = const RouteDeviationRecord();
  RouteDeviationDetector? detector;
  bool syncing = false;
  String? error;

  /// The OFF_ROUTE event the user has not dismissed yet.
  LocalSafetyEvent? activeWarning;

  bool _started = false;
  Future<void>? _syncRun;
  bool _syncAgain = false;
  bool _forceAgain = false;
  bool _disposed = false;
  DateTime? _lastProcessedSampleAt;
  Timer? _tickTimer;
  Future<void> _queue = Future.value();

  RouteDeviationContext? get context => record.context;
  RouteNavigationState get navigation => detector?.navigation ?? record.navigation;
  GpsQualityState get quality => detector?.quality ?? record.quality;
  List<LocalSafetyEvent> get events => record.events;
  int get pendingCount => _count(SafetyEventSyncState.pending);
  int get syncedCount => _count(SafetyEventSyncState.synced);
  int get failedCount => _count(SafetyEventSyncState.failed);

  int _count(SafetyEventSyncState state) =>
      record.events.where((event) => event.syncState == state).length;

  void _changed() {
    if (!_disposed) notifyListeners();
  }

  /// Serializes detection steps so transitions are persisted in order.
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

  /// Loads the Route context from the server, falling back to the cached copy so
  /// detection keeps working offline (BR-238).
  Future<void> refreshContext() async {
    try {
      final fresh = await api.context(tripId);
      final changedRoute = record.context?.routeVersion != fresh.routeVersion;
      record = await store.update(
        tripId,
        (current) => changedRoute
            // A different geometry invalidates states detected against the old one.
            ? RouteDeviationRecord(context: fresh, events: current.events)
            : current.copyWith(context: fresh),
      );
      if (changedRoute) _stopDetection();
      error = null;
    } catch (_) {
      if (record.context == null) {
        status = RouteDeviationStatus.unavailable;
        error = 'Chưa tải được dữ liệu tuyến để phát hiện lệch tuyến.';
        _changed();
        return;
      }
    }
    _updateStatus();
  }

  void _updateStatus() {
    final current = record.context;
    if (current == null) {
      status = RouteDeviationStatus.unavailable;
    } else if (current.configVersion != supportedRouteDeviationConfigVersion ||
        current.coordinates.length < 2) {
      status = RouteDeviationStatus.unavailable;
      error = 'Dữ liệu tuyến không hỗ trợ phát hiện lệch tuyến trên thiết bị này.';
    } else if (!current.eligible) {
      status = RouteDeviationStatus.notEligible;
    } else {
      status = gps.isTracking ? RouteDeviationStatus.active : RouteDeviationStatus.paused;
    }
    _changed();
  }

  void _onGpsChanged() {
    if (!_started || _disposed) return;
    final current = record.context;
    final canDetect =
        current != null &&
        current.eligible &&
        current.configVersion == supportedRouteDeviationConfigVersion &&
        current.coordinates.length >= 2 &&
        gps.isTracking;
    if (!canDetect) {
      _stopDetection();
      _updateStatus();
      return;
    }
    if (detector == null) {
      // Counters always start from zero; only the confirmed states are restored.
      detector = RouteDeviationDetector(
        route: current.coordinates,
        startedAt: _clock(),
        navigation: record.navigation,
        quality: record.quality,
      );
      _tickTimer = Timer.periodic(routeDeviationTickInterval, (_) => unawaited(tick()));
      _updateStatus();
    }
    final sample = gps.lastSample;
    if (sample != null && sample.capturedAt != _lastProcessedSampleAt) {
      _lastProcessedSampleAt = sample.capturedAt;
      unawaited(processSample(sample));
    }
  }

  void _stopDetection() {
    _tickTimer?.cancel();
    _tickTimer = null;
    detector = null;
  }

  Future<void> processSample(GpsSample sample) => _enqueue(() async {
    final active = detector;
    if (active == null) return;
    await _persist(active.onSample(sample));
    _changed();
  });

  Future<void> tick() => _enqueue(() async {
    final active = detector;
    if (active == null) return;
    await _persist(active.onTick(_clock()));
  });

  Future<void> _persist(List<DetectedTransition> transitions) async {
    final active = detector;
    final current = record.context;
    if (transitions.isEmpty || active == null || current == null) return;
    final offline = !await _isOnline();
    final created = [
      for (final transition in transitions)
        LocalSafetyEvent(
          id: newGpsLogId(),
          tripId: tripId,
          type: transition.type,
          eventTime: transition.eventTime,
          latitude: transition.sample?.latitude,
          longitude: transition.sample?.longitude,
          accuracyMeters: transition.sample?.accuracyMeters,
          distanceToRouteMeters: transition.distanceToRouteMeters,
          consecutiveValidSamples: transition.consecutiveValidSamples,
          noValidSampleSince: transition.noValidSampleSince,
          detectedOffline: offline,
          routeVersion: current.routeVersion,
          configVersion: current.configVersion,
        ),
    ];
    // BR-386: the events and the confirmed state are written in one atomic step
    // before the warning is shown or anything is uploaded.
    record = await store.update(
      tripId,
      (stored) => stored.copyWith(
        navigation: active.navigation,
        quality: active.quality,
        events: [...stored.events, ...created],
      ),
    );
    final warning = created.where((event) => event.type == SafetyEventType.offRoute).lastOrNull;
    if (warning != null) {
      activeWarning = warning;
      unawaited(_alert());
    } else if (active.navigation == RouteNavigationState.onRoute) {
      activeWarning = null;
    }
    _changed();
    unawaited(syncNow());
  }

  void dismissWarning() {
    activeWarning = null;
    _changed();
  }

  /// Uploads due pending events; offline errors keep them pending for later. A
  /// request made while an upload is running runs again right after it, so an
  /// event confirmed during an upload is not left waiting for the next trigger.
  Future<void> syncNow({bool force = false}) {
    final running = _syncRun;
    if (running != null) {
      _syncAgain = true;
      _forceAgain = _forceAgain || force;
      return running;
    }
    return _syncRun = _runSync(force).whenComplete(() => _syncRun = null);
  }

  Future<void> _runSync(bool force) async {
    syncing = true;
    _changed();
    try {
      do {
        _syncAgain = false;
        await _syncOnce(force: force || _forceAgain);
        _forceAgain = false;
      } while (_syncAgain && !_disposed);
    } finally {
      syncing = false;
      _changed();
    }
  }

  Future<void> _syncOnce({required bool force}) async {
    try {
      if (force) {
        // "Đồng bộ ngay" skips the retry backoff of pending events.
        record = await store.update(
          tripId,
          (current) => current.copyWith(
            events: [
              for (final event in current.events)
                event.syncState == SafetyEventSyncState.pending
                    ? event.delivery(
                        syncState: SafetyEventSyncState.pending,
                        attempts: event.attempts,
                      )
                    : event,
            ],
          ),
        );
      }
      record = await synchronizeSafetyEvents(
        tripId: tripId,
        store: store,
        api: api,
        now: _clock(),
      );
    } catch (_) {
      // The buffer stays as it was; the next detection step or retry tries again.
    }
  }

  @override
  void dispose() {
    _disposed = true;
    gps.removeListener(_onGpsChanged);
    _stopDetection();
    super.dispose();
  }
}

final routeDeviationApiProvider = Provider<RouteDeviationApi>(
  (ref) => HttpRouteDeviationApi(ref.watch(apiClientProvider)),
);

/// One store instance per signed-in account, shared by detection and the device
/// sync screen so their writes are serialized.
final routeDeviationStoreProvider = Provider<RouteDeviationStore>((ref) {
  final user = ref.watch(authControllerProvider).valueOrNull;
  return FileRouteDeviationStore(user?.id ?? 'anonymous');
});

final routeDeviationControllerProvider = ChangeNotifierProvider.autoDispose
    .family<RouteDeviationController, String>((ref, tripId) {
      return RouteDeviationController(
        tripId: tripId,
        // `.notifier` reads the controller without rebuilding this one on every sample.
        gps: ref.watch(gpsTrackingControllerProvider(tripId).notifier),
        api: ref.watch(routeDeviationApiProvider),
        store: ref.watch(routeDeviationStoreProvider),
      );
    });
