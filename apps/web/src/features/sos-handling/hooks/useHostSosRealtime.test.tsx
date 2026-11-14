import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import { type ReactNode, StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeConnection } from "../../../core/realtime/fakeRealtimeSocket.test-utils";
import type { RealtimeConnection } from "../../../core/realtime/realtimeConnection";
import {
	SOS_RECOVERED_DISPLAY_MS,
	type SosCreatedEvent,
	resetSosRealtimeDedupe,
	useHostSosRealtime,
} from "./useHostSosRealtime";

const mocks = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock("../../../shared/components/Toast", () => ({ toast: { error: mocks.toastError } }));

const createdEvent: SosCreatedEvent = {
	eventId: "sos-1",
	sosId: "sos-1",
	tripId: "abcdef12-3456-4789-8abc-def012345678",
	senderId: "camper-1",
	emergencyType: "injury",
	status: "active",
	eventTime: "2026-11-03T01:00:00.000Z",
	persistedAt: "2026-11-03T01:00:01.000Z",
};

let queryClient: QueryClient;
let invalidate: ReturnType<typeof vi.fn>;
let fake: ReturnType<typeof createFakeConnection>;

function wrapper({ children }: { children: ReactNode }) {
	return (
		<StrictMode>
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		</StrictMode>
	);
}

function render(connection: RealtimeConnection = fake.connection, enabled = true) {
	return renderHook(() => useHostSosRealtime({ enabled, connection }), { wrapper });
}

function server(event: string, payload?: unknown) {
	act(() => fake.latest().serverEmit(event, payload));
}

function invalidatedKeys(): unknown[] {
	return invalidate.mock.calls.map(
		(call: unknown[]) => (call[0] as { queryKey: unknown }).queryKey
	);
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.clearAllMocks();
	resetSosRealtimeDedupe();
	localStorage.setItem("accessToken", "access-1");
	queryClient = new QueryClient();
	invalidate = vi.fn().mockResolvedValue(undefined);
	queryClient.invalidateQueries = invalidate as unknown as QueryClient["invalidateQueries"];
	fake = createFakeConnection();
});

afterEach(() => {
	cleanup();
	localStorage.clear();
	vi.useRealTimers();
});

describe("useHostSosRealtime (CTMS-079-T02 on the shared CTMS-078 connection)", () => {
	it("uses the single shared authenticated socket", () => {
		render();
		render();

		expect(fake.sockets).toHaveLength(1);
	});

	it("reports live only after the server confirms the socket is authenticated", () => {
		const { result } = render();
		expect(result.current).toBe("connecting");

		server("connected", { authenticated: true, rooms: ["user:h1", "role:host"] });

		expect(result.current).toBe("live");
	});

	it("never claims real-time delivery for an anonymous socket", () => {
		const { result } = render();

		server("connected", { authenticated: false });

		expect(result.current).toBe("disconnected");
	});

	it("reloads the authoritative SOS lists and raises one attention toast per new SOS", () => {
		render();
		server("connected", { authenticated: true });
		invalidate.mockClear();

		server("sos.created", createdEvent);

		expect(invalidatedKeys()).toEqual([["sos", "host-list"], ["host-overview"]]);
		expect(mocks.toastError).toHaveBeenCalledTimes(1);
		expect(mocks.toastError).toHaveBeenCalledWith("Chấn thương", "Yêu cầu cứu trợ khẩn cấp");
	});

	it("dedupes a repeated delivery of the same SOS event", () => {
		render();
		server("connected", { authenticated: true });
		invalidate.mockClear();

		server("sos.created", createdEvent);
		server("sos.created", { ...createdEvent });

		expect(mocks.toastError).toHaveBeenCalledTimes(1);
		expect(invalidate).toHaveBeenCalledTimes(2);
	});

	it("does not re-alert an already announced SOS after the layout remounts", () => {
		const first = render();
		server("sos.created", createdEvent);
		first.unmount();

		render();
		server("sos.created", createdEvent);

		expect(mocks.toastError).toHaveBeenCalledTimes(1);
	});

	it("ignores malformed payloads instead of fabricating an SOS", () => {
		render();
		invalidate.mockClear();

		server("sos.created", undefined);
		server("sos.created", { tripId: "trip" });

		expect(mocks.toastError).not.toHaveBeenCalled();
		expect(invalidate).not.toHaveBeenCalled();
	});

	it("reloads lists on SOS state changes without raising a new alert", () => {
		render();
		invalidate.mockClear();

		server("sos.state_changed", { sosId: "sos-1", tripId: "trip", status: "acknowledged" });
		server("sos.state_changed", { sosId: "sos-1", tripId: "trip", status: "acknowledged" });

		expect(invalidate).toHaveBeenCalledTimes(2);
		expect(mocks.toastError).not.toHaveBeenCalled();
	});

	it("shows reconnecting on connection loss, then recovered with a reload, then live", () => {
		const { result } = render();
		server("connected", { authenticated: true });

		server("disconnect", "transport close");
		expect(result.current).toBe("reconnecting");

		invalidate.mockClear();
		server("connected", { authenticated: true });
		expect(result.current).toBe("recovered");
		expect(invalidatedKeys()).toEqual([["sos", "host-list"], ["host-overview"]]);

		act(() => vi.advanceTimersByTime(SOS_RECOVERED_DISPLAY_MS));
		expect(result.current).toBe("live");
	});

	it("shows disconnected once socket.io gives up reconnecting", () => {
		const { result } = render();
		server("connected", { authenticated: true });

		act(() => fake.latest().managerEmit("reconnect_failed"));

		expect(result.current).toBe("disconnected");
	});

	it("shows auth_rejected while the session is being recovered", () => {
		const { result } = render();

		server("auth.error", { message: "Invalid or expired access token" });

		expect(result.current).toBe("auth_rejected");
	});

	it("opens no socket when disabled, and releases the shared socket on unmount", () => {
		render(fake.connection, false);
		expect(fake.sockets).toHaveLength(0);

		const { unmount } = render();
		unmount();
		act(() => vi.runAllTimers());

		expect(fake.latest().disconnect).toHaveBeenCalledTimes(1);
	});
});
