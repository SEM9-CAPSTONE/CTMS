import { HttpError } from "../../../core/api";
import type { StatusBadgeTone } from "../../../shared/components/StatusBadge";
import type { WeatherPenalty } from "../types";

/** What the UI shows for a penalty, combining its status and its waiver request. */
export type WeatherPenaltyDisplayStatus =
	| "applied"
	| "waiver_pending"
	| "waiver_rejected"
	| "waived";

export const WEATHER_PENALTY_STATUS_LABELS: Record<WeatherPenaltyDisplayStatus, string> = {
	applied: "Đang áp dụng",
	waiver_pending: "Chờ duyệt miễn",
	waiver_rejected: "Bị từ chối miễn",
	waived: "Đã miễn",
};

export const WEATHER_PENALTY_STATUS_TONES: Record<WeatherPenaltyDisplayStatus, StatusBadgeTone> = {
	applied: "danger",
	waiver_pending: "warning",
	waiver_rejected: "neutral",
	waived: "success",
};

export const MAX_EVIDENCE_FILES = 5;
export const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;
export const EVIDENCE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export function penaltyDisplayStatus(penalty: WeatherPenalty): WeatherPenaltyDisplayStatus {
	if (penalty.status === "waived") return "waived";
	if (penalty.waiver.decision === "rejected") return "waiver_rejected";
	if (penalty.waiver.requestedAt) return "waiver_pending";
	return "applied";
}

/** The Host may ask once, before the deadline, for a penalty still applied. */
export function canRequestWaiver(penalty: WeatherPenalty, now: Date = new Date()): boolean {
	return (
		penalty.status === "applied" &&
		!penalty.waiver.requestedAt &&
		new Date(penalty.waiverDeadline).getTime() > now.getTime()
	);
}

export function isReviewOverdue(penalty: WeatherPenalty, now: Date = new Date()): boolean {
	const due = penalty.waiver.reviewDueAt;
	return Boolean(due && !penalty.waiver.decision && new Date(due).getTime() < now.getTime());
}

export function formatPenaltyDateTime(value: string): string {
	return new Date(value).toLocaleString("vi-VN", {
		hour: "2-digit",
		minute: "2-digit",
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	});
}

export function formatPenaltyDate(value: string): string {
	return new Date(value).toLocaleDateString("vi-VN", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	});
}

export function evidenceFileName(url: string): string {
	const last = url.split("?")[0].split("/").pop() ?? url;
	try {
		return decodeURIComponent(last);
	} catch {
		return last;
	}
}

const SERVER_MESSAGES: Array<[RegExp, string]> = [
	[/already requested/i, "Bạn đã gửi yêu cầu miễn phạt cho khoản này."],
	[/window has closed/i, "Đã hết hạn gửi yêu cầu miễn phạt (72 giờ sau mốc 24 giờ trước giờ đi)."],
	[/has not requested a waiver/i, "Host chưa gửi yêu cầu miễn phạt."],
	[/already reviewed/i, "Yêu cầu miễn phạt này đã được xử lý."],
	[/Weather penalty not found/i, "Không tìm thấy khoản phạt."],
	[
		/Định dạng tài liệu không hợp lệ|PDF không hợp lệ/i,
		"File phải là ảnh JPG, PNG, WEBP hoặc PDF.",
	],
	[/File too large|vượt quá dung lượng/i, "Mỗi file tối đa 5MB."],
];

function serverMessageText(error: HttpError): string {
	const data = error.errorData;
	if (typeof data !== "object" || data === null || !("message" in data)) return "";
	const message = (data as { message?: unknown }).message;
	if (typeof message === "string") return message;
	return Array.isArray(message)
		? message.filter((item): item is string => typeof item === "string").join(". ")
		: "";
}

export function weatherPenaltyErrorMessage(error: unknown): string {
	if (!(error instanceof HttpError)) return "Không gửi được yêu cầu. Vui lòng thử lại.";
	const text = serverMessageText(error);
	for (const [pattern, vietnamese] of SERVER_MESSAGES) {
		if (pattern.test(text)) return vietnamese;
	}
	if (error.status === 403) return "Bạn không có quyền thực hiện thao tác này.";
	if (error.status === 404) return "Không tìm thấy khoản phạt.";
	if (error.status === 409) return "Trạng thái khoản phạt đã thay đổi. Vui lòng tải lại.";
	if (error.status === 422) return "Dữ liệu chưa hợp lệ. Vui lòng kiểm tra lại.";
	return "Không gửi được yêu cầu. Vui lòng thử lại.";
}

/**
 * 403 from Trip create / submit while a weather penalty blocks the Host (CTMS-94): the body has
 * `blockedUntil`. Returns the Vietnamese message, or null for any other error.
 */
export function hostingBlockedMessage(error: unknown): string | null {
	if (!(error instanceof HttpError) || error.status !== 403) return null;
	const data = error.errorData;
	if (typeof data !== "object" || data === null || !("blockedUntil" in data)) return null;
	const until = (data as { blockedUntil?: unknown }).blockedUntil;
	if (typeof until !== "string") return null;
	const message = (data as { message?: unknown }).message;
	const suspended = typeof message === "string" && /suspended/i.test(message);
	return suspended
		? `Bạn đang bị đình chỉ tạo Trip do vi phạm quy định thời tiết nhiều lần, đến ${formatPenaltyDate(until)}.`
		: `Bạn đang bị khoá tạo Trip do phạt thời tiết đến ${formatPenaltyDate(until)}.`;
}
