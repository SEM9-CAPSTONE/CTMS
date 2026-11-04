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
