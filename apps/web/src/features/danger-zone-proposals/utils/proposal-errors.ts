import { HttpError } from "../../../core/api";

const CODE_MESSAGES: Record<string, string> = {
	PROPOSAL_NOT_FOUND: "Không tìm thấy đề xuất này.",
	PROPOSAL_ALREADY_DECIDED: "Đề xuất đã được xử lý. Vui lòng tải lại danh sách.",
	RADIUS_REQUIRED: "Điểm nguy hiểm cần có bán kính ghi nhận.",
	RADIUS_NOT_ALLOWED: "Khu vực nguy hiểm không dùng bán kính.",
};

const STATUS_MESSAGES: Record<number, string> = {
	401: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
	403: "Bạn không có quyền thực hiện thao tác này.",
	404: "Không tìm thấy tuyến hoặc đề xuất.",
	409: "Dữ liệu đã thay đổi. Vui lòng tải lại và thử lại.",
	422: "Thông tin chưa hợp lệ. Vui lòng kiểm tra lại các trường đã nhập.",
};

/** Vietnamese message for an API failure; raw API text is never shown. */
export function proposalErrorMessage(error: unknown): string {
	if (!(error instanceof HttpError)) return "Không thể kết nối đến hệ thống. Vui lòng thử lại.";
	const code =
		typeof error.errorData === "object" && error.errorData !== null
			? (error.errorData as { code?: unknown }).code
			: undefined;
	if (typeof code === "string" && CODE_MESSAGES[code]) return CODE_MESSAGES[code];
	return STATUS_MESSAGES[error.status] ?? "Không thể xử lý yêu cầu. Vui lòng thử lại.";
}

const dateTime = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" });
const date = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short" });
export const formatDateTime = (value: string) => dateTime.format(new Date(value));
export const formatDate = (value: string) => date.format(new Date(value));
