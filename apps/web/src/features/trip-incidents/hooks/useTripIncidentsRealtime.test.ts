import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeConnection } from "../../../core/realtime/fakeRealtimeSocket.test-utils";
import { useTripIncidentsRealtime } from "./useTripIncidentsRealtime";

const TRIP_ID = "44444444-4444-4444-8444-444444444444";
const OTHER_TRIP = "55555555-5555-4555-8555-555555555555";

let fake: ReturnType<typeof createFakeConnection>;

async function server(event: string, payload?: unknown) {
	await act(async () => {
		fake.latest().serverEmit(event, payload);
		await Promise.resolve();
	});
}

beforeEach(() => {
	vi.useFakeTimers();
	localStorage.setItem("accessToken", "token");
	fake = createFakeConnection();
});

afterEach(() => {
	cleanup();
	localStorage.clear();
	vi.useRealTimers();
});

describe("useTripIncidentsRealtime (CTMS-078-T02)", () => {
	it("requests the Trip room and is live only after the server joins it", async () => {
		const reload = vi.fn();
		const { result } = renderHook(() => useTripIncidentsRealtime(TRIP_ID, reload, fake.connection));
		expect(result.current).toBe("connecting");

		await server("connected", { authenticated: true });

		expect(fake.latest().emitted).toContainEqual({
			event: "trip.subscribe",
			payload: { tripId: TRIP_ID },
		});
		expect(result.current).toBe("connected");
		expect(reload).toHaveBeenCalledTimes(1);
	});

	it("shows unauthorized and ignores events when the server refuses the room", async () => {
		const reload = vi.fn();
		const { result } = renderHook(() => useTripIncidentsRealtime(TRIP_ID, reload, fake.connection));
		fake.latest().tripAck = async () => ({ ok: false, error: "NOT_TRIP_MEMBER" });

		await server("connected", { authenticated: true });
		await server("trip.incident.reported", { tripId: TRIP_ID });

		expect(result.current).toBe("unauthorized");
		expect(reload).not.toHaveBeenCalled();
	});

	it("reloads the authoritative list for this Trip's incident events only", async () => {
		const reload = vi.fn();
		renderHook(() => useTripIncidentsRealtime(TRIP_ID, reload, fake.connection));
		await server("connected", { authenticated: true });
		reload.mockClear();

		await server("trip.incident.reported", { tripId: TRIP_ID });
		await server("trip.incident.updated", { tripId: TRIP_ID });
		await server("trip.incident.reported", { tripId: OTHER_TRIP });

		expect(reload).toHaveBeenCalledTimes(2);
	});

	it("rejoins and reloads after a reconnect, and is not live in between", async () => {
		const reload = vi.fn();
		const { result } = renderHook(() => useTripIncidentsRealtime(TRIP_ID, reload, fake.connection));
		await server("connected", { authenticated: true });
		reload.mockClear();

		await server("disconnect", "transport close");
		expect(result.current).toBe("reconnecting");

		await server("connected", { authenticated: true });
		expect(result.current).toBe("connected");
		expect(reload).toHaveBeenCalledTimes(1);
	});

	it("releases the Trip room on unmount", async () => {
		const { unmount } = renderHook(() =>
			useTripIncidentsRealtime(TRIP_ID, vi.fn(), fake.connection)
		);
		await server("connected", { authenticated: true });

		unmount();

		expect(fake.latest().emitted).toContainEqual({
			event: "trip.unsubscribe",
			payload: { tripId: TRIP_ID },
		});
	});
});
