import type { Socket } from "socket.io-client";
import { vi } from "vitest";
import { type RealtimeConnectionDeps, createRealtimeConnection } from "./realtimeConnection";

type Handler = (...args: unknown[]) => void;

/** Minimal socket.io client double: the test drives server-side events with `serverEmit`. */
export class FakeRealtimeSocket {
	active = true;
	readonly handlers = new Map<string, Handler[]>();
	readonly managerHandlers = new Map<string, Handler[]>();
	readonly anyHandlers: Handler[] = [];
	readonly emitted: Array<{ event: string; payload: unknown }> = [];
	readonly connect = vi.fn();
	readonly disconnect = vi.fn(() => {
		this.active = false;
	});
	/** Ack returned for `trip.subscribe`; replace per test. */
	tripAck: (payload: { tripId: string }) => Promise<unknown> = async ({ tripId }) => ({
		ok: true,
		room: `trip:${tripId}`,
	});
	/** Ack returned for `realtime.resume` (CTMS-082); replace per test. */
	resumeAck: (payload: { afterSequence: number }) => Promise<unknown> = async () => ({
		ok: true,
		events: [],
		latestSequence: 0,
		truncated: false,
	});

	readonly io = {
		on: (event: string, handler: Handler) => {
			this.managerHandlers.set(event, [...(this.managerHandlers.get(event) ?? []), handler]);
		},
		reconnectionDelay: vi.fn(),
		reconnectionDelayMax: vi.fn(),
		randomizationFactor: vi.fn(),
	};

	constructor(readonly getToken: () => string | null) {}

	on(event: string, handler: Handler) {
		this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
		return this;
	}

	onAny(handler: Handler) {
		this.anyHandlers.push(handler);
		return this;
	}

	emit(event: string, payload: unknown) {
		this.emitted.push({ event, payload });
		return this;
	}

	timeout() {
		return {
			emitWithAck: (event: string, payload: unknown) => {
				this.emitted.push({ event, payload });
				if (event === "realtime.resume") {
					return this.resumeAck(payload as { afterSequence: number });
				}
				return this.tripAck(payload as { tripId: string });
			},
		};
	}

	/**
	 * Simulates a frame from the server (gateway events and application events alike); protected
	 * events carry `meta` as their second argument since CTMS-082.
	 */
	serverEmit(event: string, payload?: unknown, meta?: unknown) {
		const args = meta === undefined ? [payload] : [payload, meta];
		for (const handler of this.handlers.get(event) ?? []) handler(...args);
		for (const handler of this.anyHandlers) handler(event, ...args);
	}

	managerEmit(event: string) {
		for (const handler of this.managerHandlers.get(event) ?? []) handler();
	}
}

export function createFakeConnection(deps: Omit<RealtimeConnectionDeps, "createSocket"> = {}) {
	const sockets: FakeRealtimeSocket[] = [];
	const connection = createRealtimeConnection({
		refresh: vi.fn().mockResolvedValue("fresh"),
		onSessionExpired: vi.fn(),
		...deps,
		createSocket: (_url, getToken) => {
			const socket = new FakeRealtimeSocket(getToken);
			sockets.push(socket);
			return socket as unknown as Socket;
		},
	});
	return { connection, sockets, latest: () => sockets[sockets.length - 1] };
}
