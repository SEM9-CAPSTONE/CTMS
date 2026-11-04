import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import { type ReactNode, StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	SOS_RECOVERED_DISPLAY_MS,
	type SosCreatedEvent,
	resetSosRealtimeDedupe,
	useHostSosRealtime,
} from "./useHostSosRealtime";

type Handler = (payload?: unknown) => void;
type AuthCallback = (cb: (data: Record<string, unknown>) => void) => void;

const mocks = vi.hoisted(() => ({
	handlers: new Map<string, Handler>(),
	options: [] as Array<{ auth?: unknown; transports?: string[] }>,
	disconnect: vi.fn(),
	connect: vi.fn(),
	toastError: vi.fn(),
	refresh: vi.fn(),
}));

vi.mock("socket.io-client", () => ({
	io: (_url: string, options: { auth?: unknown; transports?: string[] }) => {
		mocks.options.push(options);
		return {
			on: (event: string, handler: Handler) => {
				mocks.handlers.set(event, handler);
			},
			connect: mocks.connect,
			disconnect: mocks.disconnect,
		};
	},
}));
vi.mock("../../../shared/components/Toast", () => ({ toast: { error: mocks.toastError } }));
vi.mock("../../../core/api/authRefresh", () => ({ refreshAccessToken: mocks.refresh }));

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

function wrapper({ children }: { children: ReactNode }) {
	return (
		<StrictMode>
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		</StrictMode>
	);
}

function emit(event: string, payload?: unknown) {
	act(() => mocks.handlers.get(event)?.(payload));
}

function renderConnected() {
	const view = renderHook(() => useHostSosRealtime(), { wrapper });
	act(() => vi.runOnlyPendingTimers());
	return view;
}

function invalidatedKeys(): unknown[] {
	return invalidate.mock.calls.map(
		(call: unknown[]) => (call[0] as { queryKey: unknown }).queryKey
	);
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.clearAllMocks();
	mocks.handlers.clear();
	mocks.options.length = 0;
	resetSosRealtimeDedupe();
	localStorage.setItem("accessToken", "access-1");
	queryClient = new QueryClient();
	invalidate = vi.fn().mockResolvedValue(undefined);
	queryClient.invalidateQueries = invalidate as unknown as QueryClient["invalidateQueries"];
});

afterEach(() => {
	cleanup();
	localStorage.clear();
	vi.useRealTimers();
});

describe("useHostSosRealtime (CTMS-079-T02)", () => {
	it("opens one authenticated socket that re-reads the current access token on every connect", () => {
		renderConnected();

		expect(mocks.options).toHaveLength(1);
		expect(mocks.options[0].transports).toEqual(["websocket"]);
		const auth = mocks.options[0].auth as AuthCallback;
		const first = vi.fn();
		auth(first);
		expect(first).toHaveBeenCalledWith({ token: "access-1" });

		localStorage.setItem("accessToken", "access-2");
		const second = vi.fn();
		auth(second);
		expect(second).toHaveBeenCalledWith({ token: "access-2" });
	});

	it("reports live only after the server confirms the socket is authenticated", () => {
		const { result } = renderConnected();
		expect(result.current).toBe("connecting");

		emit("connected", { authenticated: true });

		expect(result.current).toBe("live");
	});

	it("never claims real-time delivery for an anonymous socket", () => {
		const { result } = renderConnected();

		emit("connected", { authenticated: false });

		expect(result.current).toBe("disconnected");
	});

	it("reloads the authoritative SOS lists and raises one attention toast per new SOS", () => {
		renderConnected();
		emit("connected", { authenticated: true });
		invalidate.mockClear();

		emit("sos.created", createdEvent);

		expect(invalidatedKeys()).toEqual([["sos", "host-list"], ["host-overview"]]);
		expect(mocks.toastError).toHaveBeenCalledTimes(1);
		expect(mocks.toastError).toHaveBeenCalledWith(
			"Chấn thương · Mã chuyến: abcdef12",
			"Yêu cầu cứu trợ khẩn cấp"
		);
	});

	it("dedupes a repeated delivery of the same SOS event", () => {
		renderConnected();
		emit("connected", { authenticated: true });
		invalidate.mockClear();

		emit("sos.created", createdEvent);
		emit("sos.created", { ...createdEvent });

		expect(mocks.toastError).toHaveBeenCalledTimes(1);
		expect(invalidate).toHaveBeenCalledTimes(2);
	});

	it("does not re-alert an already announced SOS after the layout remounts", () => {
		const first = renderConnected();
		emit("sos.created", createdEvent);
		first.unmount();

		renderConnected();
		emit("sos.created", createdEvent);

		expect(mocks.toastError).toHaveBeenCalledTimes(1);
	});

	it("ignores malformed payloads instead of fabricating an SOS", () => {
		renderConnected();
		invalidate.mockClear();

		emit("sos.created", undefined);
		emit("sos.created", { tripId: "trip" });

		expect(mocks.toastError).not.toHaveBeenCalled();
		expect(invalidate).not.toHaveBeenCalled();
	});

	it("reloads lists on SOS state changes without raising a new alert", () => {
		renderConnected();
		invalidate.mockClear();

		emit("sos.state_changed", { sosId: "sos-1", tripId: "trip", status: "acknowledged" });
		emit("sos.state_changed", { sosId: "sos-1", tripId: "trip", status: "acknowledged" });

		expect(invalidate).toHaveBeenCalledTimes(2);
		expect(mocks.toastError).not.toHaveBeenCalled();
	});

	it("shows disconnected on connection loss, then recovered with a reload, then live", () => {
		const { result } = renderConnected();
		emit("connected", { authenticated: true });

		emit("disconnect");
		expect(result.current).toBe("disconnected");

		invalidate.mockClear();
		emit("connected", { authenticated: true });
		expect(result.current).toBe("recovered");
		expect(invalidatedKeys()).toEqual([["sos", "host-list"], ["host-overview"]]);

		act(() => vi.advanceTimersByTime(SOS_RECOVERED_DISPLAY_MS));
		expect(result.current).toBe("live");
	});

	it("shows disconnected when the connection cannot be established", () => {
		const { result } = renderConnected();

		emit("connect_error", new Error("offline"));

		expect(result.current).toBe("disconnected");
	});

	it("refreshes the access token once on auth.error and reconnects", async () => {
		mocks.refresh.mockResolvedValue("access-2");
		renderConnected();

		emit("auth.error", { message: "Invalid or expired access token" });
		emit("auth.error", { message: "Invalid or expired access token" });
		await act(async () => {
			await Promise.resolve();
		});

		expect(mocks.refresh).toHaveBeenCalledTimes(1);
		expect(mocks.connect).toHaveBeenCalledTimes(1);
	});

	it("stays disconnected when the session cannot be refreshed", async () => {
		mocks.refresh.mockRejectedValue(new Error("refresh failed"));
		const { result } = renderConnected();

		emit("auth.error", { message: "Invalid or expired access token" });
		await act(async () => {
			await Promise.resolve();
		});

		expect(mocks.connect).not.toHaveBeenCalled();
		expect(result.current).toBe("disconnected");
	});

	it("opens no socket when disabled, and closes its socket on unmount", () => {
		renderHook(() => useHostSosRealtime({ enabled: false }), { wrapper });
		act(() => vi.runOnlyPendingTimers());
		expect(mocks.options).toHaveLength(0);

		const { unmount } = renderConnected();
		unmount();
		expect(mocks.disconnect).toHaveBeenCalledTimes(1);
	});
});
