import { HttpError } from "../../../core/api";
import type { ReportError } from "../types";

export function reportError(error: unknown): ReportError {
	const messages: Record<number, string> = {
		401: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
		403: "Bạn không có quyền xử lý báo cáo nội dung.",
		404: "Báo cáo không còn tồn tại hoặc không tìm thấy.",
		409: "Trạng thái báo cáo đã thay đổi hoặc thao tác không còn hợp lệ. Dữ liệu đang được tải lại.",
		422: "Dữ liệu gửi lên không hợp lệ. Vui lòng tải lại và kiểm tra trước khi thử lại.",
	};
	return error instanceof HttpError
		? {
				status: error.status,
				message: messages[error.status] ?? "Không thể xử lý yêu cầu. Vui lòng thử lại.",
			}
		: { message: "Không thể kết nối đến hệ thống. Vui lòng thử lại." };
}
