import 'dart:async';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../auth/application/auth_controller.dart';
import '../../camper/profile/data/camper_health_profile_repository.dart';
import '../../gps_tracking/application/gps_log_sync.dart';
import '../../gps_tracking/application/gps_tracking_controller.dart';
import '../../gps_tracking/data/gps_log_store.dart';
import '../../gps_tracking/data/gps_tracking_api.dart';
import '../../gps_tracking/domain/gps_tracking_models.dart';
import '../../incidents/application/incident_sync.dart';
import '../../incidents/data/incident_store.dart';
import '../../incidents/data/incidents_api.dart';
import '../../incidents/domain/trip_incident.dart';
import '../../route_deviation/application/route_deviation_controller.dart';
import '../../route_deviation/application/safety_event_sync.dart';
import '../../route_deviation/data/route_deviation_api.dart';
import '../../route_deviation/data/route_deviation_store.dart';
import '../../route_deviation/domain/route_deviation_models.dart';
import '../data/offline_medical_store.dart';
import 'connectivity_source.dart';

/// Maximum backoff wait in seconds (5 minutes) - BR-245.
const maxBackoffSeconds = 300;
const baseBackoffSeconds = 5;
const maxConsecutiveRetries = 8;

class ReconnectionSyncCoordinator extends ChangeNotifier {
  ReconnectionSyncCoordinator({
    required this.connectivitySource,
    required this.incidentStore,
    required this.incidentsApi,
    this.gpsStore,
    this.gpsApi,
    this.safetyEventStore,
    this.safetyEventApi,
    this.medicalStore,
    this.healthProfileRepository,
    DateTime Function()? clock,
    bool autoStart = true,
  }) : _clock = clock ?? DateTime.now {
    _connectivitySub = connectivitySource.onConnectivityChanged.listen(_handleConnectivityChange);
    if (autoStart) {
      _init();
    }
  }

  final ConnectivitySource connectivitySource;
  final IncidentStore incidentStore;
  final IncidentsApi incidentsApi;
  final GpsLogStore? gpsStore;
  final GpsTrackingApi? gpsApi;
  final RouteDeviationStore? safetyEventStore;
  final RouteDeviationApi? safetyEventApi;
  final OfflineMedicalStore? medicalStore;
  final CamperHealthProfileRepository? healthProfileRepository;
  final DateTime Function() _clock;

  bool _isOnline = false;
  bool _isSyncing = false;
  bool _disposed = false;
  int _consecutiveFailures = 0;
  DateTime? _lastSyncAt;
  String? _lastError;
  Timer? _retryTimer;
  StreamSubscription<bool>? _connectivitySub;

  bool get isOnline => _isOnline;
  bool get isSyncing => _isSyncing;
  int get consecutiveFailures => _consecutiveFailures;
  DateTime? get lastSyncAt => _lastSyncAt;
  String? get lastError => _lastError;
  bool get hasActiveRetryTimer => _retryTimer != null && _retryTimer!.isActive;

  void _changed() {
    if (!_disposed) notifyListeners();
  }

  void _init() {
    unawaited(() async {
      _isOnline = await connectivitySource.isConnected();
      _changed();
      if (_isOnline) {
        unawaited(synchronizeAll());
      }
    }());
  }

  /// Triggered whenever connectivity changes.
  /// When connectivity returns (offline -> online), starts automatic synchronization (PB AC-1, BR-243).
  void _handleConnectivityChange(bool online) {
    final wasOffline = !_isOnline;
    _isOnline = online;
    _changed();

    if (online && wasOffline) {
      // Reconnection detected: cancel any pending backoff timer and sync immediately
      _cancelRetryTimer();
      _consecutiveFailures = 0;
      unawaited(synchronizeAll());
    }
  }

  /// Calculates bounded exponential backoff duration (PB AC-5, BR-245).
  Duration calculateBackoff(int attempts) {
    final exp = min(attempts, 6);
    final seconds = min(maxBackoffSeconds, baseBackoffSeconds * pow(2, exp).toInt());
    return Duration(seconds: seconds);
  }

