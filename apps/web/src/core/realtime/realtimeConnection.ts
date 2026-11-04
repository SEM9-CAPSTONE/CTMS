import { type Socket, io } from "socket.io-client";
import { refreshAccessToken } from "../api/authRefresh";
import { clearAuthSessionAndRedirect } from "../api/authSessionSync";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";
const ACCESS_TOKEN_KEY = "accessToken";
const TRIP_ROOM_ACK_TIMEOUT_MS = 5_000;

/**
 * CTMS-078-T02. `connected` only after the server has authenticated the socket (BR-259); every other
 * state means real-time delivery must not be assumed.
 */
export type RealtimeConnectionState =
	| "idle"
	| "connecting"
	| "connected"
	| "reconnecting"
	| "disconnected"
	| "auth_rejected";

/** `pending` until the server acks `trip.subscribe`; only `joined` means Trip events will arrive. */
export type TripRoomStatus = "pending" | "joined" | "refused";

export interface RealtimeSnapshot {
	state: RealtimeConnectionState;
	/** Rooms the server reported on the current authenticated connection. */
	rooms: readonly string[];
	/** Incremented on every authenticated (re)connect, so consumers can reload missed data. */
	epoch: number;
	tripRooms: Readonly<Record<string, TripRoomStatus>>;
}

type TripRoomAck = { ok: true; room: string } | { ok: false; error: string };
type EventHandler = (payload: unknown) => void;

export interface RealtimeConnectionDeps {
	createSocket?: (url: string, getToken: () => string | null) => Socket;
	refresh?: () => Promise<unknown>;
	onSessionExpired?: () => void;
}

function socketBaseUrl(): string {
	return API_BASE_URL.replace(/\/api\/?$/, "");
}

function defaultCreateSocket(url: string, getToken: () => string | null): Socket {
	return io(url, {
		transports: ["websocket"],
		// Re-read on every (re)connect so a refreshed access token is always presented.
		auth: (cb) => cb({ token: getToken() ?? undefined }),
	});
}

const INITIAL_SNAPSHOT: RealtimeSnapshot = {
	state: "idle",
	rooms: [],
	epoch: 0,
	tripRooms: {},
};

/**
 * One authenticated socket per tab, shared by every real-time feature (CTMS-078-T02).
 *
 * The socket opens when the first feature acquires it and closes when the last one releases it.
 * A rejected handshake triggers the same session recovery as an HTTP 401 (CTMS-04): one token
 * refresh, then reconnect; if the refresh fails the session is cleared and the user is sent to Login.
 * Trip rooms are joined only through server-acked `trip.subscribe` and are re-requested after every
 * reconnect, because the server never carries room membership across connections.
 */
