import { HttpError } from "../../../core/api";
import type { MemberStatusError } from "../types";

export function mapMemberStatusError(error: unknown): MemberStatusError {
	if (!(error instanceof HttpError) || error.status >= 500) {
		return {
			kind: "retryable",
			message: "Chưa xác nhận được kết quả cập nhật. Hãy tải lại danh sách trước khi thử lại.",
			canRetry: true,
		};
	}

	switch (error.status) {
		case 401:
			return {
				kind: "unauthenticated",
				status: 401,
				message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
				canRetry: false,
			};
		case 403:
			return {
				kind: "forbidden",
				status: 403,
				message: "Bạn không còn quyền cập nhật danh sách thành viên của chuyến đi này.",
				canRetry: false,
			};
		case 404:
			return {
				kind: "not_found",
				status: 404,
				message:
					"Thành viên hoặc đơn đặt chỗ không còn khả dụng. Danh sách mới nhất đã được tải lại.",
				canRetry: false,
			};
		case 409:
			return {
				kind: "conflict",
				status: 409,
				message:
					"Danh sách đã thay đổi hoặc thao tác không còn khả dụng. Dữ liệu mới nhất đã được tải lại.",
				canRetry: false,
			};
		case 422:
			return {
				kind: "validation",
				status: 422,
				message: "Yêu cầu cập nhật trạng thái không hợp lệ.",
				canRetry: false,
			};
		default:
			return {
				kind: "retryable",
				status: error.status,
				message: "Không thể cập nhật trạng thái thành viên. Vui lòng thử lại.",
				canRetry: true,
			};
	}
}
