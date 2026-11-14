export const DEPARTURE_REASON_LABELS: Record<string, string> = {
	PACKAGE_TRIP_MISMATCH: "Gói không thuộc chuyến này.",
	PACKAGE_HASH_MISMATCH: "Gói bị lỗi. Đề nghị người hỗ trợ tải lại.",
	PACKAGE_ARTIFACT_UNAVAILABLE: "Chưa có gói dùng được. Kiểm tra lại dữ liệu chuyến đi.",
	PACKAGE_UPDATE_REQUIRED: "Người hỗ trợ cần tải bản bắt buộc trước.",
	PACKAGE_VERSION_LOCKED: "Đang dùng bản đã khóa cho chuyến này.",
	PACKAGE_TRIP_NOT_PUBLISHED: "Chuyến này không còn cho phép thay gói.",
	DEPARTURE_RESPONSIBLE_PORTER_REQUIRED: "Chỉ người hỗ trợ được phân công mới được xác nhận.",
	PACKAGE_ACTIVATION_REQUIRED: "Người hỗ trợ cần kích hoạt gói trên thiết bị.",
	PACKAGE_DEPARTURE_NOT_READY: "Người hỗ trợ cần xác nhận gói trước khi đi.",
	SOURCE_FRESHNESS_UNAVAILABLE: "Chưa biết dữ liệu có còn mới không.",
	PACKAGE_SOURCE_EXPIRED: "Dữ liệu đã hết hạn. Cần kiểm tra lại trước khi đi.",
	NO_REQUIRED_PACKAGE: "Chuyến này không yêu cầu gói bắt buộc.",
	PACKAGE_DEPARTURE_READY: "Thiết bị phụ trách đã được xác nhận.",
};
export function departureReasonLabel(code: string): string {
	return DEPARTURE_REASON_LABELS[code] ?? "Chưa thể khởi hành, vui lòng liên hệ chủ chuyến";
}
const formatter = new Intl.DateTimeFormat("vi-VN", {
	timeZone: "Asia/Ho_Chi_Minh",
	day: "2-digit",
	month: "2-digit",
	year: "numeric",
	hour: "2-digit",
	minute: "2-digit",
	hourCycle: "h23",
});
export function departureTime(value: string): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "Chưa xác định";
	const parts = formatter.formatToParts(date);
	const part = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((item) => item.type === type)?.value ?? "";
	return `${part("day")}/${part("month")}/${part("year")} ${part("hour")}:${part("minute")}`;
}
