import { HttpError } from "../../../core/api";
import type { StatusBadgeTone } from "../../../shared/components/StatusBadge";
import type { WeatherAlertUrgency, WeatherDecision } from "../types";

export const WEATHER_DECISION_LABELS: Record<WeatherDecision, string> = {
	keep: "Giữ",
	reschedule: "Dời lịch",
	cancel: "Huỷ vì thời tiết",
	pause: "Tạm dừng",
	resume: "Mở lại",
};

export const WEATHER_URGENCY_LABELS: Record<WeatherAlertUrgency, string> = {
	normal: "Cần xử lý",
	urgent: "Khẩn",
	critical: "Khẩn cấp",
};

export const WEATHER_URGENCY_TONES: Record<WeatherAlertUrgency, StatusBadgeTone> = {
	normal: "info",
	urgent: "warning",
	critical: "danger",
};

/** The Host's T-24h deadline (policy §5.2); a later Host decision is recorded as late. */
export const WEATHER_HOST_DEADLINE_MS = 24 * 60 * 60 * 1000;

export function isPastHostDeadline(startsAt: string, now: Date = new Date()): boolean {
	return new Date(startsAt).getTime() - now.getTime() <= WEATHER_HOST_DEADLINE_MS;
}

/** Server messages of the CTMS-98 API mapped to the Vietnamese shown in the UI. */
const SERVER_MESSAGES: Array<[RegExp, string]> = [
	[/within 3 days/i, "Chỉ quyết định thời tiết khi còn tối đa 3 ngày tới giờ đi."],
	[/not Red/i, "Dự báo mới nhất cho ngày đi không còn Đỏ."],
	[/Admin has already decided/i, "Admin đã xử lý Trip này, Host không quyết định thêm."],
	[/already started/i, "Trip đã khởi hành."],
	[/Only a published Trip/i, "Trip không còn ở trạng thái mở bán."],
	[/already paused/i, "Trip đang được tạm dừng."],
	[/not paused/i, "Trip không ở trạng thái tạm dừng."],
	[/safety plan/i, "Cần nhập phương án an toàn khi giữ Trip đang dự báo Đỏ."],
	[/startsAt is required/i, "Cần chọn thời gian bắt đầu mới để dời lịch."],
	[
		/not rescheduled because of the weather/i,
		"Lần dời lịch này không phải vì thời tiết nên không áp dụng hoàn 100%. Vui lòng liên hệ Host.",
	],
	[/not waiting for a reschedule answer/i, "Đơn đặt chỗ này không còn chờ bạn trả lời."],
	[/no longer open for a reschedule answer/i, "Trip không còn nhận trả lời về lịch mới."],
];

function serverMessageText(error: HttpError): string | null {
	const data = error.errorData;
	if (typeof data !== "object" || data === null || !("message" in data)) return null;
	const message = (data as { message?: unknown }).message;
	if (typeof message === "string") return message;
	if (Array.isArray(message)) {
		return message
			.flatMap((item) => {
				if (typeof item === "string") return [item];
				if (typeof item === "object" && item !== null && "errors" in item) {
					const errors = (item as { errors?: unknown }).errors;
					return Array.isArray(errors)
						? errors.filter((e): e is string => typeof e === "string")
						: [];
				}
				return [];
			})
			.join(". ");
	}
	return null;
}

export function weatherDecisionErrorMessage(error: unknown): string {
	if (!(error instanceof HttpError)) return "Không gửi được yêu cầu. Vui lòng thử lại.";
	const text = serverMessageText(error) ?? "";
	for (const [pattern, vietnamese] of SERVER_MESSAGES) {
		if (pattern.test(text)) return vietnamese;
	}
	if (error.status === 403) return "Bạn không có quyền thực hiện thao tác này.";
	if (error.status === 404) return "Không tìm thấy Trip hoặc đơn đặt chỗ.";
	if (error.status === 422) {
		return text ? `Dữ liệu chưa hợp lệ: ${text}` : "Dữ liệu chưa hợp lệ. Vui lòng kiểm tra lại.";
	}
	if (error.status === 409) return "Trạng thái Trip đã thay đổi. Vui lòng tải lại.";
	return "Không gửi được yêu cầu. Vui lòng thử lại.";
}

export function toDateTimeLocalValue(value: string): string {
	const date = new Date(value);
	const offsetMs = date.getTimezoneOffset() * 60_000;
	return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function fromDateTimeLocalValue(value: string): string {
	return new Date(value).toISOString();
}
