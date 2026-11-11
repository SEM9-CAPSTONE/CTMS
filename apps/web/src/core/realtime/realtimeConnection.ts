import { type Socket, io } from "socket.io-client";
import { refreshAccessToken } from "../api/authRefresh";
import { clearAuthSessionAndRedirect } from "../api/authSessionSync";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";
const ACCESS_TOKEN_KEY = "accessToken";
const TRIP_ROOM_ACK_TIMEOUT_MS = 5_000;
const RESUME_ACK_TIMEOUT_MS = 5_000;
/** Event ids remembered to drop the second copy of an event (live + recovered). */
const SEEN_EVENT_LIMIT = 500;

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

/**
 * CTMS-082-T02: missed-event recovery after a reconnect. `failed` means some missed events could
 * not be replayed (resume refused, timed out or `truncated`); the lists are still reloaded through
 * the epoch, so only notifications may be missing.
 */
export type RealtimeRecoveryState = "idle" | "recovering" | "recovered" | "failed";

/** Second argument of every protected server event (CTMS-082-T01, spec Section 9). */
export interface RealtimeEventMeta {
	eventId: string;
	sequence: number | null;
	emittedAt: string;
}

/** Bounded reconnect backoff sent by the server in `connected` (BR-263). */
export interface RealtimeReconnectPolicy {
	initialDelayMs: number;
	maxDelayMs: number;
	multiplier: number;
	jitterRatio: number;
}

/** Used until the server sends its own policy; same values as the server defaults. */
export const DEFAULT_RECONNECT_POLICY: RealtimeReconnectPolicy = {
	initialDelayMs: 1_000,
	maxDelayMs: 30_000,
	multiplier: 2,
	jitterRatio: 0.2,
};

export interface RealtimeSnapshot {
	state: RealtimeConnectionState;
	/** Rooms the server reported on the current authenticated connection. */
	rooms: readonly string[];
	/** Incremented on every authenticated (re)connect, so consumers can reload missed data. */
	epoch: number;
	tripRooms: Readonly<Record<string, TripRoomStatus>>;
	recovery: RealtimeRecoveryState;
}

type TripRoomAck = { ok: true; room: string } | { ok: false; error: string };
type ResumeAck =
	| {
			ok: true;
			events: Array<{ event: string; payload: unknown; meta: RealtimeEventMeta }>;
			latestSequence: number;
			truncated: boolean;
	  }
	| { ok: false; error: string };
type EventHandler = (payload: unknown, meta?: RealtimeEventMeta) => void;

interface ConnectedPayload {
	authenticated?: boolean;
	rooms?: string[];
	latestSequence?: number | null;
	reconnect?: Partial<RealtimeReconnectPolicy>;
}

interface ReconnectManager {
	reconnectionDelay?: (value: number) => unknown;
	reconnectionDelayMax?: (value: number) => unknown;
	randomizationFactor?: (value: number) => unknown;
}

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
		// BR-263 bounded backoff until the server sends its own policy in `connected`.
		reconnectionDelay: DEFAULT_RECONNECT_POLICY.initialDelayMs,
		reconnectionDelayMax: DEFAULT_RECONNECT_POLICY.maxDelayMs,
		randomizationFactor: DEFAULT_RECONNECT_POLICY.jitterRatio,
	});
}

