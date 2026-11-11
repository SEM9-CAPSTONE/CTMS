import { PROFICIENCY_LABELS } from "../porter-profile/constants";
import type { PorterLevel } from "./types";
import type { LevelPolicy } from "./types";

export function levelName(level: PorterLevel, policies: LevelPolicy[] = []): string {
	return (
		policies.find((policy) => policy.level === level)?.definition.name ?? PROFICIENCY_LABELS[level]
	);
}
export const ADMIN_LEVEL_TABS = {
	requests: "Yêu cầu nâng cấp",
	direct: "Xét cấp trực tiếp",
	policies: "Tiêu chí cấp độ",
} as const;

export const LEVEL_CODES: PorterLevel[] = ["learning", "proficient", "expert"];
export const LEVEL_QUERY_STALE_TIME = 60_000;
export const LEVEL_PANEL_CLASS = "rounded-[28px] border border-[#dfe8df] bg-white p-6 shadow-sm";
export const LEVEL_INPUT_CLASS =
	"w-full rounded-xl border border-[#dfe8df] bg-white px-3 py-2 text-sm";
export function levelReviewError(error: unknown): string {
	if (
		error &&
		typeof error === "object" &&
		"errorData" in error &&
		error.errorData &&
		typeof error.errorData === "object" &&
		"code" in error.errorData &&
		"message" in error.errorData &&
		typeof error.errorData.message === "string"
	)
		return error.errorData.message;
	if (error && typeof error === "object" && "status" in error && error.status === 409) {
		return "Dữ liệu hoặc tiêu chí đã thay đổi. Tải lại hồ sơ và đối chiếu lại trước khi lưu; nội dung đang nhập được giữ nguyên.";
	}
	return error instanceof Error
		? error.message
		: "Không thể tải hoặc lưu cấp độ Porter. Vui lòng thử lại.";
}

export const REQUEST_STATUS_LABELS = {
	pending: "Chờ duyệt",
	needs_info: "Cần bổ sung",
	approved: "Đã duyệt",
	rejected: "Từ chối",
	cancelled: "Đã hủy",
} as const;

export function openLevelRequestId(error: unknown): string | null {
	if (!error || typeof error !== "object" || !("errorData" in error)) return null;
	const data = error.errorData;
	if (
		data &&
		typeof data === "object" &&
		"code" in data &&
		data.code === "OPEN_REQUEST_EXISTS" &&
		"requestId" in data &&
		typeof data.requestId === "string"
	)
		return data.requestId;
	return null;
}
export const REQUEST_ACTION_LABELS = {
	approved: "Đã duyệt",
	rejected: "Từ chối",
	needs_info: "Cần bổ sung",
	upgrade: "Nâng cấp",
	downgrade: "Hạ cấp",
	recognize: "Công nhận cấp",
} as const;
