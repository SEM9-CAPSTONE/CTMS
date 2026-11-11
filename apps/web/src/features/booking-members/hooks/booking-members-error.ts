import { HttpError } from "../../../core/api";
import type { BookingMembersError } from "../types";

interface BackendFieldError {
	field?: unknown;
	errors?: unknown;
}

export function localizeBookingMembersMessage(message: unknown, status: number): string {
	if (typeof message !== "string") {
		const defaults: Record<number, string> = {
			401: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
			403: "Bạn không có quyền cập nhật người tham gia cho đặt chỗ này.",
			404: "Không tìm thấy người tham gia đủ điều kiện.",
			409: "Trạng thái đặt chỗ đã thay đổi. Vui lòng kiểm tra lại.",
			422: "Thông tin người tham gia chưa hợp lệ.",
		};
		return defaults[status] ?? "Không thể cập nhật người tham gia.";
	}

	const lower = message.toLowerCase();

	if (lower.includes("eligible participant not found")) {
		return "Không tìm thấy người tham gia phù hợp với email này (người dùng phải có tài khoản và đang hoạt động).";
	}
	if (lower.includes("booking owner is added automatically") || lower.includes("owner is added")) {
		return "Người đặt chỗ chính được hệ thống tự động thêm, không cần nhập lại.";
	}
	if (lower.includes("booking does not require additional participants")) {
		return "Đặt chỗ này không yêu cầu thêm người tham gia.";
	}
	if (lower.includes("roster is already initialized") || lower.includes("already initialized")) {
		return "Danh sách người tham gia đã được xác nhận trước đó.";
	}
	if (lower.includes("already has member rows")) {
		return "Đặt chỗ đã có danh sách người tham gia.";
	}
	if (lower.includes("trip has already started")) {
		return "Chuyến đi này đã khởi hành, không thể chỉnh sửa người tham gia.";
	}
	if (lower.includes("cannot appear more than once")) {
		return "Mỗi người tham gia chỉ được xuất hiện một lần trong danh sách.";
	}
	if (lower.includes("confirmed in another booking")) {
		return "Người tham gia này đã được xác nhận trong một đặt chỗ khác cho chuyến đi.";
	}
	if (lower.includes("overlapping trip")) {
		return "Người tham gia này đã có lịch trình tham gia một chuyến đi khác trùng thời gian.";
	}
	if (lower.includes("not eligible for member initialization")) {
		return "Đặt chỗ không ở trạng thái hợp lệ để cập nhật người tham gia.";
	}
	if (
		lower.includes("inconsistent with trip capacity") ||
		lower.includes("reservation is inconsistent")
	) {
		return "Số chỗ giữ không còn khớp với chuyến đi (đơn đặt chỗ có thể đã hết hạn hoặc bị hủy).";
	}
	if (lower.includes("booking not found")) {
		return "Không tìm thấy thông tin đặt chỗ.";
	}
	if (lower.includes("trip not found")) {
		return "Không tìm thấy thông tin chuyến đi.";
	}
	if (lower.includes("only the booking owner")) {
		return "Chỉ người đặt chỗ mới có quyền cập nhật danh sách người tham gia.";
	}

	const fallbackDefaults: Record<number, string> = {
		401: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
		403: "Bạn không có quyền cập nhật người tham gia cho đặt chỗ này.",
		404: "Không tìm thấy người tham gia đủ điều kiện.",
		409: "Trạng thái đặt chỗ đã thay đổi hoặc không hợp lệ. Vui lòng kiểm tra lại.",
		422: "Thông tin người tham gia chưa hợp lệ.",
	};
	return fallbackDefaults[status] ?? "Không thể cập nhật người tham gia. Vui lòng thử lại sau.";
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

	const message = localizeBookingMembersMessage(body.message, error.status);

	return {
		status: error.status,
		message,
		isConflict: error.status === 409,
		canRetry: error.status >= 500,
		fieldErrors,
	};
}
