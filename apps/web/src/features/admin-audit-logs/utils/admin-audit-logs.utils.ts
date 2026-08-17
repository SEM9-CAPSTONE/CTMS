import { HttpError } from "../../../core/api";

export function mapAdminAuditLogsError(error: unknown): string {
	if (!(error instanceof HttpError)) {
		return "Không thể kết nối đến hệ thống. Vui lòng thử lại.";
	}
	if (error.status === 401) {
		return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
	}
	if (error.status === 403) {
		return "Bạn không có quyền truy cập hoặc quản lý nhật ký hệ thống.";
	}
	if (error.status === 422) {
		return "Bộ lọc tìm kiếm không hợp lệ. Vui lòng kiểm tra lại.";
	}
	return error.message || "Không thể xử lý yêu cầu. Vui lòng thử lại.";
}
