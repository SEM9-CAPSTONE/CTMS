import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../auth/application/auth_controller.dart';
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
import '../data/device_sync_api.dart';
import '../domain/device_sync_models.dart';

class DeviceSyncController extends ChangeNotifier {
  DeviceSyncController({
    required this.tripId,
    required this.api,
    required this.incidentStore,
    required this.incidentsApi,
    this.gpsStore,
    this.gpsApi,
    this.safetyEventStore,
    this.safetyEventApi,
  }) {
    unawaited(refresh());
  }

  final String tripId;
  final DeviceSyncApi api;
  final IncidentStore incidentStore;
  final IncidentsApi incidentsApi;

  /// Local GPS breadcrumb buffer (CTMS-059); null keeps GPS counts at zero.
  final GpsLogStore? gpsStore;
  final GpsTrackingApi? gpsApi;

  /// Local route-deviation safety events (CTMS-060); null keeps them out of the counts.
  final RouteDeviationStore? safetyEventStore;
  final RouteDeviationApi? safetyEventApi;

  DeviceSyncSummary summary = const DeviceSyncSummary(
    pendingGpsCount: 0,
    pendingSafetyCount: 0,
    serverConfirmedGpsCount: 0,
    serverConfirmedSafetyCount: 0,
    lastSyncAt: null,
    lastError: null,
    packageVersion: null,
    configVersion: 'v3',
    state: DeviceSyncState.idle,
  );

  bool loading = false;
  bool retrying = false;
  bool _disposed = false;
  Future<void>? _refreshOperation;

  void _changed() {
    if (!_disposed) notifyListeners();
  }

  Future<void> refresh() {
    return _refreshOperation ??= _doRefresh().whenComplete(() {
      _refreshOperation = null;
    });
  }

  Future<void> _doRefresh() async {
    loading = true;
    _changed();

    try {
      // 1. Read local safety incidents from device storage
      final localIncidents = await incidentStore.read();
      final tripIncidents =
          localIncidents.where((i) => i.tripId == tripId).toList();
      final pendingSafety = tripIncidents
          .where(
            (i) =>
                i.syncState == IncidentSyncState.pending ||
                i.mediaState == IncidentMediaState.pending,
          )
          .length;
      final failedSafety = tripIncidents
          .where(
            (i) =>
                i.syncState == IncidentSyncState.failed ||
                i.mediaState == IncidentMediaState.failed,
          )
          .length;
      final lastErr = tripIncidents
          .where((i) => i.error != null)
          .map((i) => i.error)
          .firstOrNull;

      // 1b. Read local GPS breadcrumbs (CTMS-059 buffer)
      final gpsLogs = gpsStore == null ? const <LocalGpsLog>[] : await gpsStore!.read(tripId);
      final pendingGps = gpsLogs.where((log) => log.syncState == GpsLogSyncState.pending).length;
      final failedGps = gpsLogs.where((log) => log.syncState == GpsLogSyncState.failed).length;
      final gpsErr = gpsLogs.where((log) => log.error != null).map((log) => log.error).firstOrNull;

      // 1c. Read local route-deviation safety events (CTMS-060)
      final safetyEvents = safetyEventStore == null
          ? const <LocalSafetyEvent>[]
          : (await safetyEventStore!.read(tripId)).events;
      final pendingEvents =
          safetyEvents.where((event) => event.syncState == SafetyEventSyncState.pending).length;
      final failedEvents =
          safetyEvents.where((event) => event.syncState == SafetyEventSyncState.failed).length;
      final eventErr =
          safetyEvents.where((event) => event.error != null).map((event) => event.error).firstOrNull;

      // 2. Read server-confirmed telemetry
      Map<String, Object?>? serverData;
      String? serverErr;
      try {
        serverData = await api.getStatus(tripId);
      } catch (err) {
        serverErr = err.toString();
      }

      final serverGps =
          (serverData?['serverConfirmedGpsCount'] as num?)?.toInt() ?? 0;
      final serverSafety =
          (serverData?['serverConfirmedSafetyCount'] as num?)?.toInt() ?? 0;
      final lastReceivedStr = serverData?['lastReceivedAt'] as String?;
      final lastReceivedAt = lastReceivedStr != null
          ? DateTime.tryParse(lastReceivedStr)
          : null;
      final pkgVersion = serverData?['packageVersion'] as String?;
      final cfgVersion =
          (serverData?['configVersion'] as String?) ?? 'v3';

      DeviceSyncState state = DeviceSyncState.idle;
      final pendingTotal = pendingSafety + pendingEvents + pendingGps;
      if (failedSafety > 0 ||
          failedEvents > 0 ||
          failedGps > 0 ||
          (serverErr != null && pendingTotal > 0)) {
        state = DeviceSyncState.failed;
      } else if (pendingTotal > 0) {
        state = DeviceSyncState.pending;
      } else if (serverGps > 0 || serverSafety > 0) {
        state = DeviceSyncState.synced;
      }

      summary = DeviceSyncSummary(
        pendingGpsCount: pendingGps,
        pendingSafetyCount: pendingSafety + pendingEvents,
        serverConfirmedGpsCount: serverGps,
        serverConfirmedSafetyCount: serverSafety,
        lastSyncAt: lastReceivedAt,
        lastError: lastErr ?? eventErr ?? gpsErr ?? serverErr,
        packageVersion: pkgVersion,
        configVersion: cfgVersion,
        state: state,
      );
    } finally {
      loading = false;
      _changed();
    }
  }

