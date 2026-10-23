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

const conflictMessages: Record<string, string> = {
	"Unsupported cancellation policy snapshot":
		"Đơn đặt chỗ thiếu chính sách hủy hợp lệ đã lưu. Vui lòng liên hệ quản trị viên để kiểm tra dữ liệu đơn.",
	"Booking must have one unambiguous eligible succeeded charge":
		"Đơn được đánh dấu đã thanh toán nhưng chưa có giao dịch thanh toán hợp lệ. Vui lòng liên hệ quản trị viên kiểm tra.",
	"Trip has already started":
		"Chuyến đi đã khởi hành nên không thể hủy theo chính sách trước chuyến.",
	"Trip is no longer open for pre-departure cancellation":
		"Chuyến đi đã khởi hành hoặc không còn ở trạng thái cho phép hủy trước chuyến.",
	"Booking is not eligible for ordinary cancellation":
		"Trạng thái đơn hiện tại không cho phép hủy. Vui lòng tải lại thông tin đơn.",
	"Booking seat reservation is inconsistent with Trip capacity":
		"Số chỗ đã giữ của đơn chưa khớp dữ liệu chuyến. Vui lòng liên hệ quản trị viên kiểm tra.",
};
function conflictMessage(data: unknown): string | undefined {
	if (
		typeof data !== "object" ||
		data === null ||
		!("message" in data) ||
		typeof data.message !== "string"
	)
		return;
	return conflictMessages[data.message];
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
					conflictMessage(error.errorData) ??
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
