import { useEffect, useRef } from "react";
import type { RealtimeConnection } from "../../../core/realtime/realtimeConnection";
import {
	useRealtimeConnection,
	useRealtimeEvent,
	useTripRoom,
} from "../../../core/realtime/useRealtime";
import type { RealtimeDisplayState } from "../../../shared/components/RealtimeConnectionStatus";

interface TripIncidentEvent {
	tripId: string;
}

/**
 * CTMS-078-T02: joins the Trip room (server-authorized, PB AC-4) and reloads the authoritative
 * incident list whenever `trip.incident.*` arrives for this Trip or the room is (re)joined, so events
 * missed while disconnected are recovered. Payloads never become list rows themselves.
 */
export function useTripIncidentsRealtime(
	tripId: string,
	reload: () => unknown,
	connection?: RealtimeConnection
): RealtimeDisplayState {
	const reloadRef = useRef(reload);
	useEffect(() => {
		reloadRef.current = reload;
	}, [reload]);

	const snapshot = useRealtimeConnection(true, connection);
	const room = useTripRoom(tripId, true, connection);

	useEffect(() => {
		if (room === "joined") void reloadRef.current();
	}, [room]);

	const onIncident = (payload: TripIncidentEvent) => {
		if (payload?.tripId === tripId) void reloadRef.current();
	};
	useRealtimeEvent("trip.incident.reported", onIncident, room === "joined", connection);
	useRealtimeEvent("trip.incident.updated", onIncident, room === "joined", connection);

	if (snapshot.state !== "connected") {
		return snapshot.state === "idle" ? "connecting" : snapshot.state;
	}
	if (room === "joined") return "connected";
	if (room === "refused") return "unauthorized";
	return "connecting";
}