function positive(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Applies the server's bounded backoff to socket.io. socket.io doubles the delay on each attempt,
 * which is the server's default multiplier; the cap and the jitter come from the server.
 */
function applyReconnectPolicy(
	socket: Socket,
	policy: Partial<RealtimeReconnectPolicy> | undefined
) {
	if (!policy) return;
	const manager = socket.io as unknown as ReconnectManager | undefined;
	const initial = positive(policy.initialDelayMs);
	const max = positive(policy.maxDelayMs);
	if (initial !== null) manager?.reconnectionDelay?.(initial);
	if (max !== null) manager?.reconnectionDelayMax?.(Math.max(max, initial ?? 0));
	const jitter = policy.jitterRatio;
	if (typeof jitter === "number" && jitter >= 0 && jitter <= 1) {
		manager?.randomizationFactor?.(jitter);
	}
}

const INITIAL_SNAPSHOT: RealtimeSnapshot = {
	state: "idle",
	rooms: [],
	epoch: 0,
	tripRooms: {},
	recovery: "idle",
};

/**
 * One authenticated socket per tab, shared by every real-time feature (CTMS-078-T02).
 *
 * The socket opens when the first feature acquires it and closes when the last one releases it.
 * A rejected handshake triggers the same session recovery as an HTTP 401 (CTMS-04): one token
 * refresh, then reconnect; if the refresh fails the session is cleared and the user is sent to Login.
 * Trip rooms are joined only through server-acked `trip.subscribe` and are re-requested after every
 * reconnect, because the server never carries room membership across connections.
 *
 * CTMS-082-T02: the connection keeps the last event cursor it saw. After every authenticated
 * reconnect it asks the server for the events it missed (`realtime.resume`) and replays them to the
 * same handlers as live events, in cursor order. Events carrying `meta.eventId` are delivered once,
 * whether they arrive live, recovered or both.
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
	/** Highest event cursor delivered on this session; null until the server gives one. */
	let lastSequence: number | null = null;
	/** True once this session had an authenticated connection, so the next one is a reconnect. */
	let connectedBefore = false;
	const seenEventIds = new Set<string>();

	function rememberEvent(eventId: string): boolean {
		if (seenEventIds.has(eventId)) return false;
		seenEventIds.add(eventId);
		if (seenEventIds.size > SEEN_EVENT_LIMIT) {
			const oldest = seenEventIds.values().next().value;
			if (oldest !== undefined) seenEventIds.delete(oldest);
		}
		return true;
	}

	/** Single path for live and recovered events: dedupe by identity, advance the cursor, dispatch. */
	function dispatch(event: string, payload: unknown, meta?: RealtimeEventMeta) {
		if (meta && typeof meta.eventId === "string" && meta.eventId) {
			if (!rememberEvent(meta.eventId)) return;
		}
		const sequence = meta?.sequence;
		if (typeof sequence === "number" && (lastSequence === null || sequence > lastSequence)) {
			lastSequence = sequence;
		}
		for (const handler of handlers.get(event) ?? []) {
			// Events without meta (gateway frames, public availability) keep their one-argument call.
			if (meta === undefined) handler(payload);
			else handler(payload, meta);
		}
	}

	function resume(current: Socket, afterSequence: number) {
		update({ recovery: "recovering" });
		current
			.timeout(RESUME_ACK_TIMEOUT_MS)
			.emitWithAck("realtime.resume", { afterSequence })
			.then((ack: ResumeAck) => {
				if (socket !== current || snapshot.state !== "connected") return;
				if (!ack?.ok) {
					update({ recovery: "failed" });
					return;
				}
				const events = [...(ack.events ?? [])].sort(
					(a, b) => (a.meta?.sequence ?? 0) - (b.meta?.sequence ?? 0)
				);
				for (const item of events) dispatch(item.event, item.payload, item.meta);
				if (
					typeof ack.latestSequence === "number" &&
					(lastSequence === null || ack.latestSequence > lastSequence)
				) {
					lastSequence = ack.latestSequence;
				}
				update({ recovery: ack.truncated ? "failed" : "recovered" });
			})
			.catch(() => {
				if (socket === current && snapshot.state === "connected") update({ recovery: "failed" });
			});
	}

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

		created.on("connected", (payload?: ConnectedPayload) => {
			if (!payload?.authenticated) {
				update({ state: "disconnected", rooms: [] });
				return;
			}
			refreshAttempted = false;
			applyReconnectPolicy(created, payload.reconnect);
			const isReconnect = connectedBefore;
			connectedBefore = true;
			const serverCursor =
				typeof payload.latestSequence === "number" ? payload.latestSequence : null;
			const resumeFrom = isReconnect ? lastSequence : null;
			if (lastSequence === null && serverCursor !== null) lastSequence = serverCursor;
			update({
				state: "connected",
				rooms: payload.rooms ?? [],
				epoch: snapshot.epoch + 1,
				tripRooms: resetTripRooms(),
				// A reconnect without a cursor to resume from cannot replay what was missed.
				recovery: isReconnect && resumeFrom === null && serverCursor !== null ? "failed" : "idle",
			});
			for (const tripId of tripRefs.keys()) requestTripRoom(tripId);
			if (resumeFrom !== null) resume(created, resumeFrom);
		});
		created.on("auth.error", handleAuthRejected);
		created.on("disconnect", () => {
			if (snapshot.state === "auth_rejected") return;
			update({
				state: created.active ? "reconnecting" : "disconnected",
				rooms: [],
				tripRooms: resetTripRooms(),
				recovery: "idle",
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
		created.onAny((event: string, payload: unknown, meta?: RealtimeEventMeta) => {
			dispatch(event, payload, meta);
		});
	}

	function close() {
		socket?.disconnect();
		socket = undefined;
		refreshAttempted = false;
		lastSequence = null;
		connectedBefore = false;
		seenEventIds.clear();
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
