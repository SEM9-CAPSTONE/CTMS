import { HttpError } from "../../../core/api";
import type { BookingCancellationError } from "../types";

function reasonError(data: unknown): string | undefined {
	if (
		typeof data !== "object" ||
		data === null ||
		!("message" in data) ||
		!Array.isArray(data.message)
	)
		return;
	for (const issue of data.message) {
		if (
			typeof issue === "object" &&
			issue !== null &&
			"field" in issue &&
			issue.field === "reason" &&
			"errors" in issue &&
			Array.isArray(issue.errors)
		) {
			return issue.errors.find(
				(message: unknown): message is string => typeof message === "string"
			);
		}
	}
}

export function mapBookingCancellationError(error: unknown): BookingCancellationError {
	if (!(error instanceof HttpError) || error.status >= 500)
		return {
			kind: "uncertain",
			message:
				"Chưa xác nhận được kết quả hủy. Yêu cầu có thể đã được xử lý. Bạn có thể tải lại hoặc gửi lại yêu cầu an toàn.",
		};
	switch (error.status) {
		case 401:
			return {
				kind: "unauthenticated",
				message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
			};
		case 403:
			return { kind: "forbidden", message: "Bạn không có quyền hủy đơn đặt chỗ này." };
		case 404:
			return {
				kind: "not_found",
				message: "Đơn đặt chỗ không còn khả dụng. Vui lòng quay lại danh sách.",
			};
		case 409:
			return {
				kind: "conflict",
				message:
					"Máy chủ chưa chấp nhận hủy do trạng thái, chính sách hoặc dữ liệu liên quan. Hãy tải lại thông tin và cân nhắc trước khi gửi lại.",
			};
		case 422:
			return {
				kind: "validation",
				message: "Mã đơn hoặc thông tin hủy không hợp lệ. Vui lòng kiểm tra lại.",
				reasonError: reasonError(error.errorData),
			};
		default:
			return {
				kind: "unexpected",
				message: "Máy chủ không chấp nhận yêu cầu hủy. Vui lòng tải lại thông tin.",
			};
	}
}
