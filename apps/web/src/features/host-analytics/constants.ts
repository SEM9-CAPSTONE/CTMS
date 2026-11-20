import type { HostAnalyticsPeriodPreset } from "./types";

export const HOST_ANALYTICS_STALE_TIME_MS = 30_000;
export const HOST_SUGGESTIONS_POLL_INTERVAL_MS = 3_000;
export const VIETNAM_TIMEZONE = "Asia/Ho_Chi_Minh";

export const PERIOD_PRESET_OPTIONS: ReadonlyArray<{
	value: Exclude<HostAnalyticsPeriodPreset, "custom">;
	label: string;
}> = [
	{ value: "30d", label: "30 ngày" },
	{ value: "90d", label: "90 ngày" },
	{ value: "6m", label: "6 tháng" },
	{ value: "12m", label: "12 tháng" },
];

export const TRIP_TYPE_LABELS: Record<"day_trip" | "overnight", string> = {
	day_trip: "Đi trong ngày",
	overnight: "Qua đêm",
};

export const EXCLUDED_TRIP_REASON_LABELS: Record<
	"missing_capacity_max" | "missing_num_people",
	string
> = {
	missing_capacity_max: "Chưa thiết lập sức chứa tối đa",
	missing_num_people: "Có đơn đặt thiếu số lượng khách",
};

/**
 * Extracts YYYY-MM-DD in Asia/Ho_Chi_Minh strictly, independent of browser timezone.
 */
export function getVietnamDateParts(date: Date): { year: number; month: number; day: number } {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: VIETNAM_TIMEZONE,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(date);
	return {
		year: Number(parts.find((p) => p.type === "year")?.value ?? "1970"),
		month: Number(parts.find((p) => p.type === "month")?.value ?? "1"),
		day: Number(parts.find((p) => p.type === "day")?.value ?? "1"),
	};
}

export function formatVietnamDateInput(date: Date): string {
	const { year, month, day } = getVietnamDateParts(date);
	return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Converts a YYYY-MM-DD calendar date in Asia/Ho_Chi_Minh to start-of-day or end-of-day ISO string.
 */
export function vietnamDateToIsoBoundary(dateStr: string, boundary: "start" | "end"): string {
	const suffix = boundary === "start" ? "T00:00:00.000+07:00" : "T23:59:59.999+07:00";
	return new Date(`${dateStr}${suffix}`).toISOString();
}

/**
 * Converts a period preset into start-of-day / end-of-day ISO boundaries in Asia/Ho_Chi_Minh.
 * Always returns BOTH `from` and `to`.
 */
export function resolveVietnamPresetRange(
	preset: Exclude<HostAnalyticsPeriodPreset, "custom">,
	now: Date = new Date()
): { from: string; to: string; fromDate: string; toDate: string } {
	const { year, month, day } = getVietnamDateParts(now);
	const anchorUtc = new Date(Date.UTC(year, month - 1, day));
	const startUtc = new Date(anchorUtc.getTime());

	switch (preset) {
		case "30d":
			startUtc.setUTCDate(startUtc.getUTCDate() - 29);
			break;
		case "90d":
			startUtc.setUTCDate(startUtc.getUTCDate() - 89);
			break;
		case "6m":
			startUtc.setUTCMonth(startUtc.getUTCMonth() - 6);
			break;
		case "12m":
			startUtc.setUTCMonth(startUtc.getUTCMonth() - 12);
			break;
	}

	const toDate = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
	const fromDate = `${String(startUtc.getUTCFullYear()).padStart(4, "0")}-${String(startUtc.getUTCMonth() + 1).padStart(2, "0")}-${String(startUtc.getUTCDate()).padStart(2, "0")}`;

	return {
		from: vietnamDateToIsoBoundary(fromDate, "start"),
		to: vietnamDateToIsoBoundary(toDate, "end"),
		fromDate,
		toDate,
	};
}

export function formatVnd(amount: number): string {
	return `${Math.round(amount).toLocaleString("vi-VN")} đ`;
}

export function formatSuggestedPrice(amount: number | null): string {
	if (amount === null) return "Chưa đủ lịch sử giá";
	return `khoảng ${Math.round(amount).toLocaleString("vi-VN")} đ/người`;
}

export function formatMonthVi(monthKey: string): string {
	const [year, month] = monthKey.split("-");
	if (!year || !month) return monthKey;
	return `Tháng ${Number(month)}/${year}`;
}

export function formatShortDateVi(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return iso;
	return new Intl.DateTimeFormat("vi-VN", {
		timeZone: VIETNAM_TIMEZONE,
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	}).format(date);
}
