import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { queryKeys } from "../../../core/api";
import { getStoredAuthUser } from "../../auth/utils/tokenStorage";
import { tripsService } from "../services/trips.service";
import {
	type CheckpointArrivalQueueStore,
	createIndexedDbCheckpointArrivalQueueStore,
} from "../storage/checkpoint-arrival-queue.store";
import type {
	ConfirmCheckpointArrivalPayload,
	LocalCheckpointArrivalRecord,
	TripOperationalProgress,
} from "../types";

export interface UseConfirmCheckpointArrivalOptions {
	queueStore?: CheckpointArrivalQueueStore | null;
}

export function useConfirmCheckpointArrival(
	tripId: string,
	options: UseConfirmCheckpointArrivalOptions = {}
) {
	const queryClient = useQueryClient();
	const user = getStoredAuthUser();
	const porterId = user?.id || "";

	const [pendingQueue, setPendingQueue] = useState<LocalCheckpointArrivalRecord[]>([]);
	const [isSyncing, setIsSyncing] = useState(false);
	const [syncError, setSyncError] = useState<string | null>(null);

	const queueStore =
		options.queueStore !== undefined
			? options.queueStore
			: typeof indexedDB !== "undefined"
				? createIndexedDbCheckpointArrivalQueueStore(indexedDB)
				: null;

	const loadQueue = useCallback(async () => {
		if (!tripId || !porterId || !queueStore) return;
		try {
			const items = await queueStore.list(tripId, porterId);
			setPendingQueue(items);
		} catch (err) {
			console.warn("Failed to load offline checkpoint arrival queue", err);
		}
	}, [tripId, porterId, queueStore]);

	useEffect(() => {
		loadQueue();
	}, [loadQueue]);

	const {
		data: progress,
		isLoading: isProgressLoading,
		error: progressError,
		refetch: refetchProgress,
	} = useQuery({
		queryKey: queryKeys.trips.progress(tripId),
		queryFn: () => tripsService.getProgress(tripId),
		enabled: Boolean(tripId),
	});

	const confirmMutation = useMutation({
		mutationFn: async ({
			checkpointId,
			checkpointName,
			payload,
		}: {
			checkpointId: string;
			checkpointName?: string;
			payload?: ConfirmCheckpointArrivalPayload;
		}): Promise<{ success: boolean; offline: boolean; progress?: TripOperationalProgress }> => {
			const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
			const clientEventTime = payload?.arrivedAt ?? new Date().toISOString();
			const syncId =
				payload?.syncId ??
				(typeof crypto !== "undefined" && crypto.randomUUID
					? crypto.randomUUID()
					: `offline-${Date.now()}`);

			let location = payload?.location ?? null;
			if (!location && typeof navigator !== "undefined" && navigator.geolocation) {
				try {
					const position = await new Promise<GeolocationPosition>((resolve, reject) => {
						navigator.geolocation.getCurrentPosition(resolve, reject, {
							enableHighAccuracy: true,
							timeout: 3000,
							maximumAge: 10000,
						});
					});
					location = {
						type: "Point",
						coordinates: [position.coords.longitude, position.coords.latitude],
					};
				} catch {
					// GPS unavailable - do not fabricate coordinates (BR-234)
					location = null;
				}
			}

			const arrivalPayload: ConfirmCheckpointArrivalPayload = {
				arrivedAt: clientEventTime,
				location,
				memberIds: payload?.memberIds,
				capturedOffline: !isOnline,
				syncId,
			};

			if (!isOnline) {
				if (queueStore) {
					const record: LocalCheckpointArrivalRecord = {
						id: syncId,
						tripId,
						checkpointId,
						checkpointName: checkpointName || "Checkpoint",
						porterId,
						arrivedAt: clientEventTime,
						location,
						memberIds: payload?.memberIds,
						syncStatus: "pending",
						createdAt: new Date().toISOString(),
					};
					await queueStore.put(record);
					await loadQueue();
				}
				return { success: true, offline: true };
			}

			try {
				const updatedProgress = await tripsService.confirmCheckpointArrival(
					tripId,
					checkpointId,
					arrivalPayload
				);
				queryClient.setQueryData(queryKeys.trips.progress(tripId), updatedProgress);
				queryClient.invalidateQueries({
					queryKey: queryKeys.trips.assignedOperations(porterId, tripId),
				});
				return { success: true, offline: false, progress: updatedProgress };
			} catch (error) {
				// Network or server error - save to offline queue as fallback
				if (queueStore) {
					const record: LocalCheckpointArrivalRecord = {
						id: syncId,
						tripId,
						checkpointId,
						checkpointName: checkpointName || "Checkpoint",
						porterId,
						arrivedAt: clientEventTime,
						location,
						memberIds: payload?.memberIds,
						syncStatus: "failed",
						lastError: error instanceof Error ? error.message : "Gửi điểm danh thất bại",
						createdAt: new Date().toISOString(),
					};
					await queueStore.put(record);
					await loadQueue();
					return { success: true, offline: true };
				}
				throw error;
			}
		},
	});

	const syncOfflineArrivals = useCallback(async () => {
		if (!queueStore || !tripId || pendingQueue.length === 0 || isSyncing) return;
		setIsSyncing(true);
		setSyncError(null);

		try {
			const arrivals = pendingQueue.map((item) => ({
				checkpointId: item.checkpointId,
				arrivedAt: item.arrivedAt,
				location: item.location,
				memberIds: item.memberIds,
				capturedOffline: true,
				syncId: item.id,
			}));

			const updatedProgress = await tripsService.syncCheckpointArrivals(tripId, { arrivals });
			queryClient.setQueryData(queryKeys.trips.progress(tripId), updatedProgress);
			queryClient.invalidateQueries({
				queryKey: queryKeys.trips.assignedOperations(porterId, tripId),
			});

			await queueStore.clearForTrip(tripId);
			await loadQueue();
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Đồng bộ điểm danh ngoại tuyến thất bại.";
			setSyncError(message);
		} finally {
			setIsSyncing(false);
		}
	}, [queueStore, tripId, pendingQueue, isSyncing, porterId, queryClient, loadQueue]);

	return {
		progress,
		isProgressLoading,
		progressError,
		refetchProgress,
		confirmArrival: confirmMutation.mutateAsync,
		isConfirming: confirmMutation.isPending,
		confirmError: confirmMutation.error,
		pendingOfflineCount: pendingQueue.length,
		pendingQueue,
		syncOfflineArrivals,
		isSyncing,
		syncError,
	};
}
