import { HttpError } from "../../../core/api";
import type { BookingPaymentError } from "../types";

interface BackendFieldError {
	field?: unknown;
	errors?: unknown;
}

function extractFieldErrors(errorData: unknown): Record<string, string> {
	if (typeof errorData !== "object" || errorData === null || !("message" in errorData)) {
		return {};
	}
	const message = (errorData as { message?: unknown }).message;
	if (!Array.isArray(message)) return {};

	return message.reduce<Record<string, string>>((accumulator, item) => {
		if (typeof item !== "object" || item === null) return accumulator;
		const issue = item as BackendFieldError;
		if (typeof issue.field !== "string" || !Array.isArray(issue.errors)) return accumulator;
		const firstError = issue.errors.find((val): val is string => typeof val === "string");
		if (firstError) {
			accumulator[issue.field] = firstError;
		}
		return accumulator;
	}, {});
}

function extractBackendMessage(error: HttpError): string | null {
	if (
		typeof error.errorData !== "object" ||
		error.errorData === null ||
		!("message" in error.errorData)
	) {
		return null;
	}
	const message = (error.errorData as { message?: unknown }).message;
	if (typeof message === "string") return message;
	return null;
}

export function mapBookingPaymentError(error: unknown): BookingPaymentError {
	if (!(error instanceof HttpError)) {
		return {
			message: "Không thể kết nối đến hệ thống thanh toán. Vui lòng kiểm tra mạng và thử lại.",
			isConflict: false,
			canRetry: true,
			fieldErrors: {},
		};
	}

	const detail = extractBackendMessage(error);
	const fieldErrors = extractFieldErrors(error.errorData);
	const isConflict = error.status === 409;
	const canRetry = error.status >= 500;

	const statusDefaults: Record<number, string> = {
		401: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
		403: "Chỉ người đặt chỗ mới có quyền thanh toán cho đặt chỗ này.",
		404: "Không tìm thấy thông tin đặt chỗ.",
		409: "Đặt chỗ không ở trạng thái có thể thanh toán hoặc giao dịch bị xung đột.",
		422: "Thông tin thanh toán không hợp lệ.",
	};

	return {
		status: error.status,
		message:
			detail || statusDefaults[error.status] || "Không thể xử lý thanh toán. Vui lòng thử lại.",
		isConflict,
		canRetry,
		fieldErrors,
	};
}
