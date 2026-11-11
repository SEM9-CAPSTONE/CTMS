enum DeviceSyncState {
  idle,
  pending,
  syncing,
  failed,
  synced,
}

class DeviceSyncSummary {
  const DeviceSyncSummary({
    required this.pendingGpsCount,
    required this.pendingSafetyCount,
    required this.serverConfirmedGpsCount,
    required this.serverConfirmedSafetyCount,
    required this.lastSyncAt,
    required this.lastError,
    required this.packageVersion,
    required this.configVersion,
    required this.state,
  });

  final int pendingGpsCount;
  final int pendingSafetyCount;
  final int serverConfirmedGpsCount;
  final int serverConfirmedSafetyCount;
  final DateTime? lastSyncAt;
  final String? lastError;
  final String? packageVersion;
  final String configVersion;
  final DeviceSyncState state;

  bool get hasFailedOrPending =>
      pendingGpsCount > 0 ||
      pendingSafetyCount > 0 ||
      state == DeviceSyncState.failed;

  DeviceSyncSummary copyWith({
    int? pendingGpsCount,
    int? pendingSafetyCount,
    int? serverConfirmedGpsCount,
    int? serverConfirmedSafetyCount,
    DateTime? lastSyncAt,
    String? lastError,
    String? packageVersion,
    String? configVersion,
    DeviceSyncState? state,
  }) {
    return DeviceSyncSummary(
      pendingGpsCount: pendingGpsCount ?? this.pendingGpsCount,
      pendingSafetyCount: pendingSafetyCount ?? this.pendingSafetyCount,
      serverConfirmedGpsCount:
          serverConfirmedGpsCount ?? this.serverConfirmedGpsCount,
      serverConfirmedSafetyCount:
          serverConfirmedSafetyCount ?? this.serverConfirmedSafetyCount,
      lastSyncAt: lastSyncAt ?? this.lastSyncAt,
      lastError: lastError ?? this.lastError,
      packageVersion: packageVersion ?? this.packageVersion,
      configVersion: configVersion ?? this.configVersion,
      state: state ?? this.state,
    );
  }
}
