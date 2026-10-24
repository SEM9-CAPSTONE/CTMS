import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../auth/application/auth_controller.dart';
import '../../incidents/application/incident_sync.dart';
import '../../incidents/data/incident_store.dart';
import '../../incidents/data/incidents_api.dart';
import '../../incidents/domain/trip_incident.dart';
import '../data/device_sync_api.dart';
import '../domain/device_sync_models.dart';

class DeviceSyncController extends ChangeNotifier {
  DeviceSyncController({
    required this.tripId,
    required this.api,
    required this.incidentStore,
    required this.incidentsApi,
  }) {
    unawaited(refresh());
  }

  final String tripId;
  final DeviceSyncApi api;
  final IncidentStore incidentStore;
  final IncidentsApi incidentsApi;

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
      if (failedSafety > 0 || (serverErr != null && pendingSafety > 0)) {
        state = DeviceSyncState.failed;
      } else if (pendingSafety > 0) {
        state = DeviceSyncState.pending;
      } else if (serverGps > 0 || serverSafety > 0) {
        state = DeviceSyncState.synced;
      }

      summary = DeviceSyncSummary(
        pendingGpsCount: 0,
        pendingSafetyCount: pendingSafety,
        serverConfirmedGpsCount: serverGps,
        serverConfirmedSafetyCount: serverSafety,
        lastSyncAt: lastReceivedAt,
        lastError: lastErr ?? serverErr,
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
  );
});
