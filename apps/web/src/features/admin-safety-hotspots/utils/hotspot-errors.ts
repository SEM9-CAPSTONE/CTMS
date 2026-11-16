import { HttpError } from "../../../core/api";

const CODE_MESSAGES: Record<string, string> = {
	HOTSPOT_NOT_CONFIRMED:
		"Điểm nóng này không còn ở trạng thái đã xác nhận nên chưa thể cập nhật dữ liệu an toàn.",
	ROUTE_CLOSED: "Tuyến đã đóng nên không thể cập nhật dữ liệu an toàn.",
	TARGET_NOT_ON_ROUTE: "Điểm dừng hoặc vùng nguy hiểm đã chọn không còn thuộc tuyến này.",
	HOTSPOT_NOT_FOUND: "Không tìm thấy điểm nóng này.",
};

const STATUS_MESSAGES: Record<number, string> = {
	401: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
	403: "Bạn không có quyền cập nhật dữ liệu an toàn.",
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
