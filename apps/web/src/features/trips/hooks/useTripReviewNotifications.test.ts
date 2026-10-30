import { act, cleanup, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
	useAdminTripReviewNotifications,
	useHostTripReviewNotifications,
} from "./useTripReviewNotifications";
const mocks = vi.hoisted(() => ({
	handlers: new Map<string, (payload?: unknown) => void>(),
	disconnect: vi.fn(),
	info: vi.fn(),
	connections: vi.fn(),
}));
vi.mock("socket.io-client", () => ({
	io: () => {
		mocks.connections();
		return {
			on: (event: string, handler: (payload?: unknown) => void) => {
				mocks.handlers.set(event, handler);
			},
			disconnect: mocks.disconnect,
		};
	},
}));
vi.mock("../../../shared/components", () => ({ toast: { info: mocks.info, warning: vi.fn() } }));
beforeEach(() => {
	vi.useFakeTimers();
	vi.clearAllMocks();
	mocks.handlers.clear();
});
afterEach(() => {
	cleanup();
	vi.useRealTimers();
});
it("refreshes the admin review queue when the Host updates the pending Trip", () => {
	const refresh = vi.fn();
	const { unmount } = renderHook(() => useAdminTripReviewNotifications({ onChanged: refresh }));
	act(() => vi.runOnlyPendingTimers());
	act(() =>
		mocks.handlers.get("trip.review.updated")?.({
			tripId: "trip",
			title: "Latest",
			updatedAt: "2026-10-27T00:00:00.000Z",
		})
	);
	expect(refresh).toHaveBeenCalledTimes(1);
	expect(mocks.info).toHaveBeenCalled();
	unmount();
	expect(mocks.disconnect).toHaveBeenCalledTimes(1);
});
it("refreshes on reconnect to recover events missed while offline", () => {
	const refresh = vi.fn();
	renderHook(() => useAdminTripReviewNotifications({ onChanged: refresh }));
	act(() => vi.runOnlyPendingTimers());
	act(() => mocks.handlers.get("connect")?.());
	expect(refresh).toHaveBeenCalledTimes(1);
});

it.each([useAdminTripReviewNotifications, useHostTripReviewNotifications])(
	"keeps its socket across callback changes and uses the latest callback",
	(useNotifications) => {
		const first = vi.fn();
		const latest = vi.fn();
		const { rerender, unmount } = renderHook(({ onChanged }) => useNotifications({ onChanged }), {
			initialProps: { onChanged: first },
			wrapper: StrictMode,
		});
		act(() => vi.runOnlyPendingTimers());
		expect(mocks.connections).toHaveBeenCalledOnce();
		rerender({ onChanged: latest });
		act(() => vi.runOnlyPendingTimers());
		expect(mocks.connections).toHaveBeenCalledOnce();
		expect(mocks.disconnect).not.toHaveBeenCalled();
		const event =
			useNotifications === useAdminTripReviewNotifications
				? "connect"
				: "trip.review.auto_rejected";
		act(() => mocks.handlers.get(event)?.({ tripId: "trip", title: "Latest" }));
		expect(first).not.toHaveBeenCalled();
		expect(latest).toHaveBeenCalledOnce();
		unmount();
		expect(mocks.disconnect).toHaveBeenCalledOnce();
	}
);
