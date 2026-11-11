import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeConnection } from "./fakeRealtimeSocket.test-utils";

const TRIP_ID = "44444444-4444-4444-8444-444444444444";

async function flush() {
	await Promise.resolve();
	await Promise.resolve();
}

beforeEach(() => {
	vi.useFakeTimers();
	localStorage.setItem("accessToken", "access-1");
});

afterEach(() => {
	localStorage.clear();
	vi.useRealTimers();
});

describe("realtimeConnection (CTMS-078-T02)", () => {
	it("opens one shared authenticated socket for all consumers and closes after the last release", () => {
		const { connection, sockets, latest } = createFakeConnection();

		const releaseA = connection.acquire();
		const releaseB = connection.acquire();
		expect(sockets).toHaveLength(1);
		expect(latest().getToken()).toBe("access-1");
		expect(connection.getSnapshot().state).toBe("connecting");

		releaseA();
		vi.runAllTimers();
		expect(latest().disconnect).not.toHaveBeenCalled();

		releaseB();
		vi.runAllTimers();
		expect(latest().disconnect).toHaveBeenCalledTimes(1);
		expect(connection.getSnapshot().state).toBe("idle");
	});

	it("keeps the socket across an immediate release/re-acquire (StrictMode, remount)", () => {
		const { connection, sockets } = createFakeConnection();

		connection.acquire()();
		connection.acquire();
		vi.runAllTimers();

		expect(sockets).toHaveLength(1);
		expect(sockets[0].disconnect).not.toHaveBeenCalled();
	});

	it("presents the current token on every reconnect", () => {
		const { connection, latest } = createFakeConnection();
		connection.acquire();

		localStorage.setItem("accessToken", "access-2");

		expect(latest().getToken()).toBe("access-2");
	});

	it("does not open a socket or claim a channel without a session", () => {
		localStorage.clear();
		const { connection, sockets } = createFakeConnection();

		connection.acquire();

		expect(sockets).toHaveLength(0);
		expect(connection.getSnapshot().state).toBe("disconnected");
	});

	it("is connected only after the server confirms authentication, and records the granted rooms", () => {
		const { connection, latest } = createFakeConnection();
		connection.acquire();

		latest().serverEmit("connected", { authenticated: true, rooms: ["user:u1", "role:host"] });

		expect(connection.getSnapshot()).toMatchObject({
			state: "connected",
			rooms: ["user:u1", "role:host"],
			epoch: 1,
		});
	});

	it("never treats an anonymous (unauthenticated) socket as an active channel", () => {
		const { connection, latest } = createFakeConnection();
		connection.acquire();

		latest().serverEmit("connected", { authenticated: false });

		expect(connection.getSnapshot().state).toBe("disconnected");
		expect(connection.getSnapshot().rooms).toEqual([]);
	});

	it("shows reconnecting while socket.io retries, disconnected once it gives up", () => {
		const { connection, latest } = createFakeConnection();
		connection.acquire();
		latest().serverEmit("connected", { authenticated: true, rooms: ["user:u1"] });

		latest().serverEmit("disconnect", "transport close");
		expect(connection.getSnapshot()).toMatchObject({ state: "reconnecting", rooms: [] });

		latest().managerEmit("reconnect_attempt");
		expect(connection.getSnapshot().state).toBe("reconnecting");

		latest().managerEmit("reconnect_failed");
		expect(connection.getSnapshot().state).toBe("disconnected");
	});

	it("increments the epoch on each authenticated reconnect so consumers can reload", () => {
		const { connection, latest } = createFakeConnection();
		connection.acquire();
		latest().serverEmit("connected", { authenticated: true });
		latest().serverEmit("disconnect", "transport close");
		latest().serverEmit("connected", { authenticated: true });

		expect(connection.getSnapshot()).toMatchObject({ state: "connected", epoch: 2 });
	});

	describe("session recovery on rejected authentication", () => {
		it("refreshes the token once and reconnects", async () => {
			const refresh = vi.fn().mockResolvedValue("access-2");
			const onSessionExpired = vi.fn();
			const { connection, latest } = createFakeConnection({ refresh, onSessionExpired });
			connection.acquire();

			latest().serverEmit("auth.error", { message: "Invalid or expired access token" });
			expect(connection.getSnapshot().state).toBe("auth_rejected");
			latest().active = false;
			latest().serverEmit("disconnect", "io server disconnect");
			expect(connection.getSnapshot().state).toBe("auth_rejected");
			await flush();

			expect(refresh).toHaveBeenCalledTimes(1);
			expect(latest().connect).toHaveBeenCalledTimes(1);
			expect(onSessionExpired).not.toHaveBeenCalled();

			latest().serverEmit("connected", { authenticated: true });
			expect(connection.getSnapshot().state).toBe("connected");
		});

		it("clears the session (redirect to Login) when the refresh fails", async () => {
			const refresh = vi.fn().mockRejectedValue(new Error("refresh failed"));
			const onSessionExpired = vi.fn();
			const { connection, latest } = createFakeConnection({ refresh, onSessionExpired });
			connection.acquire();

			latest().serverEmit("auth.error", { message: "Invalid or expired access token" });
			await flush();

			expect(onSessionExpired).toHaveBeenCalledTimes(1);
			expect(latest().connect).not.toHaveBeenCalled();
			expect(connection.getSnapshot().state).toBe("disconnected");
		});

		it("clears the session when even the refreshed token is rejected", async () => {
			const onSessionExpired = vi.fn();
			const { connection, latest } = createFakeConnection({ onSessionExpired });
			connection.acquire();

			latest().serverEmit("auth.error", {});
			await flush();
			latest().serverEmit("auth.error", {});

			expect(onSessionExpired).toHaveBeenCalledTimes(1);
		});

		it("allows a new refresh after a later successful connection", async () => {
			const refresh = vi.fn().mockResolvedValue("x");
			const { connection, latest } = createFakeConnection({ refresh });
			connection.acquire();

			latest().serverEmit("auth.error", {});
			await flush();
			latest().serverEmit("connected", { authenticated: true });
			latest().serverEmit("auth.error", {});
			await flush();

			expect(refresh).toHaveBeenCalledTimes(2);
		});
	});

	describe("Trip rooms", () => {
		it("counts a Trip room as joined only after the server acks it", async () => {
			const { connection, latest } = createFakeConnection();
			connection.acquire();
			latest().serverEmit("connected", { authenticated: true });

			connection.subscribeTrip(TRIP_ID);
			expect(connection.getSnapshot().tripRooms[TRIP_ID]).toBe("pending");
			await flush();

			expect(connection.getSnapshot().tripRooms[TRIP_ID]).toBe("joined");
			expect(latest().emitted).toContainEqual({
				event: "trip.subscribe",
				payload: { tripId: TRIP_ID },
			});
		});

		it("marks a Trip room refused when the server denies it", async () => {
			const { connection, latest } = createFakeConnection();
			connection.acquire();
			latest().tripAck = async () => ({ ok: false, error: "NOT_TRIP_MEMBER" });
			latest().serverEmit("connected", { authenticated: true });

			connection.subscribeTrip(TRIP_ID);
			await flush();

			expect(connection.getSnapshot().tripRooms[TRIP_ID]).toBe("refused");
		});

		it("waits for authentication before requesting a Trip room", async () => {
			const { connection, latest } = createFakeConnection();
			connection.acquire();

			connection.subscribeTrip(TRIP_ID);
			await flush();
			expect(latest().emitted).toHaveLength(0);

			latest().serverEmit("connected", { authenticated: true });
			await flush();
			expect(connection.getSnapshot().tripRooms[TRIP_ID]).toBe("joined");
		});

		it("drops Trip membership on disconnect and re-requests it after reconnect", async () => {
			const { connection, latest } = createFakeConnection();
			connection.acquire();
			latest().serverEmit("connected", { authenticated: true });
			connection.subscribeTrip(TRIP_ID);
			await flush();

			latest().serverEmit("disconnect", "transport close");
			expect(connection.getSnapshot().tripRooms[TRIP_ID]).toBe("pending");

			latest().serverEmit("connected", { authenticated: true });
			await flush();
			expect(latest().emitted.filter((entry) => entry.event === "trip.subscribe")).toHaveLength(2);
			expect(connection.getSnapshot().tripRooms[TRIP_ID]).toBe("joined");
		});

		it("keeps a shared Trip room until its last subscriber leaves, then unsubscribes", async () => {
			const { connection, latest } = createFakeConnection();
			connection.acquire();
			latest().serverEmit("connected", { authenticated: true });
			const leaveA = connection.subscribeTrip(TRIP_ID);
			const leaveB = connection.subscribeTrip(TRIP_ID);
			await flush();
			expect(latest().emitted.filter((entry) => entry.event === "trip.subscribe")).toHaveLength(1);

			leaveA();
			expect(connection.getSnapshot().tripRooms[TRIP_ID]).toBe("joined");
			leaveB();

			expect(connection.getSnapshot().tripRooms[TRIP_ID]).toBeUndefined();
			expect(latest().emitted).toContainEqual({
				event: "trip.unsubscribe",
				payload: { tripId: TRIP_ID },
			});
		});

		it("ignores a late ack that arrives after the connection was lost", async () => {
			const { connection, latest } = createFakeConnection();
			connection.acquire();
			let resolveAck: (value: unknown) => void = () => undefined;
			latest().tripAck = () =>
				new Promise((resolve) => {
					resolveAck = resolve;
				});
			latest().serverEmit("connected", { authenticated: true });
			connection.subscribeTrip(TRIP_ID);

			latest().serverEmit("disconnect", "transport close");
			resolveAck({ ok: true, room: `trip:${TRIP_ID}` });
			await flush();

			expect(connection.getSnapshot().tripRooms[TRIP_ID]).toBe("pending");
		});
	});

	it("dispatches server events to registered handlers until they unsubscribe", () => {
		const { connection, latest } = createFakeConnection();
		connection.acquire();
		const handler = vi.fn();
		const off = connection.on("sos.created", handler);

		latest().serverEmit("sos.created", { sosId: "s1" });
		off();
		latest().serverEmit("sos.created", { sosId: "s2" });

		expect(handler).toHaveBeenCalledTimes(1);
		expect(handler).toHaveBeenCalledWith({ sosId: "s1" });
	});
});

