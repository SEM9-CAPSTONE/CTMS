import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import type { weatherDecisionsService } from "../services/weather-decisions.service";
import type { TripWeatherDecision, TripWeatherDecisionLog } from "../types";
import { HostWeatherDecisionCard } from "./HostWeatherDecisionCard";
import { WeatherRescheduleResponseCard } from "./WeatherRescheduleResponseCard";

const TRIP_ID = "7b0a3c5e-97a1-4c2e-9d10-0f5f4b1e9701";
const HOUR = 60 * 60 * 1000;

function log(overrides: Partial<TripWeatherDecisionLog> = {}): TripWeatherDecisionLog {
	return {
		tripId: TRIP_ID,
		tripStatus: "published",
		startsAt: new Date(Date.now() + 40 * HOUR).toISOString(),
		weatherPausedAt: null,
		weatherPauseReason: null,
		latestRiskLevel: "red",
		withinDecisionWindow: true,
		decisions: [],
		...overrides,
	};
}

function decision(overrides: Partial<TripWeatherDecision> = {}): TripWeatherDecision {
	return {
		id: "d-1",
		tripId: TRIP_ID,
		forecastId: "f-1",
		riskLevel: "red",
		decidedBy: "host-1",
		deciderName: "Host A",
		deciderRole: "host",
		decision: "keep",
		reason: "Porter quen tuyến",
		safetyPlan: "Quay đầu trước 14h",
		late: false,
		tripStartsAt: log().startsAt,
		createdAt: new Date().toISOString(),
		...overrides,
	};
}

function service(overrides: Partial<typeof weatherDecisionsService> = {}) {
	return {
		getLog: vi.fn().mockResolvedValue(log()),
		decideAsHost: vi.fn().mockResolvedValue(decision()),
		decideAsAdmin: vi.fn(),
		listInterventions: vi.fn(),
		listAlerts: vi.fn(),
		markAlertRead: vi.fn(),
		respondToReschedule: vi.fn(),
		...overrides,
	} as unknown as typeof weatherDecisionsService & Record<string, ReturnType<typeof vi.fn>>;
}

