import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, it, vi } from "vitest";
import { type NotificationItem, NotificationPanel } from "./NotificationPanel";
import { toast } from "./Toast";

vi.mock("./Toast", () => ({ toast: { error: vi.fn() } }));

const items: NotificationItem[] = [
	{
		id: "new",
		tripId: "trip-1",
		title: "Sơn Trà",
		description: "Người hỗ trợ cần xác nhận gói.",
		createdAt: "2026-11-14T01:00:00Z",
		unread: true,
		kind: "departure",
	},
	{
		id: "old",
		tripId: "trip-2",
		title: "Hải Vân",
		description: "Mai đã hủy đặt chỗ.",
		createdAt: "2026-11-13T01:00:00Z",
		unread: false,
		kind: "booking",
	},
];
it("opens a compact panel, filters unread and updates the count after all reads succeed", async () => {
	const read = vi.fn().mockResolvedValue(undefined);
	function Feed() {
		const [data, setData] = useState(items);
		return (
			<NotificationPanel
				items={data}
				loading={false}
				onRefresh={vi.fn()}
				onRead={async (item) => {
					await read(item.id);
					setData((current) =>
						current.map((value) => (value.id === item.id ? { ...value, unread: false } : value))
					);
				}}
			/>
		);
	}
	const user = userEvent.setup();
	render(<Feed />);
	expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	await user.click(screen.getByRole("button", { name: "Thông báo (1 chưa đọc)" }));
	expect(screen.getAllByText(/Nhận lúc/)).toHaveLength(2);
	await user.click(screen.getByRole("tab", { name: "Chưa đọc" }));
	expect(screen.queryByText("Hải Vân")).not.toBeInTheDocument();
	await user.click(screen.getByRole("button", { name: "Đánh dấu đã đọc tất cả" }));
	expect(await screen.findByText("Bạn đã đọc hết thông báo.")).toBeVisible();
	expect(read).toHaveBeenCalledExactlyOnceWith("new");
	expect(screen.getByRole("button", { name: "Thông báo (0 chưa đọc)" })).toBeVisible();
	await user.keyboard("{Escape}");
	expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
it("opens the selected Trip and marks only that notice read", () => {
	const read = vi.fn().mockResolvedValue(undefined);
	render(<NotificationPanel items={items} loading={false} onRefresh={vi.fn()} onRead={read} />);
	fireEvent.click(screen.getByRole("button", { name: "Thông báo (1 chưa đọc)" }));
	fireEvent.click(screen.getByRole("link", { name: /Sơn Trà/ }));
	expect(read).toHaveBeenCalledWith(items[0]);
	expect(window.location.pathname).toBe("/trips/trip-1");
});
it("keeps a failed read unread and offers a clear retry", async () => {
	const read = vi.fn().mockRejectedValue(new Error("offline"));
	render(<NotificationPanel items={items} loading={false} onRefresh={vi.fn()} onRead={read} />);
	fireEvent.click(screen.getByRole("button", { name: "Thông báo (1 chưa đọc)" }));
	fireEvent.click(screen.getByRole("button", { name: "Đánh dấu đã đọc tất cả" }));
	await waitFor(() =>
		expect(toast.error).toHaveBeenCalledWith(
			"Chưa đánh dấu được một số thông báo. Vui lòng thử lại."
		)
	);
	expect(screen.getByRole("button", { name: "Thông báo (1 chưa đọc)" })).toBeVisible();
});

it("keeps an individual notification unread when its read request fails", async () => {
	const read = vi.fn().mockRejectedValue(new Error("offline"));
	render(<NotificationPanel items={items} loading={false} onRefresh={vi.fn()} onRead={read} />);
	fireEvent.click(screen.getByRole("button", { name: "Thông báo (1 chưa đọc)" }));
	fireEvent.click(screen.getByRole("button", { name: "Đánh dấu đã đọc" }));
	await waitFor(() =>
		expect(toast.error).toHaveBeenCalledWith(
			"Chưa đánh dấu đã đọc. Thông báo vẫn được giữ là chưa đọc."
		)
	);
	expect(read).toHaveBeenCalledExactlyOnceWith(items[0]);
	expect(screen.getByRole("button", { name: "Đánh dấu đã đọc" })).toBeEnabled();
	expect(screen.getByRole("button", { name: "Thông báo (1 chưa đọc)" })).toHaveTextContent("1");
});

it("uses the authoritative count, caps its badge and hides zero", () => {
	const props = { items, loading: false, onRefresh: vi.fn(), onRead: vi.fn() };
	const { rerender } = render(<NotificationPanel {...props} unreadCount={140} />);
	expect(screen.getByRole("button", { name: "Thông báo (140 chưa đọc)" })).toHaveTextContent("99+");
	rerender(<NotificationPanel {...props} unreadCount={0} />);
	expect(screen.getByRole("button", { name: "Thông báo (0 chưa đọc)" })).not.toHaveTextContent("0");
});

it("offers a keyboard-accessible read action on every unread row without navigating", async () => {
	let finish: (() => void) | undefined;
	const read = vi.fn(
		() =>
			new Promise<void>((resolve) => {
				finish = resolve;
			})
	);
	render(<NotificationPanel items={items} loading={false} onRefresh={vi.fn()} onRead={read} />);
	fireEvent.click(screen.getByRole("button", { name: "Thông báo (1 chưa đọc)" }));
	const action = screen.getByRole("button", { name: "Đánh dấu đã đọc" });
	action.focus();
	await userEvent.keyboard("{Enter}");
	expect(read).toHaveBeenCalledExactlyOnceWith(items[0]);
	expect(screen.getByRole("dialog")).toBeVisible();
	expect(screen.getByRole("button", { name: "Thông báo (1 chưa đọc)" })).toBeVisible();
	finish?.();
});
