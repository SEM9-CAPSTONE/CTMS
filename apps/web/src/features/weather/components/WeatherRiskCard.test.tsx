import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { toCriterionViews } from "../utils/weather-risk";
import { WeatherRiskCard } from "./WeatherRiskCard";

const criteria = toCriterionViews(
	{
		rainfall: { value: 12, level: "yellow", weight: 0.3, score: 1 },
		wind: { value: 20, level: "green", weight: 0.25, score: 0 },
		temperature: { value: 25, level: "green", weight: 0.15, score: 0 },
		visibility: { value: 800, level: "red", weight: 0.15, score: 2 },
		thunderstorm: { value: true, level: "red", weight: 0.15, score: 2 },
	},
	{ rainfall: "Xấu nhất lúc 09:00" }
);

describe("WeatherRiskCard", () => {
	it("shows level, score, all criteria and advice in one card", () => {
		render(
			<WeatherRiskCard
				title="Thời tiết"
				riskLevel="red"
				compositeScore={1.4}
				assessedAt="2026-10-18T01:00:00.000Z"
				criteria={criteria}
				advice={{ text: "Hoãn chuyến.", actions: ["Theo dõi dự báo"] }}
			/>
		);

		const card = screen.getByTestId("weather-risk-card");
		expect(within(card).getByText("Nguy hiểm (Đỏ)")).toBeInTheDocument();
		expect(within(card).getByText("1.40")).toBeInTheDocument();
		expect(within(card).getByTestId("weather-risk-card-criterion-rainfall")).toHaveTextContent(
			"12 mm"
		);
		expect(within(card).getByTestId("weather-risk-card-criterion-visibility")).toHaveTextContent(
			"800 m"
		);
		expect(within(card).getByTestId("weather-risk-card-criterion-thunderstorm")).toHaveTextContent(
			"Có"
		);
		expect(within(card).getByText("Xấu nhất lúc 09:00")).toBeInTheDocument();
		expect(within(card).getByText("Hoãn chuyến.")).toBeInTheDocument();
		expect(within(card).getByText("Theo dõi dự báo")).toBeInTheDocument();
	});

	it("shows the empty message without an assessment and runs the single refresh action", async () => {
		const user = userEvent.setup();
		const onRefresh = vi.fn();
		render(
			<WeatherRiskCard
				title="Thời tiết"
				emptyMessage="Ngoài phạm vi dự báo"
				onRefresh={onRefresh}
				refreshLabel="Dự báo lại"
			/>
		);

		expect(screen.getByText("Ngoài phạm vi dự báo")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: /Dự báo lại/ }));
		expect(onRefresh).toHaveBeenCalledTimes(1);
	});

	it("shows a blocking error with retry", async () => {
		const user = userEvent.setup();
		const onRetry = vi.fn();
		render(<WeatherRiskCard title="Thời tiết" error="Dịch vụ lỗi" onRetry={onRetry} />);

		expect(screen.getByRole("alert")).toHaveTextContent("Dịch vụ lỗi");
		await user.click(screen.getByRole("button", { name: "Thử lại" }));
		expect(onRetry).toHaveBeenCalled();
	});
});
