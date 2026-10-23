import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { TripWeatherForecast } from "../types";
import { TripWeatherBadge } from "./TripWeatherBadge";
import { TripWeatherForecastCard } from "./TripWeatherForecastCard";
import { WeatherSubmissionNotice } from "./WeatherSubmissionNotice";

const available: TripWeatherForecast = {
	id: "forecast-1",
	tripId: "trip-1",
	status: "available",
	tripStartsAt: "2026-10-21T01:00:00.000Z",
	tripEndsAt: "2026-10-21T10:00:00.000Z",
	forecastFrom: "2026-10-21T01:00:00.000Z",
	forecastTo: "2026-10-21T10:00:00.000Z",
	coversWholeTrip: true,
	worstReading: {
		rainfallMm: 12,
		rainfallAt: "2026-10-21T04:00:00.000Z",
		windKph: 20,
		windAt: "2026-10-21T05:00:00.000Z",
		temperatureC: 26,
		temperatureAt: "2026-10-21T06:00:00.000Z",
		visibilityM: 9000,
		visibilityAt: "2026-10-21T07:00:00.000Z",
		thunderstorm: false,
		thunderstormAt: null,
		hoursCovered: 10,
	},
	riskLevel: "yellow",
	compositeScore: 0.6,
	criteriaScores: {
		rainfall: { value: 12, level: "yellow", weight: 0.3, score: 1 },
		wind: { value: 20, level: "green", weight: 0.25, score: 0 },
		temperature: { value: 26, level: "green", weight: 0.15, score: 0 },
		visibility: { value: 9000, level: "green", weight: 0.15, score: 0 },
		thunderstorm: { value: false, level: "green", weight: 0.15, score: 0 },
	},
	advice: null,
	horizonDays: 15,
	createdAt: "2026-10-18T01:00:00.000Z",
};

describe("TripWeatherForecastCard", () => {
	it("shows the forecast for the trekking days with the worst hour of each criterion", () => {
		render(<TripWeatherForecastCard forecast={available} isLoading={false} error={null} />);

		expect(screen.getByText("Dự báo thời tiết ngày trekking")).toBeInTheDocument();
		expect(screen.getByText("Cảnh báo (Vàng)")).toBeInTheDocument();
		expect(screen.getByTestId("trip-weather-forecast-card-criterion-rainfall")).toHaveTextContent(
			/Xấu nhất lúc/
		);
	});

	it("explains a Trip beyond the forecast horizon", () => {
		render(
			<TripWeatherForecastCard
				forecast={{
					...available,
					status: "out_of_range",
					riskLevel: null,
					compositeScore: null,
					criteriaScores: null,
					worstReading: null,
				}}
				isLoading={false}
				error={null}
			/>
		);
		expect(screen.getByText(/ngoài phạm vi dự báo 15 ngày/)).toBeInTheDocument();
		expect(screen.getByText(/Bạn vẫn có thể gửi duyệt/)).toBeInTheDocument();
	});

	it("warns when the forecast covers only part of the Trip", () => {
		render(
			<TripWeatherForecastCard
				forecast={{ ...available, coversWholeTrip: false, forecastTo: "2026-10-21T05:00:00.000Z" }}
				isLoading={false}
				error={null}
			/>
		);
		expect(screen.getByText(/Dự báo mới phủ tới/)).toBeInTheDocument();
	});
});

describe("WeatherSubmissionNotice", () => {
	it("shows nothing for Green and a note for Yellow", () => {
		const { rerender } = render(
			<WeatherSubmissionNotice
				riskLevel="green"
				acknowledged={false}
				onAcknowledgedChange={vi.fn()}
			/>
		);
		expect(screen.queryByTestId("weather-submission-yellow")).not.toBeInTheDocument();
		rerender(
			<WeatherSubmissionNotice
				riskLevel="yellow"
				acknowledged={false}
				onAcknowledgedChange={vi.fn()}
			/>
		);
		expect(screen.getByTestId("weather-submission-yellow")).toHaveTextContent(/Admin sẽ xem xét/);
	});

	it("asks the Host to acknowledge a Red forecast", async () => {
		const user = userEvent.setup();
		const onChange = vi.fn();
		render(
			<WeatherSubmissionNotice
				riskLevel="red"
				acknowledged={false}
				onAcknowledgedChange={onChange}
			/>
		);
		await user.click(screen.getByRole("checkbox", { name: /rủi ro thời tiết cao/ }));
		expect(onChange).toHaveBeenCalledWith(true);
	});
});

describe("TripWeatherBadge", () => {
	it("labels every submission state for the Admin list", () => {
		const { rerender } = render(<TripWeatherBadge forecast={null} />);
		expect(screen.getByText("Chưa có dự báo")).toBeInTheDocument();
		rerender(
			<TripWeatherBadge
				forecast={{ id: "f", status: "out_of_range", riskLevel: null, riskAcknowledged: false }}
			/>
		);
		expect(screen.getByText("Ngoài phạm vi dự báo")).toBeInTheDocument();
		rerender(
			<TripWeatherBadge
				forecast={{ id: "f", status: "available", riskLevel: "red", riskAcknowledged: true }}
			/>
		);
		expect(screen.getByText(/Nguy hiểm \(Đỏ\).*Host đã xác nhận/)).toBeInTheDocument();
	});
});
