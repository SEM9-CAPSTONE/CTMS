import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { queryKeys } from "../../../core/api";
import { getStoredAuthUser } from "../../auth/utils/tokenStorage";
import { INCIDENT_LIST_STALE_TIME_MS, INCIDENT_SYNC_INTERVAL_MS } from "../constants";
import { type TripIncidentsApi, tripIncidentsService } from "../services/trip-incidents.service";
import {
	type IncidentQueueStore,
	getDefaultIncidentQueueStore,
} from "../storage/incident-queue.store";
import {
	type IncidentListItem,
	IncidentMediaState,
	IncidentSyncState,
	type LocalIncidentRecord,
} from "../types";
import { registerVisibleIncidentTrip } from "../utils/incident-background-sync";
import { type NewIncidentInput, createIncidentRecord } from "../utils/incident-record";
import {
	classifySyncError,
	isSettled,
	mergeIncidentLists,
	needsSync,
	syncIncidentRecord,
} from "../utils/incident-sync";
import { useOnlineStatus } from "./useOnlineStatus";

export interface UseTripIncidentsOptions {
	store?: IncidentQueueStore;
	api?: TripIncidentsApi;
}

type RecordsUpdate = (records: LocalIncidentRecord[]) => LocalIncidentRecord[];

const upsert =
	(record: LocalIncidentRecord): RecordsUpdate =>
	(records) =>
		records.some((item) => item.id === record.id)
			? records.map((item) => (item.id === record.id ? record : item))
			: [...records, record];

const hasUnsentWork = (record: LocalIncidentRecord) =>
	record.syncState === IncidentSyncState.PENDING ||
	record.syncState === IncidentSyncState.SYNCING ||
	record.mediaState === IncidentMediaState.PENDING;

/**
 * Porter incident reporting for one Trip: every new incident is saved on the device
 * first, then synchronized whenever the browser is online (AC3, AC4). The list merges
 * server-confirmed incidents with device records that still carry unsent work (AC5).
 */
