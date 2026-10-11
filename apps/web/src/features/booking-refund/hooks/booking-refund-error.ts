import { HttpError } from "../../../core/api";
import type { RefundError } from "../types";

export function mapBookingRefundError(error: unknown): RefundError {
	if (!(error instanceof HttpError)) {
		return {
			kind: "retryable",
			message: "Không thể kết nối đến máy chủ. Dữ liệu của bạn được giữ nguyên, vui lòng thử lại.",
			canRetry: true,
		};
	}

	if (error.status >= 500) {
		return {
			kind: "retryable",
			message: "Máy chủ gặp sự cố tạm thời. Dữ liệu của bạn được giữ nguyên, vui lòng thử lại sau.",
			canRetry: true,
		};
	}

	const rawMessage = error.message || "";

	switch (error.status) {
		case 401:
		case 403:
			return {
				kind: "forbidden",
				message: "Bạn không có quyền thực hiện yêu cầu hoàn tiền cho đơn đặt chỗ này.",
				canRetry: false,
			};
		case 404:
			return {
				kind: "not_found",
				message: "Không tìm thấy thông tin đơn đặt chỗ hoặc khoản thanh toán.",
				canRetry: false,
			};
		case 409: {
			const lower = rawMessage.toLowerCase();
			if (lower.includes("window")) {
				return {
					kind: "conflict_window",
					message:
						"Yêu cầu nằm ngoài khung thời gian chính sách cho phép (trong vòng 24h sau chuyến đi hoặc trước khi khởi hành).",
					canRetry: false,
				};
			}
			if (lower.includes("exceeds") || lower.includes("cap") || lower.includes("cumulative")) {
				return {
					kind: "conflict_cap",
					message: "Số tiền hoàn yêu cầu vượt quá số tiền có thể hoàn của đơn đặt chỗ.",
					canRetry: true,
				};
			}
			if (lower.includes("provider")) {
				return {
					kind: "provider_error",
					message:
						"Đối tác thanh toán xử lý thất bại hoặc tạm thời không phản hồi. Bạn có thể gửi lại yêu cầu.",
					canRetry: true,
				};
			}
			return {
				kind: "conflict_window",
				message:
					rawMessage ||
					"Xung đột dữ liệu hoặc trạng thái không hợp lệ. Vui lòng tải lại và thử lại.",
				canRetry: true,
			};
		}
		case 422:
			return {
				kind: "validation",
				message: rawMessage || "Thông tin yêu cầu hoàn tiền không hợp lệ. Vui lòng kiểm tra lại.",
				canRetry: false,
			};
		default:
			return {
				kind: "unexpected",
				message: rawMessage || "Đã xảy ra lỗi không xác định. Vui lòng thử lại sau.",
				canRetry: true,
			};
	}
}
