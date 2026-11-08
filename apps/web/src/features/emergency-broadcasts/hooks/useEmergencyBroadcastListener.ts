import type { RealtimeConnection } from "../../../core/realtime/realtimeConnection";
import { useRealtimeConnection, useRealtimeEvent } from "../../../core/realtime/useRealtime";
import {
	type EmergencyBroadcastInbox,
	emergencyBroadcastInbox,
} from "../store/emergencyBroadcastInbox";
import type { EmergencyBroadcastEvent } from "../types";

/**
 * CTMS-081-T02: while a Camper or Porter is signed in, keeps the authenticated socket open and puts
 * every `emergency.broadcast` addressed to them into the inbox shown by `EmergencyBroadcastAlerts`.
 * The server only sends the event to addressed users; the sender's own echo is ignored here.
 */
export function useEmergencyBroadcastListener(
	enabled: boolean,
	currentUserId: string | null,
	options: { connection?: RealtimeConnection; inbox?: EmergencyBroadcastInbox } = {}
): void {
	const { connection, inbox = emergencyBroadcastInbox } = options;
	useRealtimeConnection(enabled, connection);
	useRealtimeEvent<EmergencyBroadcastEvent>(
		"emergency.broadcast",
		(event) => {
			if (!event?.eventId || event.hostId === currentUserId) return;
			inbox.receive(event);
		},
		enabled,
		connection
	);
}