export function createRealtimeConnection(deps: RealtimeConnectionDeps = {}) {
	const createSocket = deps.createSocket ?? defaultCreateSocket;
	const refresh = deps.refresh ?? refreshAccessToken;
	const onSessionExpired = deps.onSessionExpired ?? clearAuthSessionAndRedirect;

	let socket: Socket | undefined;
	let refs = 0;
	let closeTimer: ReturnType<typeof setTimeout> | undefined;
	let refreshAttempted = false;
	let snapshot = INITIAL_SNAPSHOT;
	const listeners = new Set<() => void>();
	const handlers = new Map<string, Set<EventHandler>>();
	const tripRefs = new Map<string, number>();

	function update(patch: Partial<RealtimeSnapshot>) {
		snapshot = { ...snapshot, ...patch };
		for (const listener of listeners) listener();
	}

	function resetTripRooms(): Record<string, TripRoomStatus> {
		return Object.fromEntries([...tripRefs.keys()].map((tripId) => [tripId, "pending" as const]));
	}

	function setTripRoom(tripId: string, status: TripRoomStatus) {
		if (!tripRefs.has(tripId)) return;
		update({ tripRooms: { ...snapshot.tripRooms, [tripId]: status } });
	}

	function requestTripRoom(tripId: string) {
		const current = socket;
		if (!current || snapshot.state !== "connected") return;
		current
			.timeout(TRIP_ROOM_ACK_TIMEOUT_MS)
			.emitWithAck("trip.subscribe", { tripId })
			.then((ack: TripRoomAck) => {
				if (socket !== current || snapshot.state !== "connected") return;
				setTripRoom(tripId, ack?.ok ? "joined" : "refused");
			})
			.catch(() => {
				// No ack: membership is unknown, so it stays pending until the next authenticated connect.
			});
	}

	function handleAuthRejected() {
		update({ state: "auth_rejected", rooms: [], tripRooms: resetTripRooms() });
		if (refreshAttempted) {
			// A freshly refreshed token was rejected too: the session cannot be recovered.
			onSessionExpired();
			return;
		}
		refreshAttempted = true;
		refresh()
			.then(() => {
				if (socket && refs > 0) socket.connect();
			})
			.catch(() => {
				update({ state: "disconnected" });
				onSessionExpired();
			});
	}

	function open() {
		if (!localStorage.getItem(ACCESS_TOKEN_KEY)) {
			// Without a session the server would only accept an anonymous socket, which never carries
			// protected events, so no authenticated channel is claimed.
			update({ state: "disconnected" });
			return;
		}
		update({ state: "connecting", rooms: [], tripRooms: resetTripRooms() });
		const created = createSocket(socketBaseUrl(), () => localStorage.getItem(ACCESS_TOKEN_KEY));
		socket = created;

		created.on("connected", (payload?: { authenticated?: boolean; rooms?: string[] }) => {
			if (!payload?.authenticated) {
				update({ state: "disconnected", rooms: [] });
				return;
			}
			refreshAttempted = false;
			update({
				state: "connected",
				rooms: payload.rooms ?? [],
				epoch: snapshot.epoch + 1,
				tripRooms: resetTripRooms(),
			});
			for (const tripId of tripRefs.keys()) requestTripRoom(tripId);
		});
		created.on("auth.error", handleAuthRejected);
		created.on("disconnect", () => {
			if (snapshot.state === "auth_rejected") return;
			update({
				state: created.active ? "reconnecting" : "disconnected",
				rooms: [],
				tripRooms: resetTripRooms(),
			});
		});
		created.on("connect_error", () => {
			if (snapshot.state === "auth_rejected") return;
			update({ state: created.active ? "reconnecting" : "disconnected" });
		});
		created.io.on("reconnect_attempt", () => {
			if (snapshot.state !== "auth_rejected") update({ state: "reconnecting" });
		});
		created.io.on("reconnect_failed", () => update({ state: "disconnected" }));
		created.onAny((event: string, payload: unknown) => {
			for (const handler of handlers.get(event) ?? []) handler(payload);
		});
	}

	function close() {
		socket?.disconnect();
		socket = undefined;
		refreshAttempted = false;
		update({ ...INITIAL_SNAPSHOT, epoch: snapshot.epoch });
	}

	return {
		getSnapshot: (): RealtimeSnapshot => snapshot,

		subscribe(listener: () => void): () => void {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},

		/** Keeps the shared socket open until the returned release function is called. */
		acquire(): () => void {
			refs += 1;
			if (closeTimer) {
				clearTimeout(closeTimer);
				closeTimer = undefined;
			}
			if (!socket) open();
			let released = false;
			return () => {
				if (released) return;
				released = true;
				refs -= 1;
				if (refs > 0) return;
				// Deferred so an immediate re-acquire (StrictMode, route remount) keeps the connection.
				closeTimer = setTimeout(() => {
					closeTimer = undefined;
					if (refs === 0) close();
				}, 0);
			};
		},

		on(event: string, handler: EventHandler): () => void {
			let set = handlers.get(event);
			if (!set) {
				set = new Set();
				handlers.set(event, set);
			}
			set.add(handler);
			return () => {
				set.delete(handler);
			};
		},

		/** Requests a Trip room; it counts as joined only once the server acks `ok: true`. */
		subscribeTrip(tripId: string): () => void {
			const count = tripRefs.get(tripId) ?? 0;
			tripRefs.set(tripId, count + 1);
			if (count === 0) {
				update({ tripRooms: { ...snapshot.tripRooms, [tripId]: "pending" } });
				requestTripRoom(tripId);
			}
			let released = false;
			return () => {
				if (released) return;
				released = true;
				const remaining = (tripRefs.get(tripId) ?? 1) - 1;
				if (remaining > 0) {
					tripRefs.set(tripId, remaining);
					return;
				}
				tripRefs.delete(tripId);
				const { [tripId]: _removed, ...rest } = snapshot.tripRooms;
				update({ tripRooms: rest });
				if (socket && snapshot.state === "connected") {
					socket.emit("trip.unsubscribe", { tripId });
				}
			};
		},
	};
}

export type RealtimeConnection = ReturnType<typeof createRealtimeConnection>;

export const realtimeConnection = createRealtimeConnection();
