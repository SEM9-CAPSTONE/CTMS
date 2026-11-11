import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { weatherDecisionsService } from "../services/weather-decisions.service";
import type { TripWeatherDecisionLog, WeatherIntervention } from "../types";
import { AdminWeatherInterventionsPage } from "./AdminWeatherInterventionsPage";

const HOUR = 60 * 60 * 1000;

function intervention(overrides: Partial<WeatherIntervention> = {}): WeatherIntervention {
	return {
		tripId: "trip-1",
		tripTitle: "Tà Năng – Phan Dũng",
		hostId: "host-1",
		startsAt: new Date(Date.now() + 5 * HOUR).toISOString(),
		forecastId: "f-1",
		reason: "no_response",
		urgency: "critical",
		hostDecisionReason: null,
		hostSafetyPlan: null,
		weatherPausedAt: null,
		...overrides,
	};
}

function log(overrides: Partial<TripWeatherDecisionLog> = {}): TripWeatherDecisionLog {
	return {
		tripId: "trip-1",
		tripStatus: "published",
		startsAt: new Date(Date.now() + 5 * HOUR).toISOString(),
		weatherPausedAt: null,
		weatherPauseReason: null,
		latestRiskLevel: "red",
		withinDecisionWindow: true,
		decisions: [],
		...overrides,
	};
}

function service(items: WeatherIntervention[], logValue = log()) {
	return {
		getLog: vi.fn().mockResolvedValue(logValue),
		decideAsHost: vi.fn(),
		decideAsAdmin: vi.fn().mockResolvedValue({ id: "d-9", decision: "pause" }),
		listInterventions: vi.fn().mockResolvedValue(items),
		listAlerts: vi.fn().mockResolvedValue({ items: [], unreadCount: 0 }),
		markAlertRead: vi.fn(),
		respondToReschedule: vi.fn(),
	} as unknown as typeof weatherDecisionsService & Record<string, ReturnType<typeof vi.fn>>;
}

afterEach(cleanup);

it("lists the Trips that need an Admin with urgency and why", async () => {
	const api = service([
		intervention(),
		intervention({
			tripId: "trip-2",
			tripTitle: "Bidoup",
			reason: "host_kept",
			urgency: "normal",
			weatherPausedAt: new Date().toISOString(),
		}),
	]);
	render(<AdminWeatherInterventionsPage service={api} />);
	const rows = await screen.findAllByTestId("weather-intervention-row");
	expect(rows).toHaveLength(2);
	expect(rows[0]).toHaveTextContent("Tà Năng – Phan Dũng");
	expect(rows[0]).toHaveTextContent("Host chưa phản hồi");
	expect(rows[0]).toHaveTextContent("Khẩn cấp");
	expect(rows[1]).toHaveTextContent("Host chọn Giữ");
	expect(rows[1]).toHaveTextContent("Đang tạm dừng");
});

it("shows the empty state", async () => {
	render(<AdminWeatherInterventionsPage service={service([])} />);
	expect(await screen.findByText("Hiện không có Trip nào cần Admin can thiệp.")).toBeVisible();
});

it("opens a Trip and pauses it with a reason", async () => {
	const api = service([intervention()]);
	render(<AdminWeatherInterventionsPage service={api} />);
	fireEvent.click(await screen.findByTestId("weather-intervention-row"));
	const dialog = await screen.findByTestId("admin-weather-decision-dialog");
	expect(
		within(dialog).getByText("Host chưa phản hồi trước mốc 24 giờ trước giờ đi.")
	).toBeVisible();
	fireEvent.click(within(dialog).getByRole("button", { name: "Tạm dừng" }));
	fireEvent.change(within(dialog).getByLabelText("Lý do (bắt buộc)"), {
		target: { value: "Chờ cập nhật bão" },
	});
	fireEvent.click(within(dialog).getByRole("button", { name: "Gửi quyết định: Tạm dừng" }));
	fireEvent.click(
		within(await screen.findByTestId("confirm-modal")).getByRole("button", { name: "Xác nhận" })
	);
	await waitFor(() =>
		expect(api.decideAsAdmin).toHaveBeenCalledWith("trip-1", {
			decision: "pause",
			reason: "Chờ cập nhật bão",
		})
	);
	await waitFor(() => expect(api.listInterventions).toHaveBeenCalledTimes(2));
});

it("offers resume first for a paused Trip and shows the Host's keep reason", async () => {
	const pausedAt = new Date().toISOString();
	const api = service(
		[
			intervention({
				reason: "host_kept",
				hostDecisionReason: "Porter quen tuyến",
				hostSafetyPlan: "Quay đầu trước 14h",
				weatherPausedAt: pausedAt,
			}),
		],
		log({ weatherPausedAt: pausedAt, weatherPauseReason: "Chờ" })
	);
	render(<AdminWeatherInterventionsPage service={api} />);
	fireEvent.click(await screen.findByTestId("weather-intervention-row"));
	const dialog = await screen.findByTestId("admin-weather-decision-dialog");
	expect(within(dialog).getByText("Phương án an toàn: Quay đầu trước 14h")).toBeVisible();
	const pressed = within(dialog).getByRole("button", { name: "Mở lại" });
	expect(pressed).toHaveAttribute("aria-pressed", "true");
	expect(within(dialog).queryByRole("button", { name: "Tạm dừng" })).not.toBeInTheDocument();
});
