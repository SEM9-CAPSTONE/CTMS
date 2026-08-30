import { HttpError } from "../../../core/api";

/**
 * CTMS-17-T02. Maps `GET /campsites`' real error responses (verified live
 * against the running CTMS-77 backend) to Vietnamese messages -- one
 * bucket per status code, not per exact backend message string, since the
 * backend itself already uses more than one `message` for the same status
 * (a missing/malformed token → `{"message":"Unauthorized",...}`; an
 * inactive account → `{"message":"Authentication required",...}` -- both
 * 401, and the distinction isn't meaningful to a Camper here).
 *
 * Deliberately NOT a duplicate of `AppRoleGuard`'s route-level permission
 * check: `AppRoleGuard` decides whether this page mounts AT ALL, from
 * locally-stored auth state, before any request happens. This function
 * only ever runs AFTER that gate was already passed -- a 401/403 reaching
 * here means the session/role became invalid *during* use (expired,
 * revoked, or the account was deactivated mid-session), never the
 * "not logged in yet" case `AppRoleGuard` already owns.
 */
export function mapCampsitesError(error: unknown): string {
	if (!(error instanceof HttpError)) {
		return "Không thể kết nối đến hệ thống. Vui lòng thử lại.";
	}
	if (error.status === 401) {
		return "Phiên đăng nhập đã hết hạn hoặc tài khoản không còn hoạt động. Vui lòng đăng nhập lại.";
	}
	if (error.status === 403) {
		return "Bạn không có quyền tìm kiếm khu cắm trại.";
	}
	if (error.status === 422) {
		return "Bộ lọc tìm kiếm không hợp lệ. Vui lòng kiểm tra lại.";
	}
	return error.message || "Không thể xử lý yêu cầu. Vui lòng thử lại.";
}

export function mapCampsiteDetailError(error: unknown): string {
	if (!(error instanceof HttpError)) {
		return "Không thể kết nối đến hệ thống. Vui lòng thử lại.";
	}
	if (error.status === 401) {
		return "Phiên đăng nhập đã hết hạn hoặc tài khoản không còn hoạt động. Vui lòng đăng nhập lại.";
	}
	if (error.status === 403) {
		return "Bạn không có quyền xem chi tiết khu cắm trại.";
	}
	if (error.status === 404) {
		return "Không tìm thấy khu cắm trại hoặc khu cắm trại không hoạt động.";
	}
	return error.message || "Không thể tải thông tin chi tiết khu cắm trại. Vui lòng thử lại.";
}
