import type { EmergencyBroadcastEvent } from "../types";

type Listener = () => void;

/**
 * Alerts received on this page that the viewer has not dismissed yet. Kept outside React so the
 * socket listener (inside the route content) and the banner (rendered at the app root) share it.
 * `seen` survives dismissal, so a redelivered event with the same `eventId` is never shown twice.
 */
export function createEmergencyBroadcastInbox() {
	let alerts: EmergencyBroadcastEvent[] = [];
	const seen = new Set<string>();
	const listeners = new Set<Listener>();
	const notify = () => {
		for (const listener of listeners) listener();
	};
	return {
		subscribe(listener: Listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		getSnapshot: () => alerts,
		/** Returns false when the event was already received (dedupe by `eventId`). */
		receive(event: EmergencyBroadcastEvent): boolean {
			if (seen.has(event.eventId)) return false;
			seen.add(event.eventId);
			alerts = [event, ...alerts];
			notify();
			return true;
		},
		dismiss(eventId: string) {
			alerts = alerts.filter((alert) => alert.eventId !== eventId);
			notify();
		},
		clear() {
			alerts = [];
			seen.clear();
			notify();
		},
	};
}

export type EmergencyBroadcastInbox = ReturnType<typeof createEmergencyBroadcastInbox>;

export const emergencyBroadcastInbox = createEmergencyBroadcastInbox();
