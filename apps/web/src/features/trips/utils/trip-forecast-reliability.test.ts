import { describe, expect, it } from "vitest";
import { isFarRedForecast, tripForecastReliability } from "./trip-forecast-reliability";

const NOW = new Date("2026-11-07T00:00:00.000Z");
const inDays = (days: number) => new Date(NOW.getTime() + days * 86_400_000).toISOString();

describe("tripForecastReliability (policy §2)", () => {
	it.each([
		[15, "low", "Dự báo xa, có thể thay đổi"],
		[8, "low", "Dự báo xa, có thể thay đổi"],
		[7, "medium", "Cảnh báo sớm"],
		[4, "medium", "Cảnh báo sớm"],
		[3, "high", "Độ tin cậy cao"],
		[0.5, "high", "Độ tin cậy cao"],
		[-0.1, "high", "Độ tin cậy cao"],
	] as const)("%s days before departure → %s", (days, level, label) => {
		expect(tripForecastReliability(inDays(days), NOW)).toMatchObject({ level, label });
	});

	it("treats just over 3 days as an early warning, matching the booking gate window", () => {
		expect(tripForecastReliability(inDays(3.01), NOW).level).toBe("medium");
	});
});

describe("isFarRedForecast", () => {
	it("is true only for an available Red forecast more than 3 days out", () => {
		expect(
			isFarRedForecast({ status: "available", riskLevel: "red", tripStartsAt: inDays(5) }, NOW)
		).toBe(true);
		expect(
			isFarRedForecast({ status: "available", riskLevel: "red", tripStartsAt: inDays(3) }, NOW)
		).toBe(false);
		expect(
			isFarRedForecast({ status: "available", riskLevel: "yellow", tripStartsAt: inDays(5) }, NOW)
		).toBe(false);
		expect(
			isFarRedForecast({ status: "out_of_range", riskLevel: null, tripStartsAt: inDays(20) }, NOW)
		).toBe(false);
		expect(isFarRedForecast(null, NOW)).toBe(false);
	});
});
