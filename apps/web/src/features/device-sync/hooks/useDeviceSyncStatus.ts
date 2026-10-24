import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { queryKeys } from "../../../core/api";
import { getStoredAuthUser } from "../../auth/utils/tokenStorage";
import { tripIncidentsService } from "../../trip-incidents/services/trip-incidents.service";
import { createIndexedDbIncidentQueueStore } from "../../trip-incidents/storage/incident-queue.store";
import { syncIncidentRecord } from "../../trip-incidents/utils/incident-sync";
import { DEVICE_SYNC_CONFIG, SYNC_STATE_LABELS } from "../constants";
import { deviceSyncService } from "../services/device-sync.service";
import { type GpsQueueStore, createIndexedDbGpsQueueStore } from "../storage/gps-queue.store";
import { DeviceSyncState, type DeviceSyncSummary, type LocalGpsLogRecord } from "../types";

export interface UseDeviceSyncStatusOptions {
	gpsStore?: GpsQueueStore;
	autoRefresh?: boolean;
}

export function useDeviceSyncStatus(
	tripId: string,
	providedUserId?: string,
	options: UseDeviceSyncStatusOptions = {}
) {
	const queryClient = useQueryClient();
	const currentUserId = providedUserId || getStoredAuthUser()?.id || "";

	const [isRetrying, setIsRetrying] = useState(false);
	const [retryError, setRetryError] = useState<string | null>(null);
	const [localGps, setLocalGps] = useState<LocalGpsLogRecord[]>([]);
	const [localSafetyPending, setLocalSafetyPending] = useState(0);
	const [localSafetyFailed, setLocalSafetyFailed] = useState(0);
	const [localSafetyLastError, setLocalSafetyLastError] = useState<string | null>(null);

	const gpsStore =
		options.gpsStore ??
		(typeof indexedDB !== "undefined" ? createIndexedDbGpsQueueStore(indexedDB) : null);

	const incidentStore =
		typeof indexedDB !== "undefined" ? createIndexedDbIncidentQueueStore(indexedDB) : null;

	// Fetch authoritative server status (BR-226)
	const {
		data: serverStatus,
		isLoading: isServerLoading,
		error: serverError,
		refetch: refetchServer,
	} = useQuery({
		queryKey: queryKeys.deviceSync.status(tripId),
		queryFn: () => deviceSyncService.getServerStatus(tripId),
		enabled: Boolean(tripId && currentUserId),
		refetchInterval: options.autoRefresh !== false ? DEVICE_SYNC_CONFIG.REFRESH_INTERVAL_MS : false,
	});

	// Load local pending items from device storage
	const loadLocalState = useCallback(async () => {
		if (!tripId || !currentUserId) return;

		if (gpsStore) {
			try {
				const logs = await gpsStore.list(tripId, currentUserId);
				setLocalGps(logs);
			} catch (err) {
				console.error("Failed to read local GPS queue:", err);
			}
		}

		if (incidentStore) {
			try {
				const incidents = await incidentStore.list(tripId, currentUserId);
				const pending = incidents.filter(
					(i) => i.syncState === "pending" || i.mediaState === "pending"
				).length;
				const failed = incidents.filter(
					(i) => i.syncState === "failed" || i.mediaState === "failed"
				).length;
				const lastErr = incidents.find((i) => i.lastError)?.lastError ?? null;
				setLocalSafetyPending(pending);
				setLocalSafetyFailed(failed);
				setLocalSafetyLastError(lastErr);
			} catch (err) {
				console.error("Failed to read local incident queue:", err);
			}
		}
	}, [tripId, currentUserId, gpsStore, incidentStore]);

	useEffect(() => {
		void loadLocalState();
	}, [loadLocalState]);

	// Derive pending vs server-confirmed metrics (PB AC-1, PB AC-2, PB AC-6)
	const pendingGps = localGps.filter((g) => g.syncState === DeviceSyncState.PENDING);
	const failedGps = localGps.filter((g) => g.syncState === DeviceSyncState.FAILED);
	const gpsLastError = failedGps.find((g) => g.lastError)?.lastError ?? null;

	const pendingGpsCount = pendingGps.length;
	const failedGpsCount = failedGps.length;
	const pendingSafetyCount = localSafetyPending;
	const failedSafetyCount = localSafetyFailed;

	const serverConfirmedGpsCount = serverStatus?.serverConfirmedGpsCount ?? 0;
	const serverConfirmedSafetyCount = serverStatus?.serverConfirmedSafetyCount ?? 0;
	const lastSyncAt = serverStatus?.lastReceivedAt ?? null;
	const packageVersion = serverStatus?.packageVersion ?? null;
	const configVersion = serverStatus?.configVersion ?? DEVICE_SYNC_CONFIG.CONFIG_VERSION;

	const combinedError =
		retryError ??
		(serverError ? (serverError as Error).message : null) ??
		gpsLastError ??
		localSafetyLastError;

	// Derive aggregate sync state
	let syncState: DeviceSyncSummary["syncState"] = DeviceSyncState.IDLE;
	if (isRetrying) {
		syncState = DeviceSyncState.SYNCING;
	} else if (failedGpsCount > 0 || failedSafetyCount > 0) {
		syncState =
			pendingGpsCount > 0 || pendingSafetyCount > 0
				? DeviceSyncState.PARTIAL_FAILURE
				: DeviceSyncState.FAILED;
	} else if (pendingGpsCount > 0 || pendingSafetyCount > 0) {
		syncState = DeviceSyncState.PENDING;
	} else if (serverConfirmedGpsCount > 0 || serverConfirmedSafetyCount > 0) {
		syncState = DeviceSyncState.SYNCED;
	}

	// Trigger synchronization retry (PB AC-5)
	const retry = useCallback(async () => {
		if (isRetrying) return;
		setIsRetrying(true);
		setRetryError(null);

		try {
			// 1. Retry pending/failed GPS logs
			if (gpsStore && (pendingGpsCount > 0 || failedGpsCount > 0)) {
				const logsToSend = [...pendingGps, ...failedGps];
				const payload = logsToSend.map((l) => ({
					id: l.id,
					eventTime: l.eventTime,
					latitude: l.latitude,
					longitude: l.longitude,
					accuracyMeters: l.accuracyMeters,
					altitudeMeters: l.altitudeMeters,
					batteryLevel: l.batteryLevel,
					packageVersion: l.packageVersion,
					configVersion: l.configVersion,
				}));

				const response = await deviceSyncService.uploadGpsLogs(tripId, payload);
				for (const result of response.results) {
					if (result.status === "accepted" || result.status === "duplicate") {
						await gpsStore.remove(result.id);
					} else {
						const log = logsToSend.find((l) => l.id === result.id);
						if (log) {
							await gpsStore.put({
								...log,
								syncState: DeviceSyncState.FAILED,
								lastError: result.reason ?? "Bị từ chối đồng bộ",
							});
						}
					}
				}
			}

			// 2. Retry pending/failed incidents
			if (incidentStore && (pendingSafetyCount > 0 || failedSafetyCount > 0)) {
				const incidents = await incidentStore.list(tripId, currentUserId);
				const toSync = incidents.filter(
					(i) =>
						i.syncState === "pending" ||
						i.syncState === "failed" ||
						i.mediaState === "pending" ||
						i.mediaState === "failed"
				);

				for (const item of toSync) {
					const updated = await syncIncidentRecord(item, tripIncidentsService, Date.now());
					if (updated.syncState === "synced" && updated.mediaState !== "pending") {
						await incidentStore.remove(updated.id);
					} else {
						await incidentStore.put(updated);
					}
				}
			}

			// 3. Refresh local and server states
			await Promise.all([loadLocalState(), refetchServer()]);
			await queryClient.invalidateQueries({
				queryKey: queryKeys.deviceSync.status(tripId),
			});
		} catch (err) {
			setRetryError((err as Error).message ?? "Không thể kết nối máy chủ để đồng bộ.");
		} finally {
			setIsRetrying(false);
		}
	}, [
		isRetrying,
		gpsStore,
		pendingGpsCount,
		failedGpsCount,
		pendingGps,
		failedGps,
		tripId,
		currentUserId,
		incidentStore,
		pendingSafetyCount,
		failedSafetyCount,
		loadLocalState,
		refetchServer,
		queryClient,
	]);

	const summary: DeviceSyncSummary = {
		pendingGpsCount,
		failedGpsCount,
		pendingSafetyCount,
		failedSafetyCount,
		serverConfirmedGpsCount,
		serverConfirmedSafetyCount,
		lastSyncAt,
		lastError: combinedError,
		syncState,
		packageVersion,
		configVersion,
		membersSyncHealth: serverStatus?.membersSyncHealth,
	};

	return {
		summary,
		stateLabel: SYNC_STATE_LABELS[syncState] ?? syncState,
		isServerLoading,
		isRetrying,
		retry,
		reload: loadLocalState,
	};
}
