import { useEffect, useRef, useSyncExternalStore } from "react";
import {
	type RealtimeConnection,
	type RealtimeSnapshot,
	type TripRoomStatus,
	realtimeConnection,
} from "./realtimeConnection";

const DISABLED_SNAPSHOT: RealtimeSnapshot = { state: "idle", rooms: [], epoch: 0, tripRooms: {} };

/** CTMS-078-T02: holds the shared authenticated socket open while mounted and enabled. */
export function useRealtimeConnection(
	enabled = true,
	connection: RealtimeConnection = realtimeConnection
): RealtimeSnapshot {
	useEffect(() => (enabled ? connection.acquire() : undefined), [enabled, connection]);
	const snapshot = useSyncExternalStore(connection.subscribe, connection.getSnapshot);
	return enabled ? snapshot : DISABLED_SNAPSHOT;
}

/** Runs the latest handler for a server event on the shared socket while enabled. */
export function useRealtimeEvent<T>(
	event: string,
	handler: (payload: T) => void,
	enabled = true,
	connection: RealtimeConnection = realtimeConnection
): void {
	const handlerRef = useRef(handler);
	useEffect(() => {
		handlerRef.current = handler;
	}, [handler]);
	useEffect(() => {
		if (!enabled) return;
		return connection.on(event, (payload) => handlerRef.current(payload as T));
	}, [event, enabled, connection]);
}

/**
 * Requests the Trip room for `tripId` (CTMS-078 PB AC-4). Returns `joined` only after the server has
 * authorized it; `refused` means this user will not receive the Trip's events.
 */
export function useTripRoom(
	tripId: string | null | undefined,
	enabled = true,
	connection: RealtimeConnection = realtimeConnection
): TripRoomStatus | null {
	const active = enabled && Boolean(tripId);
	const snapshot = useRealtimeConnection(active, connection);
	useEffect(
		() => (active && tripId ? connection.subscribeTrip(tripId) : undefined),
		[active, tripId, connection]
	);
	if (!active || !tripId) return null;
	return snapshot.tripRooms[tripId] ?? "pending";
}
