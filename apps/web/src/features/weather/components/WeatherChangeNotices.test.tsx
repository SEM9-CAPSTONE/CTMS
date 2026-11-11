import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createFakeConnection } from "../../../core/realtime/fakeRealtimeSocket.test-utils";
import {
	type WeatherChangeNotice,
	weatherChangeNoticesService,
} from "../services/weather-change-notices.service";
import { WeatherChangeNotices } from "./WeatherChangeNotices";

vi.mock("../../auth/utils/tokenStorage", () => ({ getStoredAuthUser: () => ({ id: "camper" }) }));

beforeEach(() => {
	localStorage.setItem("accessToken", "test-token");
	HTMLDialogElement.prototype.showModal = function () {
		this.setAttribute("open", "");
	};
	HTMLDialogElement.prototype.close = function () {
		this.removeAttribute("open");
	};
});
afterEach(() => {
	cleanup();
	localStorage.removeItem("accessToken");
	vi.restoreAllMocks();
});

const worse: WeatherChangeNotice = {
	id: "n-1",
	tripId: "trip-1",
	forecastId: "f-2",
	tripTitle: "Tà Năng – Phan Dũng",
	tripStartsAt: "2030-01-17T00:00:00Z",
	previousRiskLevel: "green",
	riskLevel: "red",
	worsened: true,
	message: "Cảnh báo sớm: dự báo ngày 17/01 xấu đi (Xanh → Đỏ), đang theo dõi.",
	readAt: null,
	createdAt: "2030-01-05T03:00:00Z",
};
const better: WeatherChangeNotice = {
	...worse,
	id: "n-2",
	forecastId: "f-3",
	previousRiskLevel: "red",
	riskLevel: "yellow",
	worsened: false,
	message: "Dự báo ngày 17/01 đã cải thiện (Đỏ → Vàng).",
	readAt: "2030-01-06T00:00:00Z",
};

function openInbox() {
	fireEvent.click(screen.getByRole("button", { name: /Thông báo thời tiết/ }));
}

it("lists level changes with the server message, levels and Trip link, worse ones highlighted", async () => {
	vi.spyOn(weatherChangeNoticesService, "list").mockResolvedValue({
		items: [worse, better],
		unreadCount: 1,
	});
	render(<WeatherChangeNotices connection={createFakeConnection().connection} />);
	expect(
		await screen.findByRole("button", { name: "Thông báo thời tiết (1 chưa đọc)" })
	).toBeVisible();
	openInbox();
	expect(await screen.findByText(worse.message)).toBeVisible();
	expect(screen.getByText(better.message)).toBeVisible();
	const [first, second] = screen.getAllByTestId("weather-change-notice");
	expect(first).toHaveAttribute("data-worsened", "true");
	expect(first).toHaveClass("bg-amber-50");
	expect(second).toHaveClass("bg-emerald-50");
	expect(screen.getAllByRole("link", { name: worse.tripTitle })[0]).toHaveAttribute(
		"href",
		"/trips/trip-1"
	);
	expect(screen.getAllByText("Nguy hiểm (Đỏ)").length).toBeGreaterThan(0);
	expect(screen.getAllByRole("button", { name: "Đánh dấu đã đọc" })).toHaveLength(1);
});

it("marks a notice read and shows the new unread count from the server", async () => {
	const list = vi
		.spyOn(weatherChangeNoticesService, "list")
		.mockResolvedValue({ items: [worse], unreadCount: 1 });
	const mark = vi
		.spyOn(weatherChangeNoticesService, "markRead")
		.mockResolvedValue({ ...worse, readAt: "2030-01-05T04:00:00Z" });
	render(<WeatherChangeNotices connection={createFakeConnection().connection} />);
	openInbox();
	await screen.findByText(worse.message);
	list.mockResolvedValue({
		items: [{ ...worse, readAt: "2030-01-05T04:00:00Z" }],
		unreadCount: 0,
	});
	fireEvent.click(screen.getByRole("button", { name: "Đánh dấu đã đọc" }));
	await waitFor(() => expect(mark).toHaveBeenCalledWith("n-1", expect.anything()));
	expect(await screen.findByText(/0 chưa đọc\)$/)).toBeVisible();
	expect(screen.queryByRole("button", { name: "Đánh dấu đã đọc" })).not.toBeInTheDocument();
});

it("shows an error when marking read fails", async () => {
	vi.spyOn(weatherChangeNoticesService, "list").mockResolvedValue({
		items: [worse],
		unreadCount: 1,
	});
	vi.spyOn(weatherChangeNoticesService, "markRead").mockRejectedValue(new Error("offline"));
	render(<WeatherChangeNotices connection={createFakeConnection().connection} />);
	openInbox();
	fireEvent.click(await screen.findByRole("button", { name: "Đánh dấu đã đọc" }));
	expect(await screen.findByRole("alert")).toHaveTextContent("Không thể đánh dấu đã đọc");
});

it("offers retry when loading fails, then shows the empty state", async () => {
	const list = vi
		.spyOn(weatherChangeNoticesService, "list")
		.mockRejectedValueOnce(new Error("offline"))
		.mockResolvedValue({ items: [], unreadCount: 0 });
	render(<WeatherChangeNotices connection={createFakeConnection().connection} />);
	openInbox();
	fireEvent.click(await screen.findByRole("button", { name: /Không tải được thông báo/ }));
	expect(await screen.findByText("Chưa có thông báo thay đổi thời tiết.")).toBeVisible();
	expect(list).toHaveBeenCalledTimes(2);
});