describe("automatic reconnect and missed-event recovery (CTMS-082-T02, BR-263)", () => {
	const meta = (eventId: string, sequence: number) => ({
		eventId,
		sequence,
		emittedAt: "2026-11-11T00:00:00.000Z",
	});

	it("applies the server's bounded backoff to socket.io", () => {
		const { connection, latest } = createFakeConnection();
		connection.acquire();
		latest().serverEmit("connected", {
			authenticated: true,
			latestSequence: 3,
			reconnect: { initialDelayMs: 2000, maxDelayMs: 20000, multiplier: 2, jitterRatio: 0.1 },
		});

		expect(latest().io.reconnectionDelay).toHaveBeenCalledWith(2000);
		expect(latest().io.reconnectionDelayMax).toHaveBeenCalledWith(20000);
		expect(latest().io.randomizationFactor).toHaveBeenCalledWith(0.1);
	});

	it("ignores an invalid policy and never sets a cap below the first delay", () => {
		const { connection, latest } = createFakeConnection();
		connection.acquire();
		latest().serverEmit("connected", {
			authenticated: true,
			reconnect: { initialDelayMs: 5000, maxDelayMs: 1000, jitterRatio: 4 },
		});

		expect(latest().io.reconnectionDelayMax).toHaveBeenCalledWith(5000);
		expect(latest().io.randomizationFactor).not.toHaveBeenCalled();
	});

	it("does not ask for missed events on the first connection", async () => {
		const { connection, latest } = createFakeConnection();
		connection.acquire();
		latest().serverEmit("connected", { authenticated: true, latestSequence: 10 });
		await flush();

		expect(latest().emitted.map((frame) => frame.event)).not.toContain("realtime.resume");
		expect(connection.getSnapshot().recovery).toBe("idle");
	});

	it("resumes from the last cursor it saw and replays missed events in order with their meta", async () => {
		const { connection, latest } = createFakeConnection();
		connection.acquire();
		const handler = vi.fn();
		connection.on("trip.incident.reported", handler);
		latest().serverEmit("connected", { authenticated: true, latestSequence: 10 });
		latest().serverEmit("trip.incident.reported", { incidentId: "live" }, meta("e-12", 12));
		latest().resumeAck = async () => ({
			ok: true,
			events: [
				{ event: "trip.incident.reported", payload: { incidentId: "b" }, meta: meta("e-15", 15) },
				{ event: "trip.incident.reported", payload: { incidentId: "a" }, meta: meta("e-14", 14) },
			],
			latestSequence: 16,
			truncated: false,
		});

		latest().serverEmit("disconnect", "transport close");
		latest().serverEmit("connected", { authenticated: true, latestSequence: 16 });
		expect(connection.getSnapshot().recovery).toBe("recovering");
		await flush();

		expect(latest().emitted).toContainEqual({
			event: "realtime.resume",
			payload: { afterSequence: 12 },
		});
		expect(handler.mock.calls.map(([payload]) => payload.incidentId)).toEqual(["live", "a", "b"]);
		expect(handler).toHaveBeenLastCalledWith({ incidentId: "b" }, meta("e-15", 15));
		expect(connection.getSnapshot()).toMatchObject({ state: "connected", recovery: "recovered" });

		// The next reconnect starts after everything already delivered.
		latest().serverEmit("disconnect", "transport close");
		latest().serverEmit("connected", { authenticated: true, latestSequence: 16 });
		await flush();
		expect(latest().emitted.at(-1)).toEqual({
			event: "realtime.resume",
			payload: { afterSequence: 16 },
		});
	});

	it("delivers an event once when it arrives both live and recovered", async () => {
		const { connection, latest } = createFakeConnection();
		connection.acquire();
		const handler = vi.fn();
		connection.on("emergency.broadcast", handler);
		latest().serverEmit("connected", { authenticated: true, latestSequence: 1 });
		latest().serverEmit("disconnect", "transport close");
		latest().resumeAck = async () => ({
			ok: true,
			events: [{ event: "emergency.broadcast", payload: { content: "x" }, meta: meta("same", 2) }],
			latestSequence: 2,
			truncated: false,
		});
		latest().serverEmit("connected", { authenticated: true, latestSequence: 2 });
		// The live copy reaches the new socket before the resume ack.
		latest().serverEmit("emergency.broadcast", { content: "x" }, meta("same", 2));
		await flush();
		latest().serverEmit("emergency.broadcast", { content: "x" }, meta("same", 2));

		expect(handler).toHaveBeenCalledTimes(1);
	});

	it.each([
		[
			"the server flags the recovery as truncated",
			async () => ({ ok: true, events: [], latestSequence: 99, truncated: true }),
		],
		["the server refuses the resume", async () => ({ ok: false, error: "NOT_AUTHENTICATED" })],
		["the resume ack never arrives", () => Promise.reject(new Error("timeout"))],
	])("reports recovery failed when %s, while the epoch still reloads lists", async (_case, ack) => {
		const { connection, latest } = createFakeConnection();
		connection.acquire();
		latest().serverEmit("connected", { authenticated: true, latestSequence: 5 });
		latest().serverEmit("disconnect", "transport close");
		latest().resumeAck = ack;
		latest().serverEmit("connected", { authenticated: true, latestSequence: 99 });
		await flush();

		expect(connection.getSnapshot()).toMatchObject({
			state: "connected",
			epoch: 2,
			recovery: "failed",
		});
	});

	it("reports recovery failed when there was no cursor to resume from", () => {
		const { connection, latest } = createFakeConnection();
		connection.acquire();
		latest().serverEmit("connected", { authenticated: true, latestSequence: null });
		latest().serverEmit("disconnect", "transport close");
		latest().serverEmit("connected", { authenticated: true, latestSequence: 4 });

		expect(connection.getSnapshot().recovery).toBe("failed");
		expect(latest().emitted.map((frame) => frame.event)).not.toContain("realtime.resume");
	});

	it("still re-requests Trip rooms on reconnect and clears the recovery state when offline", async () => {
		const { connection, latest } = createFakeConnection();
		connection.acquire();
		connection.subscribeTrip(TRIP_ID);
		latest().serverEmit("connected", { authenticated: true, latestSequence: 1 });
		await flush();
		latest().serverEmit("disconnect", "transport close");
		expect(connection.getSnapshot()).toMatchObject({ state: "reconnecting", recovery: "idle" });

		latest().serverEmit("connected", { authenticated: true, latestSequence: 1 });
		await flush();
		const frames = latest().emitted.map((frame) => frame.event);
		expect(frames.filter((event) => event === "trip.subscribe")).toHaveLength(2);
		expect(frames).toContain("realtime.resume");
		expect(connection.getSnapshot().tripRooms[TRIP_ID]).toBe("joined");
	});

	it("ignores a late resume ack from a socket that was closed", async () => {
		const { connection, latest } = createFakeConnection();
		const release = connection.acquire();
		const handler = vi.fn();
		connection.on("sos.created", handler);
		latest().serverEmit("connected", { authenticated: true, latestSequence: 1 });
		latest().serverEmit("disconnect", "transport close");
		let answer: (value: unknown) => void = () => {};
		latest().resumeAck = () =>
			new Promise((resolve) => {
				answer = resolve;
			});
		latest().serverEmit("connected", { authenticated: true, latestSequence: 2 });
		release();
		vi.runAllTimers();
		answer({
			ok: true,
			events: [{ event: "sos.created", payload: { sosId: "s" }, meta: meta("late", 2) }],
			latestSequence: 2,
			truncated: false,
		});
		await flush();

		expect(handler).not.toHaveBeenCalled();
		expect(connection.getSnapshot().state).toBe("idle");
	});
});
