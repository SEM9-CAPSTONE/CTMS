import { HttpError } from "../../../core/api";

const CODE_MESSAGES: Record<string, string> = {
	HOTSPOT_HAS_CORRECTIONS:
		"Điểm nóng này đã được dùng để cập nhật dữ liệu an toàn của tuyến nên không thể xóa.",
	HOTSPOT_NOT_FOUND: "Không tìm thấy điểm nóng này.",
	INVALID_TRANSITION: "Điểm nóng đã được người khác xử lý. Vui lòng tải lại danh sách.",
};

const STATUS_MESSAGES: Record<number, string> = {
	401: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
	403: "Bạn không có quyền thực hiện thao tác này.",
	404: "Không tìm thấy điểm nóng hoặc dữ liệu liên quan.",
	409: "Dữ liệu đã thay đổi. Vui lòng tải lại và thử lại.",
	422: "Thông tin chưa hợp lệ. Vui lòng kiểm tra lại các trường đã nhập.",
};

/** Maps API failures to Vietnamese messages; never shows the raw API text. */
export function hotspotErrorMessage(error: unknown): string {
	if (!(error instanceof HttpError)) return "Không thể kết nối đến hệ thống. Vui lòng thử lại.";
	const code =
		typeof error.errorData === "object" && error.errorData !== null
			? (error.errorData as { code?: unknown }).code
			: undefined;
	if (typeof code === "string" && CODE_MESSAGES[code]) return CODE_MESSAGES[code];
	return STATUS_MESSAGES[error.status] ?? "Không thể xử lý yêu cầu. Vui lòng thử lại.";
}