it("reloads the inbox at once when the server pushes trip.weather.changed", async () => {
	const fake = createFakeConnection();
	const list = vi
		.spyOn(weatherChangeNoticesService, "list")
		.mockResolvedValue({ items: [], unreadCount: 0 });
	render(<WeatherChangeNotices connection={fake.connection} />);
	await waitFor(() => expect(list).toHaveBeenCalledTimes(1));
	await act(async () => {});
	list.mockResolvedValue({ items: [worse], unreadCount: 1 });
	act(() =>
		fake.latest().serverEmit("trip.weather.changed", {
			eventId: "f-2",
			tripId: "trip-1",
			tripTitle: worse.tripTitle,
			tripStartsAt: worse.tripStartsAt,
			previousRiskLevel: "green",
			riskLevel: "red",
			createdAt: worse.createdAt,
		})
	);
	expect(
		await screen.findByRole("button", { name: "Thông báo thời tiết (1 chưa đọc)" })
	).toBeVisible();
	expect(list).toHaveBeenCalledTimes(2);
});

it("stays idle without a signed-in session", () => {
	localStorage.removeItem("accessToken");
	const list = vi.spyOn(weatherChangeNoticesService, "list");
	const fake = createFakeConnection();
	render(<WeatherChangeNotices connection={fake.connection} />);
	expect(screen.getByRole("button", { name: "Thông báo thời tiết (0 chưa đọc)" })).toBeVisible();
	expect(list).not.toHaveBeenCalled();
	expect(fake.sockets).toHaveLength(0);
});

const reminder = {
	id: "a-1",
	tripId: "trip-1",
	milestone: "admin_t12" as const,
	urgency: "urgent" as const,
	tripTitle: "Tà Năng – Phan Dũng",
	tripStartsAt: "2030-01-17T00:00:00Z",
	message: 'Khẩn: Trip "Tà Năng – Phan Dũng" vẫn dự báo Đỏ và chưa có quyết định. Cần Admin xử lý.',
	readAt: null,
	createdAt: "2030-01-16T12:00:00Z",
};

function decisionService(items = [reminder]) {
	return {
		listAlerts: vi
			.fn()
			.mockResolvedValue({ items, unreadCount: items.filter((i) => !i.readAt).length }),
		markAlertRead: vi.fn().mockResolvedValue({ ...reminder, readAt: "2030-01-16T13:00:00Z" }),
	} as never;
}

it("adds the decision reminders above the forecast changes for a Host and counts both", async () => {
	vi.spyOn(weatherChangeNoticesService, "list").mockResolvedValue({
		items: [worse],
		unreadCount: 1,
	});
	render(
		<WeatherChangeNotices
			includeDecisions
			decisionService={decisionService()}
			connection={createFakeConnection().connection}
		/>
	);
	expect(
		await screen.findByRole("button", { name: "Thông báo thời tiết (2 chưa đọc)" })
	).toBeVisible();
	openInbox();
	const alert = await screen.findByTestId("weather-decision-alert");
	expect(alert).toHaveAttribute("data-urgency", "urgent");
	expect(alert).toHaveTextContent("Khẩn");
	expect(screen.getAllByRole("link", { name: reminder.tripTitle })[0]).toHaveAttribute(
		"href",
		"/trips/trip-1"
	);
	expect(screen.getByText("Thay đổi dự báo")).toBeVisible();
	expect(screen.getByText(worse.message)).toBeVisible();
});

it("shows only the reminders for an Admin, linking to the intervention page, and marks them read", async () => {
	const list = vi.spyOn(weatherChangeNoticesService, "list");
	const service = decisionService() as unknown as {
		listAlerts: ReturnType<typeof vi.fn>;
		markAlertRead: ReturnType<typeof vi.fn>;
	};
	render(
		<WeatherChangeNotices
			includeChanges={false}
			includeDecisions
			decisionService={service as never}
			connection={createFakeConnection().connection}
		/>
	);
	openInbox();
	expect(await screen.findByRole("link", { name: reminder.tripTitle })).toHaveAttribute(
		"href",
		"/admin/weather-interventions"
	);
	expect(screen.queryByText("Thay đổi dự báo")).not.toBeInTheDocument();
	expect(list).not.toHaveBeenCalled();
	service.listAlerts.mockResolvedValue({ items: [{ ...reminder, readAt: "x" }], unreadCount: 0 });
	fireEvent.click(screen.getByRole("button", { name: "Đánh dấu đã đọc" }));
	await waitFor(() => expect(service.markAlertRead).toHaveBeenCalledWith("a-1", expect.anything()));
	expect(await screen.findByText(/0 chưa đọc\)$/)).toBeVisible();
});

it("reloads the reminders when the server pushes trip.weather.decision_required", async () => {
	const fake = createFakeConnection();
	const service = decisionService([]) as unknown as { listAlerts: ReturnType<typeof vi.fn> };
	render(
		<WeatherChangeNotices
			includeChanges={false}
			includeDecisions
			decisionService={service as never}
			connection={fake.connection}
		/>
	);
	await waitFor(() => expect(service.listAlerts).toHaveBeenCalledTimes(1));
	await act(async () => {});
	service.listAlerts.mockResolvedValue({ items: [reminder], unreadCount: 1 });
	act(() => fake.latest().serverEmit("trip.weather.decision_required", { tripId: "trip-1" }));
	expect(
		await screen.findByRole("button", { name: "Thông báo thời tiết (1 chưa đọc)" })
	).toBeVisible();
});