  Future<void> retry() async {
    if (retrying) return;
    retrying = true;
    summary = summary.copyWith(state: DeviceSyncState.syncing);
    _changed();

    try {
      final records = await incidentStore.read();
      final toSync = records.where((i) => i.tripId == tripId).toList();

      for (final record in toSync) {
        if (record.syncState == IncidentSyncState.synced &&
            record.mediaState == IncidentMediaState.none) {
          continue;
        }
        final updated = await synchronizeIncident(
          record,
          incidentsApi,
          DateTime.now(),
        );
        await incidentStore.put(updated);
      }

      if (gpsStore != null && gpsApi != null) {
        await synchronizeGpsLogs(
          tripId: tripId,
          store: gpsStore!,
          api: gpsApi!,
          now: DateTime.now(),
        );
      }

      if (safetyEventStore != null && safetyEventApi != null) {
        await synchronizeSafetyEvents(
          tripId: tripId,
          store: safetyEventStore!,
          api: safetyEventApi!,
          now: DateTime.now(),
        );
      }

      await refresh();
    } catch (e) {
      summary = summary.copyWith(
        state: DeviceSyncState.failed,
        lastError: e.toString(),
      );
    } finally {
      retrying = false;
      _changed();
    }
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}

final deviceSyncApiProvider = Provider<DeviceSyncApi>((ref) {
  return HttpDeviceSyncApi(ref.watch(apiClientProvider));
});

final deviceSyncControllerProvider = ChangeNotifierProvider.autoDispose
    .family<DeviceSyncController, String>((ref, tripId) {
  final user = ref.watch(authControllerProvider).valueOrNull;
  final userId = user?.id ?? 'anonymous';
  final store = FileIncidentStore(userId);
  final api = ref.watch(deviceSyncApiProvider);
  final incidentsApi = HttpIncidentsApi(ref.watch(apiClientProvider));

  return DeviceSyncController(
    tripId: tripId,
    api: api,
    incidentStore: store,
    incidentsApi: incidentsApi,
    gpsStore: ref.watch(gpsLogStoreProvider),
    gpsApi: ref.watch(gpsTrackingApiProvider),
    safetyEventStore: ref.watch(routeDeviationStoreProvider),
    safetyEventApi: ref.watch(routeDeviationApiProvider),
  );
});