export function useTripIncidents(tripId: string, options: UseTripIncidentsOptions = {}) {
	const store = options.store ?? getDefaultIncidentQueueStore();
	const api = options.api ?? tripIncidentsService;
	const porterId = getStoredAuthUser()?.id ?? null;
	const isOnline = useOnlineStatus();
	const queryClient = useQueryClient();
	const listKey = useMemo(
		() => queryKeys.trips.incidents(porterId ?? "anonymous", tripId),
		[porterId, tripId]
	);

	const [records, setRecords] = useState<LocalIncidentRecord[]>([]);
	const [isQueueLoaded, setIsQueueLoaded] = useState(false);
	const [queueError, setQueueError] = useState<string | null>(null);
	const recordsRef = useRef<LocalIncidentRecord[]>([]);
	const isSyncingRef = useRef(false);
	const scope = `${porterId}:${tripId}`;
	const scopeRef = useRef(scope);
	scopeRef.current = scope;

	const commit = useCallback((update: RecordsUpdate) => {
		recordsRef.current = update(recordsRef.current);
		setRecords(recordsRef.current);
	}, []);
	useEffect(
		() => (porterId ? registerVisibleIncidentTrip(porterId, tripId) : undefined),
		[porterId, tripId]
	);

	const serverQuery = useQuery({
		queryKey: listKey,
		queryFn: () => api.list(tripId),
		enabled: !!porterId && isOnline,
		retry: false,
		staleTime: INCIDENT_LIST_STALE_TIME_MS,
	});

	useEffect(() => {
		commit(() => []);
		setIsQueueLoaded(false);
		setQueueError(null);
		if (!porterId) return;
		let isActive = true;
		store
			.list(tripId, porterId)
			.then((stored) => {
				if (isActive) commit(() => stored);
			})
			.catch(() => {
				if (isActive) setQueueError("Không thể đọc bộ nhớ sự cố trên thiết bị.");
			})
			.finally(() => {
				if (isActive) setIsQueueLoaded(true);
			});
		return () => {
			isActive = false;
		};
	}, [store, tripId, porterId, commit]);

	const syncNow = useCallback(async () => {
		if (isSyncingRef.current) return;
		isSyncingRef.current = true;
		try {
			const due = recordsRef.current.filter(
				(record) =>
					record.tripId === tripId && record.porterId === porterId && needsSync(record, Date.now())
			);
			for (const record of due) {
				if (scopeRef.current !== scope) return;
				if (record.syncState === IncidentSyncState.PENDING) {
					commit(upsert({ ...record, syncState: IncidentSyncState.SYNCING }));
				}
				const updated = await syncIncidentRecord(
					record,
					api,
					Date.now(),
					() => scopeRef.current === scope && getStoredAuthUser()?.id === porterId
				);
				await store.put(updated);
				if (scopeRef.current !== scope) return;
				commit(upsert(updated));
			}
			if (due.length > 0) await queryClient.invalidateQueries({ queryKey: listKey });
		} catch {
			if (scopeRef.current === scope) {
				setQueueError("Không thể cập nhật bộ nhớ sự cố. Dữ liệu đã lưu sẽ được thử lại.");
				commit((current) =>
					current.map((record) =>
						record.syncState === IncidentSyncState.SYNCING
							? { ...record, syncState: IncidentSyncState.PENDING }
							: record
					)
				);
			}
		} finally {
			isSyncingRef.current = false;
		}
	}, [api, store, commit, queryClient, listKey, tripId, porterId, scope]);

	useEffect(() => {
		if (!isOnline || !isQueueLoaded) return;
		void syncNow();
		const timer = window.setInterval(() => void syncNow(), INCIDENT_SYNC_INTERVAL_MS);
		return () => window.clearInterval(timer);
	}, [isOnline, isQueueLoaded, syncNow]);

	// Drop device copies once the server list holds them and nothing is left to send.
	const serverIncidents = serverQuery.data?.items;
	useEffect(() => {
		if (!serverIncidents) return;
		const serverIds = new Set(serverIncidents.map((incident) => incident.id));
		const settled = recordsRef.current.filter(
			(record) => isSettled(record) && serverIds.has(record.id)
		);
		if (settled.length === 0) return;
		void Promise.all(settled.map((record) => store.remove(record.id)))
			.then(() => {
				if (scopeRef.current === scope)
					commit((current) => current.filter((record) => !settled.includes(record)));
			})
			.catch(() => setQueueError("Không thể cập nhật bộ nhớ sự cố trên thiết bị."));
	}, [serverIncidents, store, commit, scope]);

	const saveIncident = useCallback(
		async (input: NewIncidentInput): Promise<LocalIncidentRecord> => {
			if (!porterId || !isQueueLoaded || queueError) throw new Error("Bộ nhớ sự cố chưa sẵn sàng.");
			const record = createIncidentRecord(input, tripId, porterId, isOnline, new Date());
			await store.put(record);
			commit(upsert(record));
			if (isOnline) void syncNow();
			return record;
		},
		[porterId, tripId, isOnline, store, commit, syncNow, isQueueLoaded, queueError]
	);

	const updateRecord = useCallback(
		async (id: string, change: (record: LocalIncidentRecord) => LocalIncidentRecord | null) => {
			const record = recordsRef.current.find((item) => item.id === id);
			if (!record) return;
			const next = change(record);
			if (next) {
				await store.put(next);
				commit(upsert(next));
			} else {
				await store.remove(id);
				commit((current) => current.filter((item) => item.id !== id));
			}
		},
		[store, commit]
	);

	const retry = useCallback(
		async (id: string) => {
			await updateRecord(id, (record) => ({
				...record,
				syncState:
					record.syncState === IncidentSyncState.FAILED
						? IncidentSyncState.PENDING
						: record.syncState,
				mediaState:
					record.mediaState === IncidentMediaState.FAILED
						? IncidentMediaState.PENDING
						: record.mediaState,
				attempts: 0,
				nextAttemptAt: null,
				lastError: null,
			}));
			if (isOnline) void syncNow();
		},
		[updateRecord, isOnline, syncNow]
	);

	/** Only a server-rejected incident may be removed from the device; nothing synced is lost. */
	const discard = useCallback(
		(id: string) =>
			updateRecord(id, (record) => (record.syncState === IncidentSyncState.FAILED ? null : record)),
		[updateRecord]
	);

	const dropPhoto = useCallback(
		(id: string) =>
			updateRecord(id, (record) => ({
				...record,
				photo: null,
				mediaState: IncidentMediaState.NONE,
				lastError: null,
			})),
		[updateRecord]
	);

	const items: IncidentListItem[] = useMemo(
		() => mergeIncidentLists(serverIncidents ?? [], records),
		[serverIncidents, records]
	);

	return {
		items,
		isOnline,
		canReport: !!porterId && isQueueLoaded && !queueError,
		isLoading:
			!!porterId && (!isQueueLoaded || (records.length === 0 && isOnline && serverQuery.isLoading)),
		listError:
			queueError ??
			(isOnline && serverQuery.error ? classifySyncError(serverQuery.error).reason : null),
		unsentCount: records.filter(hasUnsentWork).length,
		saveIncident,
		retry,
		discard,
		dropPhoto,
		syncNow,
	};
}
