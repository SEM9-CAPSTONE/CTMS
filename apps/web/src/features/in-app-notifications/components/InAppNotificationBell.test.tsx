import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { InAppNotificationBell } from "./InAppNotificationBell";

const state = vi.hoisted(() => ({ failed: false, count: 23 as number | undefined }));
vi.mock("../hooks/useInAppNotifications", () => ({
	useInAppNotifications: () => ({
		list: { error: null, isPending: false, hasNextPage: false },
		count: {
			data: state.count === undefined ? undefined : { unreadCount: state.count },
			isError: state.failed,
			error: null,
		},
		items: [],
		refresh: vi.fn(),
		markRead: vi.fn(),
	}),
}));
const props = {
	legacyItems: [
		{
			id: "departure:one",
			tripId: "one",
			title: "Khám phá Sơn Trà",
			description: "Người hỗ trợ cần xác nhận gói.",
			createdAt: "2026-11-17T01:00:00Z",
			unread: true,
			kind: "departure" as const,
		},
	],
	legacyLoading: false,
	onLegacyRefresh: vi.fn(),
	onLegacyRead: vi.fn().mockResolvedValue(undefined),
};
beforeEach(() => {
	state.failed = false;
	state.count = 23;
});

it("retains the last server count after a failed refresh and reports its age", () => {
	const { rerender } = render(<InAppNotificationBell {...props} />);
	expect(screen.getByRole("button", { name: "Thông báo (24 chưa đọc)" })).toHaveTextContent("24");
	state.failed = true;
	rerender(<InAppNotificationBell {...props} />);
	expect(screen.getByRole("button", { name: /24 chưa đọc.*số gần nhất/ })).toHaveTextContent("24");
});

it("does not turn an unknown count into zero", () => {
	state.failed = true;
	state.count = undefined;
	render(<InAppNotificationBell {...props} />);
	expect(screen.getByRole("button", { name: /chưa tải được số chưa đọc/ })).not.toHaveTextContent(
		"0"
	);
});

it("filters legacy notices using their actual unread state", () => {
	render(<InAppNotificationBell {...props} />);
	fireEvent.click(screen.getByRole("button", { name: "Thông báo (24 chưa đọc)" }));
	fireEvent.click(screen.getByRole("tab", { name: "Hoạt động khác" }));
	fireEvent.click(screen.getByRole("tab", { name: "Chưa đọc" }));
	expect(screen.getByText("Khám phá Sơn Trà")).toBeVisible();
	expect(screen.getByRole("button", { name: "Đánh dấu đã đọc" })).toBeEnabled();
});
