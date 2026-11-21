import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { packagePolicyService } from "../services/package-policy.service";
import { HostNotifications } from "./HostNotifications";

vi.mock("../../in-app-notifications/hooks/useInAppNotifications", () => ({
	useInAppNotifications: () => ({
		list: { isPending: false },
		count: { data: { unreadCount: 0 } },
		items: [],
		refresh: vi.fn(),
	}),
}));
vi.mock("../../booking-cancellation/hooks/useBookingCancellationNotices", () => ({
	useBookingCancellationNotices: () => ({
		query: {
			data: [
				{
					id: "booking",
					tripId: "booked-trip",
					tripTitle: "Hải Vân",
					camperName: "Mai",
					reason: "Bận việc",
					createdAt: "2026-11-13T00:00:00Z",
					readAt: null,
				},
			],
			refetch: vi.fn(),
		},
		markRead: { mutateAsync: vi.fn().mockResolvedValue(undefined) },
		unread: 1,
	}),
}));
vi.mock("../services/package-policy.service", () => ({
	packagePolicyService: { list: vi.fn(), read: vi.fn() },
}));

it("uses one bell for booking and departure notices without a standalone banner", async () => {
	HTMLDialogElement.prototype.showModal = function () {
		this.setAttribute("open", "");
	};
	vi.mocked(packagePolicyService.list).mockResolvedValue([
		{
			id: "notice",
			tripId: "trip",
			reasonCode: "SOURCE_FRESHNESS_UNAVAILABLE",
			createdAt: "2026-11-12T00:00:00Z",
			readAt: null,
			active: true,
			tripTitle: "Chuyến Sơn Trà",
		},
	]);
	render(
		<QueryClientProvider client={new QueryClient()}>
			<HostNotifications actor="host" />
		</QueryClientProvider>
	);
	const bell = await screen.findByRole("button", { name: "Thông báo (2 chưa đọc)" });
	expect(screen.queryByRole("button", { name: /Thông báo khởi hành/ })).not.toBeInTheDocument();
	expect(screen.queryByText("Chuyến Sơn Trà")).not.toBeInTheDocument();
	fireEvent.click(bell);
	fireEvent.click(screen.getByRole("tab", { name: "Hoạt động khác" }));
	expect(await screen.findByText("Chuyến Sơn Trà")).toBeVisible();
	expect(screen.getByRole("button", { name: "Đọc các mục đã tải" })).toBeVisible();
	expect(screen.getByText("Mai đã hủy đặt chỗ")).toBeVisible();
});
