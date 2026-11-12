import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { weatherRuleSchema } from "../../admin-weather-rules/schema/weather-rule.schema";
import type { weatherAiReviewService } from "../services/weather-ai-review.service";
import type { WeatherAiMismatch } from "../types";
import { mismatchHint, readingsSummary } from "../utils/weather-ai-review-labels";
import { AiRiskOpinionNote } from "./AiRiskOpinionNote";
import { WeatherAiMismatchPanel } from "./WeatherAiMismatchPanel";

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

function mismatch(overrides: Partial<WeatherAiMismatch> = {}): WeatherAiMismatch {
	return {
		forecastId: "f-1",
		tripId: "trip-1",
		tripTitle: "Bà Nà mưa lớn",
		tripStatus: "published",
		tripStartsAt: "2030-01-10T01:00:00.000Z",
		hostId: "host-1",
		hostName: "Host Demo",
		riskLevel: "red",
		aiRiskLevel: "green",
		aiReason: "Chỉ một giờ mưa ngắn, phần lớn thời gian trời đẹp.",
		aiConfidence: 0.65,
		aiReviewedAt: "2030-01-08T01:00:00.000Z",
		gap: 2,
		worstReading: {
			rainfallMm: 62,
			rainfallAt: "2030-01-10T03:00:00.000Z",
			windKph: 18.4,
			windAt: "2030-01-10T03:00:00.000Z",
			temperatureC: 24,
			temperatureAt: "2030-01-10T03:00:00.000Z",
			visibilityM: 8000,
			visibilityAt: "2030-01-10T03:00:00.000Z",
			thunderstorm: false,
			thunderstormAt: null,
			hoursCovered: 9,
		},
		ruleVersion: 3,
		...overrides,
	};
}

function service(items: WeatherAiMismatch[]) {
	return {
		listMismatches: vi.fn().mockResolvedValue(items),
		acknowledge: vi.fn().mockResolvedValue({ forecastId: "f-1", acknowledgedAt: "now" }),
	} as unknown as typeof weatherAiReviewService & {
		listMismatches: ReturnType<typeof vi.fn>;
		acknowledge: ReturnType<typeof vi.fn>;
	};
}

describe("WeatherAiMismatchPanel", () => {
	it("shows both levels, the AI reason, the worst readings and what it suggests", async () => {
		const onViewRules = vi.fn();
		render(<WeatherAiMismatchPanel service={service([mismatch()])} onViewRules={onViewRules} />);
		const row = await screen.findByTestId("weather-ai-mismatch-row");
		expect(within(row).getByText("Bà Nà mưa lớn")).toBeVisible();
		expect(within(row).getByText("Theo ngưỡng: Đỏ")).toBeVisible();
		expect(within(row).getByText("AI đánh giá: Xanh")).toBeVisible();
		expect(within(row).getByText(/Chỉ một giờ mưa ngắn/)).toBeVisible();
		expect(within(row).getByText(/độ chắc chắn 65%/)).toBeVisible();
		expect(within(row).getByText(/Mưa 62 mm\/h · Gió 18.4 km\/h/)).toBeVisible();
		expect(within(row).getByText(/quá chặt/)).toBeVisible();
		expect(within(row).getByText(/Ngưỡng v3/)).toBeVisible();
		fireEvent.click(screen.getByRole("button", { name: /Xem ngưỡng/ }));
		expect(onViewRules).toHaveBeenCalledTimes(1);
	});

	it("marks a disagreement as seen and reloads the list", async () => {
		const api = service([mismatch()]);
		render(<WeatherAiMismatchPanel service={api} />);
		fireEvent.click(await screen.findByRole("button", { name: /Đã xem/ }));
		await waitFor(() => expect(api.acknowledge).toHaveBeenCalledWith("f-1"));
		await waitFor(() => expect(api.listMismatches).toHaveBeenCalledTimes(2));
	});

	it("explains a stale disagreement instead of failing silently", async () => {
		const api = service([mismatch()]);
		api.acknowledge.mockRejectedValue(new HttpError("Conflict", 409, {}));
		render(<WeatherAiMismatchPanel service={api} />);
		fireEvent.click(await screen.findByRole("button", { name: /Đã xem/ }));
		expect(await screen.findByRole("alert")).toHaveTextContent("không còn lệch với AI");
	});

	it("says when thresholds and AI agree everywhere", async () => {
		render(<WeatherAiMismatchPanel service={service([])} />);
		expect(await screen.findByText(/đang đánh giá giống nhau/)).toBeVisible();
	});
});

describe("weather AI review labels", () => {
	it("reads a looser threshold the other way round", () => {
		expect(mismatchHint({ riskLevel: "green", aiRiskLevel: "red" })).toMatch(/quá lỏng/);
		expect(mismatchHint({ riskLevel: "red", aiRiskLevel: "yellow" })).toMatch(/quá chặt/);
	});

	it("has no readings line without readings", () => {
		expect(readingsSummary({ worstReading: null })).toBeNull();
	});
});

describe("AiRiskOpinionNote", () => {
	it("flags an opinion that differs from the threshold level and says it is only advisory", () => {
		render(
			<AiRiskOpinionNote
				review={{
					level: "green",
					reason: "Mưa ngắn.",
					confidence: 0.6,
					reviewedAt: "2030-01-08T01:00:00.000Z",
					matchesRule: false,
					acknowledgedAt: null,
				}}
			/>
		);
		const note = screen.getByTestId("trip-forecast-ai-opinion");
		expect(note).toHaveAttribute("data-matches", "false");
		expect(within(note).getByText("Khác với mức theo ngưỡng")).toBeVisible();
		expect(within(note).getByText(/Chỉ để tham khảo/)).toBeVisible();
	});
});

describe("weather rule sensible bounds", () => {
	const valid = {
		rainfallYellowThreshold: 10,
		rainfallRedThreshold: 50,
		windYellowThreshold: 40,
		windRedThreshold: 70,
		tempLowYellow: 5,
		tempLowRed: 0,
		tempHighYellow: 38,
		tempHighRed: 42,
		visibilityYellowThreshold: 5000,
		visibilityRedThreshold: 1000,
		thunderstormYellow: true,
		thunderstormRed: true,
		rainfallWeight: 0.3,
		windWeight: 0.25,
		temperatureWeight: 0.15,
		visibilityWeight: 0.15,
		thunderstormWeight: 0.15,
		greenMaxScore: 0.5,
		yellowMaxScore: 1.2,
		isActive: true,
	};

	it("accepts the default rule", () => {
		expect(weatherRuleSchema.safeParse(valid).success).toBe(true);
	});

	it.each([
		[
			{ rainfallYellowThreshold: 1, rainfallRedThreshold: 2 },
			"Lượng mưa Mức Đỏ phải từ 5 đến 200 mm/h",
		],
		[{ windRedThreshold: 300 }, "Tốc độ gió Mức Đỏ phải từ 30 đến 150 km/h"],
		[
			{ thunderstormYellow: false, thunderstormRed: false },
			"Dông sét phải được tính ít nhất ở Mức Vàng",
		],
		[
			{
				rainfallWeight: 0.7,
				windWeight: 0.1,
				temperatureWeight: 0.1,
				visibilityWeight: 0.05,
				thunderstormWeight: 0.05,
			},
			"Trọng số mưa không được lớn hơn 0.6",
		],
	])("rejects %o", (override, message) => {
		const result = weatherRuleSchema.safeParse({ ...valid, ...override });
		expect(result.success).toBe(false);
		expect(result.error?.issues.map((issue) => issue.message)).toContain(message);
	});
});
