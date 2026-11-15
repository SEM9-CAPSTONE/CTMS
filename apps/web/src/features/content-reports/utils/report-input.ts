import { HttpError } from "../../../core/api";
import { REPORT_LIMIT } from "../constants";
// class-validator MaxLength uses Unicode code points, after the DTO trims the value.
export const reportLength = (value: string) => Array.from(value.trim()).length;
export function descriptionError(value: string): string | null {
	if (!value.trim()) return "Vui lòng mô tả nội dung cần xem xét.";
	if (value.includes("\u0000")) return "Mô tả chứa ký tự không hợp lệ.";
	if (reportLength(value) > REPORT_LIMIT) return "Mô tả không được vượt quá 1.000 ký tự.";
	return null;
}
export function reportErrorCode(error: unknown): string | undefined {
	if (!(error instanceof HttpError)) return undefined;
	const data = error.errorData;
	return data && typeof data === "object" && "code" in data && typeof data.code === "string"
		? data.code
		: undefined;
}
export function reportErrorMessage(error: unknown): string {
	if (reportErrorCode(error) === "REPORT_IDEMPOTENCY_CONFLICT")
		return "Không gửi được báo cáo này. Vui lòng thử lại.";
	if (error instanceof HttpError) {
		if (error.status === 401)
			return "Phiên đăng nhập đã hết hạn. Bản nháp được giữ lại để bạn tiếp tục sau khi đăng nhập.";
		if (error.status === 404) return "Không thể báo cáo nội dung này.";
		if (error.status === 403) return "Bạn không thể thực hiện thao tác này.";
		if (error.status === 400 || error.status === 422)
			return "Thông tin báo cáo chưa hợp lệ. Vui lòng kiểm tra và gửi lại.";
	}
	return "Chưa xác nhận được kết quả gửi. Nội dung được giữ lại; bạn có thể thử lại.";
}
