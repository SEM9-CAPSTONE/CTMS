import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import type { TripWeatherForecast } from "../types";
import { TripDatesWeatherCard } from "./TripDatesWeatherCard";

const TRIP_ID = "2cbcbd1e-0020-42b5-9565-74a68f34a7a2";

function forecast(overrides: Partial<TripWeatherForecast> = {}): TripWeatherForecast {
	return {
		id: "f-1",
		tripId: TRIP_ID,
		status: "available",
		tripStartsAt: "2026-11-10T00:00:00.000Z",
		tripEndsAt: "2026-11-10T10:00:00.000Z",
		forecastFrom: "2026-11-10T00:00:00.000Z",
		forecastTo: "2026-11-10T10:00:00.000Z",
		coversWholeTrip: true,
		worstReading: {
			rainfallMm: 12,
			rainfallAt: "2026-11-10T05:00:00.000Z",
			windKph: 20,
			windAt: "2026-11-10T06:00:00.000Z",
			temperatureC: 24,
			temperatureAt: "2026-11-10T07:00:00.000Z",
			visibilityM: 10000,
			visibilityAt: "2026-11-10T05:00:00.000Z",
			thunderstorm: false,
			thunderstormAt: null,
			hoursCovered: 11,
		},
		riskLevel: "yellow",
		compositeScore: 0.8,
		criteriaScores: null,
		advice: null,
		horizonDays: 15,
		createdAt: "2026-11-07T03:00:00.000Z",
		...overrides,
	};
}

function renderCard(
	fetchForecast: (tripId: string) => Promise<TripWeatherForecast>,
	enabled = true
) {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	const wrapper = ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={client}>{children}</QueryClientProvider>
	);
	return render(
		<TripDatesWeatherCard tripId={TRIP_ID} enabled={enabled} fetchForecast={fetchForecast} />,
		{ wrapper }
	);
}

afterEach(cleanup);

describe("TripDatesWeatherCard", () => {
	it("shows the forecast for the Trip's own dates with the traveller title", async () => {
		const fetchForecast = vi.fn().mockResolvedValue(forecast());
		renderCard(fetchForecast);

		expect(await screen.findByText("Dự báo thời tiết ngày đi")).toBeInTheDocument();
		expect(fetchForecast).toHaveBeenCalledWith(TRIP_ID);
		expect(await screen.findByText(/Dự báo cho lịch trình/)).toBeInTheDocument();
	});

	it("shows when the monitor last checked the forecast and offers its change history", async () => {
		renderCard(vi.fn().mockResolvedValue(forecast({ checkedAt: "2026-11-08T05:00:00.000Z" })));
		expect(await screen.findByTestId("trip-forecast-checked-at")).toHaveTextContent(
			"Kiểm tra lần cuối:"
		);
		expect(screen.getByTestId("trip-weather-history")).toHaveTextContent("Lịch sử thay đổi dự báo");
	});

	it("explains that a far-away Trip has no forecast yet instead of showing today's weather", async () => {
		renderCard(
			vi.fn().mockResolvedValue(
				forecast({
					status: "out_of_range",
					riskLevel: null,
					worstReading: null,
					compositeScore: null,
				})
			)
		);
		expect(
			await screen.findByText(/Ngày đi còn xa hơn 15 ngày nên chưa có dự báo/)
		).toBeInTheDocument();
		expect(screen.getByText(/không dùng thời tiết hôm nay để thay thế/)).toBeInTheDocument();
	});

	it("shows a clear error when the weather service is down", async () => {
		renderCard(vi.fn().mockRejectedValue(new HttpError("down", 503, null)));
		expect(
			await screen.findByText("Dịch vụ thời tiết tạm thời không khả dụng. Vui lòng thử lại sau.")
		).toBeInTheDocument();
	});

	it("renders nothing and fetches nothing when disabled (signed-out visitor)", () => {
		const fetchForecast = vi.fn();
		const { container } = renderCard(fetchForecast, false);
		expect(container).toBeEmptyDOMElement();
		expect(fetchForecast).not.toHaveBeenCalled();
	});
});
