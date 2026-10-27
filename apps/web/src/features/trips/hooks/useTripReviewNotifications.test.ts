import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useAdminTripReviewNotifications } from "./useTripReviewNotifications";
const mocks = vi.hoisted(() => ({
	handlers: new Map<string, (payload?: unknown) => void>(),
	disconnect: vi.fn(),
	info: vi.fn(),
}));
vi.mock("socket.io-client", () => ({
	io: () => ({
		on: (event: string, handler: (payload?: unknown) => void) => {
			mocks.handlers.set(event, handler);
		},
		disconnect: mocks.disconnect,
	}),
}));
vi.mock("../../../shared/components", () => ({ toast: { info: mocks.info, warning: vi.fn() } }));
beforeEach(() => {
	vi.clearAllMocks();
	mocks.handlers.clear();
});
it("refreshes the admin review queue when the Host updates the pending Trip", () => {
	const refresh = vi.fn();
	const { unmount } = renderHook(() => useAdminTripReviewNotifications({ onChanged: refresh }));
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
	act(() => mocks.handlers.get("connect")?.());
	expect(refresh).toHaveBeenCalledTimes(1);
});