  void _cancelRetryTimer() {
    _retryTimer?.cancel();
    _retryTimer = null;
  }

  void _scheduleRetry() {
    if (_disposed || !_isOnline) return;
    if (_consecutiveFailures >= maxConsecutiveRetries) {
      _lastError = 'Đã vượt quá số lần thử lại tối đa. Vui lòng thử lại thủ công.';
      _changed();
      return;
    }

    _cancelRetryTimer();
    final delay = calculateBackoff(_consecutiveFailures);
    _retryTimer = Timer(delay, () {
      if (!_disposed && _isOnline) {
        unawaited(synchronizeAll());
      }
    });
  }

  /// Enforces BR-230 / PB AC-8: Sensitive medical data invalidated by revoked consent
  /// must be purged/locked immediately so it is never reauthorized through offline sync.
  Future<void> _enforceConsentPolicy() async {
    if (medicalStore == null) return;
    try {
      if (healthProfileRepository != null) {
        final profile = await healthProfileRepository!.getProfile();
        if (!profile.consent.isConsentGranted) {
          await medicalStore!.setConsentActive(false);
          await medicalStore!.purgeMedicalData();
          return;
        }
      }
      final isActive = await medicalStore!.isConsentActive();
      if (!isActive) {
        await medicalStore!.purgeMedicalData();
      }
    } catch (_) {
      // Do not block operational sync on consent check network failure
    }
  }

  /// Synchronizes all pending data across all active trips (GPS logs, safety events, incidents).
  /// Runs asynchronously in background without blocking normal UI interaction (PB AC-6).
  Future<void> synchronizeAll({bool force = false}) async {
    if (_isSyncing || _disposed) return;
    _isSyncing = true;
    _changed();

    bool hasErrors = false;
    String? latestError;

    try {
      if (!_isOnline) {
        _isOnline = await connectivitySource.isConnected();
      }

      // 1. Consent check & purge (BR-230)
      await _enforceConsentPolicy();

      // 2. Synchronize incidents
      final incidents = await incidentStore.read();
      for (final incident in incidents) {
        if (!force &&
            incident.syncState == IncidentSyncState.synced &&
            incident.mediaState == IncidentMediaState.none) {
          continue;
        }

        try {
          final updated = await synchronizeIncident(
            incident,
            incidentsApi,
            _clock(),
          );
          await incidentStore.put(updated);
          if (updated.error != null ||
              updated.syncState == IncidentSyncState.failed ||
              updated.mediaState == IncidentMediaState.failed) {
            hasErrors = true;
            latestError = updated.error;
          }
        } catch (e) {
          hasErrors = true;
          latestError = e.toString();
        }
      }

      // Collect unique trip IDs from incidents
      final tripIds = incidents.map((i) => i.tripId).toSet();

      // 3. Synchronize GPS logs and Route Deviation events per trip
      for (final tripId in tripIds) {
        if (gpsStore != null && gpsApi != null) {
          try {
            if (force) {
              await gpsStore!.update(
                tripId,
                (current) => [
                  for (final log in current)
                    log.syncState == GpsLogSyncState.pending
                        ? log.delivery(syncState: GpsLogSyncState.pending, attempts: log.attempts)
                        : log,
                ],
              );
            }
            final updatedLogs = await synchronizeGpsLogs(
              tripId: tripId,
              store: gpsStore!,
              api: gpsApi!,
              now: _clock(),
            );
            if (updatedLogs.any((l) => l.error != null || l.syncState == GpsLogSyncState.failed)) {
              hasErrors = true;
              final failed = updatedLogs.firstWhere((l) => l.error != null || l.syncState == GpsLogSyncState.failed);
              latestError = failed.error ?? failed.rejectionReason;
            }
          } catch (e) {
            hasErrors = true;
            latestError = e.toString();
          }
        }

        if (safetyEventStore != null && safetyEventApi != null) {
          try {
            final updatedRecord = await synchronizeSafetyEvents(
              tripId: tripId,
              store: safetyEventStore!,
              api: safetyEventApi!,
              now: _clock(),
            );
            if (updatedRecord.events.any((e) => e.error != null || e.syncState == SafetyEventSyncState.failed)) {
              hasErrors = true;
              final failed = updatedRecord.events.firstWhere((e) => e.error != null || e.syncState == SafetyEventSyncState.failed);
              latestError = failed.error ?? failed.rejectionReason;
            }
          } catch (e) {
            hasErrors = true;
            latestError = e.toString();
          }
        }
      }

      if (hasErrors) {
        _consecutiveFailures++;
        _lastError = latestError ?? 'Không thể hoàn tất đồng bộ.';
        _scheduleRetry();
      } else {
        _consecutiveFailures = 0;
        _lastSyncAt = _clock();
        _lastError = null;
        _cancelRetryTimer();
      }
    } catch (e) {
      _consecutiveFailures++;
      _lastError = e.toString();
      _scheduleRetry();
    } finally {
      _isSyncing = false;
      _changed();
    }
  }

