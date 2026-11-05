import { act, cleanup, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createFakeConnection } from "../../../core/realtime/fakeRealtimeSocket.test-utils";
import {
	useAdminTripReviewNotifications,
	useHostTripReviewNotifications,
} from "./useTripReviewNotifications";

const mocks = vi.hoisted(() => ({ info: vi.fn(), warning: vi.fn() }));
vi.mock("../../../shared/components", () => ({
	toast: { info: mocks.info, warning: mocks.warning },
}));

let fake: ReturnType<typeof createFakeConnection>;

function server(event: string, payload?: unknown) {
	act(() => fake.latest().serverEmit(event, payload));
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.clearAllMocks();
	localStorage.setItem("accessToken", "admin-token");
	fake = createFakeConnection();
});

afterEach(() => {
	cleanup();
	localStorage.clear();
	vi.useRealTimers();
});

it("connects with the session token (CTMS-078: review events are role-scoped)", () => {
	renderHook(() => useAdminTripReviewNotifications({ connection: fake.connection }));

	expect(fake.sockets).toHaveLength(1);
	expect(fake.latest().getToken()).toBe("admin-token");
});

it("refreshes the admin review queue when the Host updates the pending Trip", () => {
	const refresh = vi.fn();
	const { unmount } = renderHook(() =>
		useAdminTripReviewNotifications({ onChanged: refresh, connection: fake.connection })
	);
	server("trip.review.updated", {
		tripId: "trip",
		title: "Latest",
		updatedAt: "2026-10-27T00:00:00.000Z",
	});
	expect(refresh).toHaveBeenCalledTimes(1);
	expect(mocks.info).toHaveBeenCalledWith(
		'Trip "Latest" vừa được Host cập nhật.',
		"Bản cập nhật chờ duyệt"
	);
	unmount();
	act(() => vi.runAllTimers());
	expect(fake.latest().disconnect).toHaveBeenCalledTimes(1);
});

it("notifies the admin of new and overdue review requests", () => {
	renderHook(() => useAdminTripReviewNotifications({ connection: fake.connection }));

	server("trip.review.requested", { tripId: "t", title: "Mới" });
	server("trip.review.reminder", { tripId: "t", title: "Sắp hạn" });

	expect(mocks.info).toHaveBeenCalledWith(
		'Trip "Mới" vừa được gửi chờ duyệt.',
		"Trip mới cần duyệt"
	);
	expect(mocks.warning).toHaveBeenCalledWith(
		'Trip "Sắp hạn" sắp quá hạn duyệt 24 giờ.',
		"Nhắc duyệt Trip"
	);
});

it("refreshes on every authenticated (re)connect to recover events missed while offline", () => {
	const refresh = vi.fn();
	const { result } = renderHook(() =>
		useAdminTripReviewNotifications({ onChanged: refresh, connection: fake.connection })
	);
	expect(result.current).toBe("connecting");

	server("connected", { authenticated: true, rooms: ["user:a", "role:admin"] });
	expect(result.current).toBe("connected");
	server("disconnect", "transport close");
	expect(result.current).toBe("reconnecting");
	server("connected", { authenticated: true, rooms: ["user:a", "role:admin"] });

	expect(refresh).toHaveBeenCalledTimes(2);
});

it("does not refresh for an anonymous connection", () => {
	const refresh = vi.fn();
	const { result } = renderHook(() =>
		useAdminTripReviewNotifications({ onChanged: refresh, connection: fake.connection })
	);

	server("connected", { authenticated: false });

	expect(result.current).toBe("disconnected");
	expect(refresh).not.toHaveBeenCalled();
});

it("tells the Host about an automatic rejection", () => {
	const refresh = vi.fn();
	renderHook(() =>
		useHostTripReviewNotifications({ onChanged: refresh, connection: fake.connection })
	);

	server("trip.review.auto_rejected", { tripId: "t", title: "Quá hạn" });

	expect(mocks.warning).toHaveBeenCalledWith(
		'Trip "Quá hạn" đã bị từ chối tự động vì quá 24 giờ chưa được duyệt.',
		"Trip bị từ chối"
	);
	expect(refresh).toHaveBeenCalledTimes(1);
});

it.each([useAdminTripReviewNotifications, useHostTripReviewNotifications])(
	"keeps its socket across callback changes and uses the latest callback",
	(useNotifications) => {
		const first = vi.fn();
		const latest = vi.fn();
		const { rerender, unmount } = renderHook(
			({ onChanged }) => useNotifications({ onChanged, connection: fake.connection }),
			{ initialProps: { onChanged: first }, wrapper: StrictMode }
		);
		act(() => vi.runAllTimers());
		expect(fake.sockets).toHaveLength(1);
		rerender({ onChanged: latest });
		act(() => vi.runAllTimers());
		expect(fake.sockets).toHaveLength(1);
		expect(fake.latest().disconnect).not.toHaveBeenCalled();

		server("connected", { authenticated: true });

		expect(first).not.toHaveBeenCalled();
		expect(latest).toHaveBeenCalledOnce();
		unmount();
		act(() => vi.runAllTimers());
		expect(fake.latest().disconnect).toHaveBeenCalledOnce();
	}
);
