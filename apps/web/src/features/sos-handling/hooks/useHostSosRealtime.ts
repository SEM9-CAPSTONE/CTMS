import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeConnection } from "../../../core/realtime/realtimeConnection";
import { useRealtimeConnection, useRealtimeEvent } from "../../../core/realtime/useRealtime";
import { toast } from "../../../shared/components/Toast";
import { EMERGENCY_LABELS } from "../components/EmergencyAlertBanner";

const SEEN_EVENT_LIMIT = 200;
/** How long the "recovered" state stays visible before settling back to live. */
export const SOS_RECOVERED_DISPLAY_MS = 5_000;

const HOST_SOS_LIST_KEY = ["sos", "host-list"] as const;
const HOST_OVERVIEW_KEY = ["host-overview"] as const;

/**
 * CTMS-079 / CTMS-078: `live` only once the server has authenticated the shared socket (BR-259);
 * `recovered` right after a reconnect, when lists have been reloaded to pick up missed SOS.
 */
export type SosRealtimeState =
	| "connecting"
	| "live"
	| "reconnecting"
	| "disconnected"
	| "auth_rejected"
	| "recovered";

/** `sos.created` payload from CTMS-079-T01 (spec Section 9). */
export interface SosCreatedEvent {
	eventId: string;
	sosId: string;
	tripId: string;
	senderId: string;
	emergencyType: string;
	status: string;
	eventTime: string;
	persistedAt: string;
}

interface SosStateChangedEvent {
	sosId: string;
	tripId: string;
	status: string;
}

// Module-level so a layout remount (every Host route renders its own HostLayout) never re-alerts
// an SOS that was already announced in this tab.
const seenEventKeys = new Set<string>();

function markSeen(key: string): boolean {
	if (seenEventKeys.has(key)) return false;
	seenEventKeys.add(key);
	if (seenEventKeys.size > SEEN_EVENT_LIMIT) {
		const oldest = seenEventKeys.values().next().value;
		if (oldest) seenEventKeys.delete(oldest);
	}
	return true;
}

/** Test-only: forget announced events between test cases. */
export function resetSosRealtimeDedupe(): void {
	seenEventKeys.clear();
}

/**
 * CTMS-079-T02 (BR-260): receive the Host's SOS events over the shared authenticated WebSocket.
 *
 * Events never become UI rows on their own: each one only invalidates the Host SOS queries so the
 * authoritative API is reloaded, which keeps the client from fabricating an SOS it did not get from
 * the backend. Repeated deliveries are deduped by event identity; the existing polling stays as the
 * fallback while the socket is down.
 */
export function useHostSosRealtime({
	enabled = true,
	connection,
}: { enabled?: boolean; connection?: RealtimeConnection } = {}): SosRealtimeState {
	const queryClient = useQueryClient();
	const snapshot = useRealtimeConnection(enabled, connection);
	const [recovered, setRecovered] = useState(false);
	const firstEpochRef = useRef<number | null>(null);

	const reloadAuthoritativeSos = useCallback(() => {
		void queryClient.invalidateQueries({ queryKey: HOST_SOS_LIST_KEY });
		void queryClient.invalidateQueries({ queryKey: HOST_OVERVIEW_KEY });
	}, [queryClient]);

	// Every authenticated (re)connect reloads the lists, picking up anything persisted meanwhile.
	useEffect(() => {
		if (!enabled || snapshot.state !== "connected") return;
		reloadAuthoritativeSos();
		if (firstEpochRef.current === null) {
			firstEpochRef.current = snapshot.epoch;
			return;
		}
		if (snapshot.epoch === firstEpochRef.current) return;
		setRecovered(true);
		const timer = window.setTimeout(() => setRecovered(false), SOS_RECOVERED_DISPLAY_MS);
		return () => window.clearTimeout(timer);
	}, [enabled, snapshot.state, snapshot.epoch, reloadAuthoritativeSos]);

	useRealtimeEvent<SosCreatedEvent>(
		"sos.created",
		(payload) => {
			if (!payload?.sosId) return;
			if (!markSeen(`created:${payload.eventId || payload.sosId}`)) return;
			reloadAuthoritativeSos();
			const label = EMERGENCY_LABELS[payload.emergencyType] || "Yêu cầu cứu trợ";
			toast.error(
				`${label} · Mã chuyến: ${payload.tripId.slice(0, 8)}`,
				"Yêu cầu cứu trợ khẩn cấp"
			);
		},
		enabled,
		connection
	);

	useRealtimeEvent<SosStateChangedEvent>(
		"sos.state_changed",
		(payload) => {
			if (!payload?.sosId) return;
			if (!markSeen(`state:${payload.sosId}:${payload.status}`)) return;
			reloadAuthoritativeSos();
		},
		enabled,
		connection
	);

	switch (snapshot.state) {
		case "connected":
			return recovered ? "recovered" : "live";
		case "reconnecting":
		case "disconnected":
		case "auth_rejected":
			return snapshot.state;
		default:
			return "connecting";
	}
}