  /// Synchronize a specific trip's data.
  Future<void> synchronizeTrip(String tripId, {bool force = false}) async {
    if (_isSyncing || _disposed) return;
    _isSyncing = true;
    _changed();

    try {
      if (!_isOnline) {
        _isOnline = await connectivitySource.isConnected();
      }

      await _enforceConsentPolicy();

      // Incidents for this trip
      final allIncidents = await incidentStore.read();
      final tripIncidents = allIncidents.where((i) => i.tripId == tripId).toList();
      for (final incident in tripIncidents) {
        if (!force &&
            incident.syncState == IncidentSyncState.synced &&
            incident.mediaState == IncidentMediaState.none) {
          continue;
        }
        final updated = await synchronizeIncident(
          incident,
          incidentsApi,
          _clock(),
        );
        await incidentStore.put(updated);
      }

      if (gpsStore != null && gpsApi != null) {
        if (force) {
          await gpsStore!.update(
            tripId,
            (current) => [
              for (final log in current)
                log.syncState == GpsLogSyncState.pending
                    ? log.delivery(syncState: GpsLogSyncState.pending, attempts: log.attempts)
                    : log,
            ],
          );
        }
        await synchronizeGpsLogs(
          tripId: tripId,
          store: gpsStore!,
          api: gpsApi!,
          now: _clock(),
        );
      }

      if (safetyEventStore != null && safetyEventApi != null) {
        await synchronizeSafetyEvents(
          tripId: tripId,
          store: safetyEventStore!,
          api: safetyEventApi!,
          now: _clock(),
        );
      }

      _lastSyncAt = _clock();
      _lastError = null;
    } catch (e) {
      _lastError = e.toString();
    } finally {
      _isSyncing = false;
      _changed();
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _cancelRetryTimer();
    _connectivitySub?.cancel();
    super.dispose();
  }
}

final reconnectionSyncCoordinatorProvider = Provider<ReconnectionSyncCoordinator>((ref) {
  final user = ref.watch(authControllerProvider).valueOrNull;
  final userId = user?.id ?? 'anonymous';
  final connectivitySource = ref.watch(connectivitySourceProvider);
  final store = IncidentStore.create(userId);
  final incidentsApi = HttpIncidentsApi(ref.watch(apiClientProvider));
  final gpsStore = ref.watch(gpsLogStoreProvider);
  final gpsApi = ref.watch(gpsTrackingApiProvider);
  final safetyEventStore = ref.watch(routeDeviationStoreProvider);
  final safetyEventApi = ref.watch(routeDeviationApiProvider);
  final medicalStore = ref.watch(offlineMedicalStoreProvider);
  final healthRepo = ref.watch(camperHealthProfileRepositoryProvider);

  final coordinator = ReconnectionSyncCoordinator(
    connectivitySource: connectivitySource,
    incidentStore: store,
    incidentsApi: incidentsApi,
    gpsStore: gpsStore,
    gpsApi: gpsApi,
    safetyEventStore: safetyEventStore,
    safetyEventApi: safetyEventApi,
    medicalStore: medicalStore,
    healthProfileRepository: healthRepo,
  );

  ref.onDispose(coordinator.dispose);
  return coordinator;
});
