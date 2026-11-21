import { HttpError } from "../../../core/api";
import type { WeatherRiskLevel } from "../../weather/utils/weather-risk";
import type { WeatherAiMismatch } from "../types";

export const RISK_LEVEL_SHORT: Record<WeatherRiskLevel, string> = {
	green: "Xanh",
	yellow: "Vàng",
	red: "Đỏ",
};

const RANK: Record<WeatherRiskLevel, number> = { green: 0, yellow: 1, red: 2 };

/** What the disagreement suggests about the thresholds, in plain words. */
export function mismatchHint(item: Pick<WeatherAiMismatch, "riskLevel" | "aiRiskLevel">): string {
	return RANK[item.riskLevel] > RANK[item.aiRiskLevel]
		? "Ngưỡng có thể đang quá chặt: Trip bị báo xấu hơn AI đánh giá."
		: "Ngưỡng có thể đang quá lỏng: AI thấy thời tiết nguy hiểm hơn mức đang báo.";
}

/** Worst-hour readings as one short line, e.g. "Mưa 62 mm/h · Gió 18 km/h · Có dông". */
export function readingsSummary(item: Pick<WeatherAiMismatch, "worstReading">): string | null {
	const reading = item.worstReading;
	if (!reading) return null;
	const parts = [
		`Mưa ${formatNumber(reading.rainfallMm)} mm/h`,
		`Gió ${formatNumber(reading.windKph)} km/h`,
		`Nhiệt độ ${formatNumber(reading.temperatureC)}°C`,
		`Tầm nhìn ${formatNumber(reading.visibilityM)} m`,
		reading.thunderstorm ? "Có dông" : "Không dông",
	];
	return parts.join(" · ");
}

function formatNumber(value: number): string {
	return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function weatherAiReviewErrorMessage(error: unknown): string {
	if (error instanceof HttpError) {
		if (error.status === 403) return "Bạn không có quyền xem mục này.";
		if (error.status === 404) return "Không tìm thấy dự báo này nữa. Vui lòng tải lại.";
		if (error.status === 409) return "Dự báo đã thay đổi, không còn lệch với AI. Vui lòng tải lại.";
	}
	return "Không tải được dữ liệu. Vui lòng thử lại.";
}
