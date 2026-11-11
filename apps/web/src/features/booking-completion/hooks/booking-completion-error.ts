import { HttpError } from "../../../core/api";
import type { BookingCompletionError } from "../types";

export function mapBookingCompletionError(error: unknown): BookingCompletionError {
	if (!(error instanceof HttpError) || error.status >= 500) {
		return {
			kind: "uncertain",
			message: "Hệ thống gặp sự cố khi xử lý hoàn tất đơn đặt chỗ. Vui lòng thử lại sau.",
			canRetry: true,
		};
	}

	switch (error.status) {
		case 401:
			return {
				kind: "unauthenticated",
				message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
				canRetry: false,
			};
		case 403:
			return {
				kind: "forbidden",
				message: "Bạn không có quyền thực hiện thao tác hoàn tất đơn đặt chỗ này.",
				canRetry: false,
			};
		case 404:
			return {
				kind: "not_found",
				message: "Đơn đặt chỗ hoặc chuyến đi không tồn tại.",
				canRetry: false,
			};
		case 409: {
			let msg = "Không thể hoàn tất đơn đặt chỗ do trạng thái hiện tại chưa thỏa mãn điều kiện.";
			if (
				typeof error.errorData === "object" &&
				error.errorData !== null &&
				"message" in error.errorData
			) {
				const raw = (error.errorData as { message?: unknown }).message;
				if (typeof raw === "string") {
					msg = raw;
				} else if (Array.isArray(raw) && typeof raw[0] === "string") {
					msg = raw[0];
				}
			}
			return {
				kind: "conflict",
				message: msg,
				canRetry: false,
			};
		}
		case 422:
			return {
				kind: "validation",
				message: "Dữ liệu yêu cầu không hợp lệ. Vui lòng kiểm tra lại.",
				canRetry: false,
			};
		default:
			return {
				kind: "uncertain",
				message: "Thao tác hoàn tất chưa thành công. Vui lòng thử lại.",
				canRetry: true,
			};
	}
}