function renderWithClient(ui: ReactNode) {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function conflict(message: string) {
	return new HttpError("Conflict", 409, { message });
}

async function confirm() {
	const dialog = await screen.findByTestId("confirm-modal");
	fireEvent.click(within(dialog).getByRole("button", { name: "Xác nhận" }));
}

afterEach(cleanup);

describe("HostWeatherDecisionCard", () => {
	it("stays hidden while the Trip is not Red in the last 3 days and has no decisions", async () => {
		const api = service({ getLog: vi.fn().mockResolvedValue(log({ latestRiskLevel: "green" })) });
		const { container } = renderWithClient(
			<HostWeatherDecisionCard tripId={TRIP_ID} service={api} />
		);
		await waitFor(() => expect(api.getLog).toHaveBeenCalledWith(TRIP_ID));
		expect(container).toBeEmptyDOMElement();
	});

	it("requires a reason and a safety plan to keep, then records the decision", async () => {
		const api = service();
		renderWithClient(<HostWeatherDecisionCard tripId={TRIP_ID} service={api} />);
		const submit = await screen.findByRole("button", { name: "Gửi quyết định: Giữ" });
		fireEvent.click(submit);
		expect(screen.getByRole("alert")).toHaveTextContent("Vui lòng nhập lý do.");
		fireEvent.change(screen.getByLabelText("Lý do (bắt buộc)"), {
			target: { value: "Porter quen tuyến" },
		});
		fireEvent.click(submit);
		expect(screen.getByRole("alert")).toHaveTextContent("phương án an toàn");
		fireEvent.change(screen.getByLabelText("Phương án an toàn (bắt buộc khi giữ)"), {
			target: { value: "Quay đầu trước 14h" },
		});
		fireEvent.click(submit);
		await confirm();
		await waitFor(() =>
			expect(api.decideAsHost).toHaveBeenCalledWith(TRIP_ID, {
				decision: "keep",
				reason: "Porter quen tuyến",
				safetyPlan: "Quay đầu trước 14h",
			})
		);
		expect(await screen.findByText("Đã ghi nhận quyết định: Giữ.")).toBeVisible();
	});

	it("cancels for weather, warns that a decision after T-24h is late and reloads the Trip", async () => {
		const onTripChanged = vi.fn();
		const api = service({
			getLog: vi
				.fn()
				.mockResolvedValue(log({ startsAt: new Date(Date.now() + 10 * HOUR).toISOString() })),
			decideAsHost: vi.fn().mockResolvedValue(decision({ decision: "cancel", late: true })),
		});
		renderWithClient(
			<HostWeatherDecisionCard tripId={TRIP_ID} service={api} onTripChanged={onTripChanged} />
		);
		expect(await screen.findByTestId("weather-decision-late-notice")).toBeVisible();
		fireEvent.click(screen.getByRole("button", { name: "Huỷ vì thời tiết" }));
		fireEvent.change(screen.getByLabelText("Lý do (bắt buộc)"), { target: { value: "Bão" } });
		expect(screen.queryByLabelText("Phương án an toàn (bắt buộc khi giữ)")).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Gửi quyết định: Huỷ vì thời tiết" }));
		expect(await screen.findByText(/sẽ được ghi là trễ hạn/)).toBeVisible();
		await confirm();
		await waitFor(() => expect(onTripChanged).toHaveBeenCalled());
		expect(api.decideAsHost).toHaveBeenCalledWith(TRIP_ID, { decision: "cancel", reason: "Bão" });
	});

	it("checks the new dates before rescheduling", async () => {
		const api = service();
		renderWithClient(<HostWeatherDecisionCard tripId={TRIP_ID} service={api} />);
		fireEvent.click(await screen.findByRole("button", { name: "Dời lịch" }));
		fireEvent.change(screen.getByLabelText("Lý do (bắt buộc)"), { target: { value: "Bão" } });
		fireEvent.click(screen.getByRole("button", { name: "Gửi quyết định: Dời lịch" }));
		expect(screen.getByRole("alert")).toHaveTextContent("chọn thời gian bắt đầu và kết thúc");
		fireEvent.change(screen.getByLabelText("Bắt đầu mới"), {
			target: { value: "2030-01-10T08:00" },
		});
		fireEvent.change(screen.getByLabelText("Kết thúc mới"), {
			target: { value: "2030-01-10T07:00" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Gửi quyết định: Dời lịch" }));
		expect(screen.getByRole("alert")).toHaveTextContent("kết thúc phải sau");
		expect(api.decideAsHost).not.toHaveBeenCalled();
	});

	it("shows the server refusal in Vietnamese", async () => {
		const api = service({
			decideAsHost: vi
				.fn()
				.mockRejectedValue(conflict("The latest forecast for the Trip dates is not Red")),
		});
		renderWithClient(<HostWeatherDecisionCard tripId={TRIP_ID} service={api} />);
		fireEvent.click(await screen.findByRole("button", { name: "Huỷ vì thời tiết" }));
		fireEvent.change(screen.getByLabelText("Lý do (bắt buộc)"), { target: { value: "Bão" } });
		fireEvent.click(screen.getByRole("button", { name: "Gửi quyết định: Huỷ vì thời tiết" }));
		await confirm();
		expect(await screen.findByText("Dự báo mới nhất cho ngày đi không còn Đỏ.")).toBeVisible();
	});

	it("locks the form once an Admin acted, shows the pause and the decision log", async () => {
		const startsAt = log().startsAt;
		const api = service({
			getLog: vi.fn().mockResolvedValue(
				log({
					weatherPausedAt: new Date().toISOString(),
					weatherPauseReason: "Chờ cập nhật bão",
					decisions: [
						decision({
							id: "d-2",
							deciderRole: "admin",
							decision: "pause",
							reason: "Chờ cập nhật bão",
							safetyPlan: null,
							tripStartsAt: startsAt,
						}),
						decision({ late: true }),
					],
				})
			),
		});
		renderWithClient(<HostWeatherDecisionCard tripId={TRIP_ID} service={api} />);
		expect(await screen.findByText(/Admin đang tạm dừng Trip này: Chờ cập nhật bão/)).toBeVisible();
		expect(
			screen.getByText("Admin đã xử lý Trip này nên Host không quyết định thêm.")
		).toBeVisible();
		expect(screen.queryByRole("button", { name: /Gửi quyết định/ })).not.toBeInTheDocument();
		const entries = screen.getAllByTestId("weather-decision-entry");
		expect(entries).toHaveLength(2);
		expect(entries[0]).toHaveTextContent("Tạm dừng");
		expect(entries[1]).toHaveTextContent("Trễ hạn");
		expect(entries[1]).toHaveTextContent("Phương án an toàn: Quay đầu trước 14h");
	});
});

describe("WeatherRescheduleResponseCard", () => {
	function renderCard(api: ReturnType<typeof service>, onAnswered = vi.fn()) {
		renderWithClient(
			<WeatherRescheduleResponseCard
				bookingId="b-1"
				newStartsAt="2030-01-10T01:00:00.000Z"
				newEndsAt="2030-01-10T10:00:00.000Z"
				onAnswered={onAnswered}
				service={api}
			/>
		);
		return onAnswered;
	}

	it("keeps the booking on the new date after confirmation", async () => {
		const api = service({
			respondToReschedule: vi
				.fn()
				.mockResolvedValue({ bookingId: "b-1", status: "confirmed", refundsCreated: 0 }),
		});
		const onAnswered = renderCard(api);
		fireEvent.click(screen.getByRole("button", { name: "Giữ chỗ ở lịch mới" }));
		await confirm();
		expect(await screen.findByText("Bạn đã giữ chỗ ở lịch mới.")).toBeVisible();
		expect(api.respondToReschedule).toHaveBeenCalledWith("b-1", true);
		expect(onAnswered).toHaveBeenCalled();
	});

	it("declines with a full refund", async () => {
		const api = service({
			respondToReschedule: vi
				.fn()
				.mockResolvedValue({ bookingId: "b-1", status: "cancelled", refundsCreated: 1 }),
		});
		renderCard(api);
		fireEvent.click(screen.getByRole("button", { name: "Huỷ và hoàn 100%" }));
		await confirm();
		expect(await screen.findByText(/Khoản hoàn 100% đang được xử lý/)).toBeVisible();
		expect(api.respondToReschedule).toHaveBeenCalledWith("b-1", false);
	});

	it("explains when the reschedule was not for weather", async () => {
		const api = service({
			respondToReschedule: vi
				.fn()
				.mockRejectedValue(conflict("This Trip was not rescheduled because of the weather")),
		});
		const onAnswered = renderCard(api);
		fireEvent.click(screen.getByRole("button", { name: "Huỷ và hoàn 100%" }));
		await confirm();
		expect(await screen.findByRole("alert")).toHaveTextContent("không phải vì thời tiết");
		expect(onAnswered).not.toHaveBeenCalled();
		expect(screen.getByRole("button", { name: "Giữ chỗ ở lịch mới" })).toBeVisible();
	});
});
