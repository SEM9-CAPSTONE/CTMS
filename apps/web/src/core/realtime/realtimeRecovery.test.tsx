import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	resetSosRealtimeDedupe,
	useHostSosRealtime,
} from "../../features/sos-handling/hooks/useHostSosRealtime";
import { useTripIncidentsRealtime } from "../../features/trip-incidents/hooks/useTripIncidentsRealtime";
import { useAdminTripReviewNotifications } from "../../features/trips/hooks/useTripReviewNotifications";
import {
	RealtimeConnectionStatus,
	realtimeDisplayState,
} from "../../shared/components/RealtimeConnectionStatus";
import { createFakeConnection } from "./fakeRealtimeSocket.test-utils";

vi.mock("../../shared/components/Toast", () => ({
	toast: { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

const TRIP_ID = "44444444-4444-4444-8444-444444444444";

let fake: ReturnType<typeof createFakeConnection>;

function wrapper({ children }: { children: ReactNode }) {
	return (
		<QueryClientProvider
			client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
		>
			{children}
		</QueryClientProvider>
	);
}

/** First connection, drop, then a reconnect whose resume the server truncates. */
async function reconnectWithFailedRecovery() {
	await act(async () => {
		fake.latest().serverEmit("connected", { authenticated: true, latestSequence: 5 });
		await Promise.resolve();
	});
	await act(async () => {
		fake.latest().serverEmit("disconnect", "transport close");
		fake.latest().resumeAck = async () => ({
			ok: true,
			events: [],
			latestSequence: 500,
			truncated: true,
		});
		fake.latest().serverEmit("connected", { authenticated: true, latestSequence: 500 });
		await Promise.resolve();
		await Promise.resolve();
	});
}

beforeEach(() => {
	localStorage.setItem("accessToken", "token");
	fake = createFakeConnection();
	resetSosRealtimeDedupe();
});

afterEach(() => {
	cleanup();
	localStorage.clear();
});

describe("reconnect states shown to the user (CTMS-082-T02)", () => {
	it.each([
		[{ state: "idle", recovery: "idle" }, "connecting"],
		[{ state: "connecting", recovery: "idle" }, "connecting"],
		[{ state: "connected", recovery: "idle" }, "connected"],
		[{ state: "connected", recovery: "recovered" }, "connected"],
		[{ state: "connected", recovery: "failed" }, "recovery_failed"],
		[{ state: "reconnecting", recovery: "idle" }, "reconnecting"],
		[{ state: "disconnected", recovery: "idle" }, "disconnected"],
		[{ state: "auth_rejected", recovery: "idle" }, "auth_rejected"],
	] as const)("maps %o to %s", (snapshot, expected) => {
		expect(realtimeDisplayState(snapshot)).toBe(expected);
	});

	it("explains a failed recovery with a warning badge", () => {
		render(<RealtimeConnectionStatus state="recovery_failed" />);
		const status = screen.getByTestId("realtime-connection-status");
		expect(status).toHaveAttribute("data-state", "recovery_failed");
		expect(status).toHaveTextContent("không lấy lại được hết cập nhật bị lỡ");
	});

	it("tells the Host when missed SOS could not all be replayed", async () => {
		const { result } = renderHook(
			() => useHostSosRealtime({ enabled: true, connection: fake.connection }),
			{ wrapper }
		);
		await reconnectWithFailedRecovery();
		expect(result.current).toBe("recovery_failed");
	});

	it("tells the Trip incident panel when missed events could not all be replayed", async () => {
		const { result } = renderHook(() =>
			useTripIncidentsRealtime(TRIP_ID, vi.fn(), fake.connection)
		);
		await reconnectWithFailedRecovery();
		await act(async () => {
			await Promise.resolve();
		});
		expect(result.current).toBe("recovery_failed");
	});

	it("tells the Admin review page when missed events could not all be replayed", async () => {
		const { result } = renderHook(() =>
			useAdminTripReviewNotifications({ connection: fake.connection })
		);
		expect(result.current).toBe("connecting");
		await reconnectWithFailedRecovery();
		expect(result.current).toBe("recovery_failed");
	});

	it("shows a recovered review event once even if it also arrives live", async () => {
		const onChanged = vi.fn();
		renderHook(() => useAdminTripReviewNotifications({ connection: fake.connection, onChanged }));
		await act(async () => {
			fake.latest().serverEmit("connected", { authenticated: true, latestSequence: 1 });
		});
		const event = { tripId: TRIP_ID, title: "T", hostId: "h", submittedAt: "s", deadlineAt: "d" };
		const meta = { eventId: "review-1", sequence: 2, emittedAt: "2026-11-11T00:00:00.000Z" };
		onChanged.mockClear();
		await act(async () => {
			fake.latest().serverEmit("disconnect", "transport close");
		});
		await act(async () => {
			fake.latest().resumeAck = async () => ({
				ok: true,
				events: [{ event: "trip.review.requested", payload: event, meta }],
				latestSequence: 2,
				truncated: false,
			});
			fake.latest().serverEmit("connected", { authenticated: true, latestSequence: 2 });
			await Promise.resolve();
			await Promise.resolve();
			fake.latest().serverEmit("trip.review.requested", event, meta);
		});

		// One reload for the reconnect itself and one for the single delivered review event.
		expect(onChanged).toHaveBeenCalledTimes(2);
	});
});
