import { HttpError } from "../../../core/api";

export function mapAdminUserAccountsError(error: unknown): string {
	if (!(error instanceof HttpError)) {
		return "Không thể kết nối đến hệ thống. Vui lòng thử lại.";
	}
	if (error.status === 401) {
		return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
	}
	if (error.status === 403) {
		return "Bạn không có quyền quản lý tài khoản người dùng.";
	}
	if (error.status === 404) {
		return "Không tìm thấy tài khoản người dùng.";
	}
	if (error.status === 409) {
		return "Trạng thái tài khoản đã thay đổi. Vui lòng tải lại và thử lại.";
	}
	if (error.status === 422) {
		return "Dữ liệu gửi lên không hợp lệ. Vui lòng kiểm tra lại.";
	}
	return error.message || "Không thể xử lý yêu cầu. Vui lòng thử lại.";
}
