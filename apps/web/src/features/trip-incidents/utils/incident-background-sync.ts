import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../core/api";
import { getStoredAuthUser } from "../../auth/utils/tokenStorage";
import { INCIDENT_SYNC_INTERVAL_MS } from "../constants";
import { type TripIncidentsApi, tripIncidentsService } from "../services/trip-incidents.service";
import {
	type IncidentQueueStore,
	getDefaultIncidentQueueStore,
} from "../storage/incident-queue.store";
import { needsSync, syncIncidentRecord } from "./incident-sync";

const visibleTrips = new Map<string, number>();

/** The visible panel owns its Trip's synchronization and immediate UI updates. */
export function registerVisibleIncidentTrip(porterId: string, tripId: string): () => void {
	const key = `${porterId}:${tripId}`;
	visibleTrips.set(key, (visibleTrips.get(key) ?? 0) + 1);
	return () => {
		const count = (visibleTrips.get(key) ?? 1) - 1;
		if (count === 0) visibleTrips.delete(key);
		else visibleTrips.set(key, count);
	};
}

/** Process other Trips too, so leaving the detail page cannot strand the outbox. */
export async function syncBackgroundIncidents(
	porterId: string,
	store: IncidentQueueStore,
	api: TripIncidentsApi,
	isActive: () => boolean,
	onSynced: (tripId: string) => void
): Promise<void> {
	const records = (await store.listForPorter?.(porterId)) ?? [];
	for (const record of records) {
		if (!isActive()) return;
		if (record.porterId !== porterId || visibleTrips.has(`${porterId}:${record.tripId}`)) continue;
		if (!needsSync(record, Date.now())) continue;
		const updated = await syncIncidentRecord(record, api, Date.now(), isActive);
		await store.put(updated);
		onSynced(record.tripId);
	}
}

export function initIncidentQueueSync(queryClient: QueryClient): () => void {
	let busy = false;
	const tick = async () => {
		const user = getStoredAuthUser();
		if (
			busy ||
			!navigator.onLine ||
			!user ||
			!(user.role === "porter" || user.roles?.includes("porter"))
		)
			return;
		busy = true;
		try {
			await syncBackgroundIncidents(
				user.id,
				getDefaultIncidentQueueStore(),
				tripIncidentsService,
				() => getStoredAuthUser()?.id === user.id && navigator.onLine,
				(tripId) => {
					void queryClient.invalidateQueries({
						queryKey: queryKeys.trips.incidents(user.id, tripId),
					});
				}
			);
		} catch (error) {
			console.error("Unable to synchronize the incident outbox", error);
		} finally {
			busy = false;
		}
	};
	const run = () => {
		void tick();
	};
	const interval = window.setInterval(run, INCIDENT_SYNC_INTERVAL_MS);
	window.addEventListener("online", run);
	window.addEventListener("focus", run);
	run();
	return () => {
		window.clearInterval(interval);
		window.removeEventListener("online", run);
		window.removeEventListener("focus", run);
	};
}
