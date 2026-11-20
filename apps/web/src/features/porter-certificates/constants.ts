import type { PorterCertificateStatus, PorterCertificateType } from "./types";

export const CERTIFICATE_TYPE_LABELS: Record<PorterCertificateType, string> = {
	wfa: "Sơ cấp cứu hoang dã (WFA)",
	rescue: "Cứu hộ & Ứng phó khẩn cấp",
	guide_card: "Thẻ hướng dẫn viên du lịch",
	other: "Chứng chỉ chuyên môn khác",
} as const;

export const CERTIFICATE_STATUS_LABELS: Record<PorterCertificateStatus, string> = {
	verified: "Đã xác minh",
	pending: "Chờ duyệt",
	rejected: "Bị từ chối",
} as const;

export const ADMIN_REJECTION_PRESETS = [
	"Ảnh chụp bị mờ hoặc mất góc",
	"Thông tin không khớp hồ sơ",
	"Đơn vị cấp chưa được công nhận",
	"Có dấu hiệu chỉnh sửa hoặc không hợp lệ",
] as const;
