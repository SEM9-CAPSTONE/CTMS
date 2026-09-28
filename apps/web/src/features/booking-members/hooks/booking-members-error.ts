import { HttpError } from "../../../core/api";
import type { BookingMembersError } from "../types";

interface BackendFieldError {
	field?: unknown;
	errors?: unknown;
}

export function mapBookingMembersError(error: unknown): BookingMembersError {
	if (!(error instanceof HttpError)) {
		return {
			message: "Không thể kết nối đến hệ thống. Vui lòng thử lại.",
			isConflict: false,
			canRetry: true,
			fieldErrors: {},
		};
	}
	const body =
		typeof error.errorData === "object" && error.errorData !== null
			? (error.errorData as { message?: unknown })
			: {};
	const issues = Array.isArray(body.message) ? body.message : [];
	const fieldErrors = issues.reduce<Record<string, string>>((result, item) => {
		if (typeof item !== "object" || item === null) return result;
		const issue = item as BackendFieldError;
		const first = Array.isArray(issue.errors)
			? issue.errors.find((value): value is string => typeof value === "string")
			: undefined;
		if (typeof issue.field === "string" && first) result[issue.field] = first;
		return result;
	}, {});
	const defaults: Record<number, string> = {
		401: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
		403: "Bạn không có quyền cập nhật người tham gia cho đặt chỗ này.",
		404: "Không tìm thấy người tham gia đủ điều kiện.",
		409: "Trạng thái đặt chỗ đã thay đổi. Vui lòng kiểm tra lại.",
		422: "Thông tin người tham gia chưa hợp lệ.",
	};
	return {
		status: error.status,
		message:
			typeof body.message === "string"
				? body.message
				: (defaults[error.status] ?? "Không thể cập nhật người tham gia."),
		isConflict: error.status === 409,
		canRetry: error.status >= 500,
		fieldErrors,
	};
}
