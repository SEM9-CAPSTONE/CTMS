import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { type Socket, io } from "socket.io-client";
import { refreshAccessToken } from "../../../core/api/authRefresh";
import { toast } from "../../../shared/components/Toast";
import { EMERGENCY_LABELS } from "../components/EmergencyAlertBanner";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";
const ACCESS_TOKEN_KEY = "accessToken";
const SEEN_EVENT_LIMIT = 200;
/** How long the "recovered" state stays visible before settling back to live. */
export const SOS_RECOVERED_DISPLAY_MS = 5_000;

const HOST_SOS_LIST_KEY = ["sos", "host-list"] as const;
const HOST_OVERVIEW_KEY = ["host-overview"] as const;

function socketBaseUrl(): string {
	return API_BASE_URL.replace(/\/api\/?$/, "");
}

/**
 * CTMS-079: `live` only once the server has authenticated the socket (BR-259); `recovered` right after
 * a reconnect, when lists have been reloaded to pick up SOS that may have been missed while offline.
 */
export type SosRealtimeState = "connecting" | "live" | "disconnected" | "recovered";

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
 * CTMS-079-T02 (BR-260): receive the Host's SOS events over the authenticated WebSocket.
 *
 * Events never become UI rows on their own: each one only invalidates the Host SOS queries so the
 * authoritative API is reloaded, which keeps the client from fabricating an SOS it did not get from
 * the backend. Repeated deliveries are deduped by event identity; the existing polling stays as the
 * fallback while the socket is down.
 */
export function useHostSosRealtime({
	enabled = true,
}: { enabled?: boolean } = {}): SosRealtimeState {
	const queryClient = useQueryClient();
	const [state, setState] = useState<SosRealtimeState>("connecting");

	useEffect(() => {
		if (!enabled) return;

		let socket: Socket | undefined;
		let disposed = false;
		let hasBeenLive = false;
		let refreshAttempted = false;
		let recoveredTimer: number | undefined;

		const reloadAuthoritativeSos = () => {
			void queryClient.invalidateQueries({ queryKey: HOST_SOS_LIST_KEY });
			void queryClient.invalidateQueries({ queryKey: HOST_OVERVIEW_KEY });
		};

		setState("connecting");

		// StrictMode's discarded mount must not open a connection that is immediately closed.
		const timer = window.setTimeout(() => {
			socket = io(socketBaseUrl(), {
				transports: ["websocket"],
				// Re-read on every (re)connect so a refreshed access token is always used.
				auth: (cb) => cb({ token: localStorage.getItem(ACCESS_TOKEN_KEY) ?? undefined }),
			});

			socket.on("connected", (payload?: { authenticated?: boolean }) => {
				if (!payload?.authenticated) {
					// Anonymous sockets never receive SOS, so real-time delivery must not be claimed.
					setState("disconnected");
					return;
				}
				refreshAttempted = false;
				// Pick up anything persisted between the last load (or disconnect) and this connection.
				reloadAuthoritativeSos();
				if (hasBeenLive) {
					setState("recovered");
					window.clearTimeout(recoveredTimer);
					recoveredTimer = window.setTimeout(() => {
						if (!disposed) setState("live");
					}, SOS_RECOVERED_DISPLAY_MS);
				} else {
					setState("live");
				}
				hasBeenLive = true;
			});

			socket.on("disconnect", () => {
				if (disposed) return;
				window.clearTimeout(recoveredTimer);
				setState("disconnected");
			});

			socket.on("connect_error", () => {
				if (!disposed) setState("disconnected");
			});

			// Invalid/expired token: the server drops the socket. Refresh once, then reconnect.
			socket.on("auth.error", () => {
				if (disposed || refreshAttempted) return;
				refreshAttempted = true;
				refreshAccessToken()
					.then(() => {
						if (!disposed) socket?.connect();
					})
					.catch(() => {
						if (!disposed) setState("disconnected");
					});
			});

			socket.on("sos.created", (payload: SosCreatedEvent) => {
				if (!payload?.sosId) return;
				if (!markSeen(`created:${payload.eventId || payload.sosId}`)) return;
				reloadAuthoritativeSos();
				const label = EMERGENCY_LABELS[payload.emergencyType] || "Yêu cầu cứu trợ";
				toast.error(
					`${label} · Mã chuyến: ${payload.tripId.slice(0, 8)}`,
					"Yêu cầu cứu trợ khẩn cấp"
				);
			});

			socket.on("sos.state_changed", (payload: SosStateChangedEvent) => {
				if (!payload?.sosId) return;
				if (!markSeen(`state:${payload.sosId}:${payload.status}`)) return;
				reloadAuthoritativeSos();
			});
		}, 0);

		return () => {
			disposed = true;
			window.clearTimeout(timer);
			window.clearTimeout(recoveredTimer);
			socket?.disconnect();
		};
	}, [enabled, queryClient]);

	return state;
}
