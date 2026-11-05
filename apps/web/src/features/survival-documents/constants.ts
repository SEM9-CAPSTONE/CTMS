import type { Classification, DocumentStatus } from "./types";
export const SOURCE_STALE_TIME = 15_000;
export const SOURCE_PAGE_SIZE = 20;
export const CATEGORY_LABELS: Record<Classification, string> = {
	NATURAL_HAZARDS: "Thiên tai",
	TREKKING_SAFETY: "An toàn đi bộ đường dài",
	WEATHER_SAFETY: "An toàn thời tiết",
	WATER_SAFETY: "Nước sạch",
	MEDICAL_REFERENCE: "Tham khảo y tế",
	FIRST_AID: "Sơ cấp cứu",
};
export const STATUS_LABELS: Record<DocumentStatus, string> = {
	DRAFT: "Bản nháp",
	PUBLISHED: "Đã xuất bản",
	SUPERSEDED: "Đã thay thế",
	ARCHIVED: "Ngừng sử dụng",
};
export const SOURCE_INPUT =
	"mt-1 w-full rounded-lg border border-[#dfe8df] px-3 py-2 text-sm bg-white";
export const SOURCE_BUTTON =
	"rounded-lg bg-[#164027] px-4 py-2 text-sm font-bold text-white disabled:opacity-50";
export const RIGHTS_LABELS = {
	NOT_REVIEWED: "Chưa xác minh",
	REVIEW_REQUIRED: "Cần xác minh thêm",
	PERMITTED: "Được phép theo minh chứng",
	RESTRICTED: "Bị hạn chế",
};
export const AUDIT_LABELS: Record<string, string> = {
	upload: "Tải tệp lên",
	import_url: "Nhập PDF từ URL",
	metadata: "Sửa thông tin",
	submit: "Gửi duyệt",
	review: "Xét duyệt",
	publish: "Xuất bản",
	archive: "Ngừng sử dụng",
	supersede: "Thay thế phiên bản",
};
