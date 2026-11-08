import type {
	AspectType,
	DetectionSource,
	IncidentSeverity,
	IncidentType,
	ModerationFlagType,
	Sentiment,
	Topic,
} from "./types";
export const sentimentLabels: Record<Sentiment, string> = {
	positive: "Tích cực",
	neutral: "Trung lập",
	negative: "Tiêu cực",
	mixed: "Đa chiều",
};
export const sentimentStyles: Record<Sentiment, string> = {
	positive: "bg-emerald-100 text-emerald-900",
	neutral: "bg-slate-100 text-slate-700",
	negative: "bg-rose-100 text-rose-900",
	mixed: "bg-amber-100 text-amber-900",
};
export const topicLabels: Record<Topic, string> = {
	organization: "Tổ chức",
	guide_support: "Hỗ trợ hướng dẫn",
	safety: "An toàn",
	itinerary: "Lịch trình",
	scenery: "Cảnh quan",
	facilities: "Tiện nghi",
	value: "Giá trị trải nghiệm",
	communication: "Giao tiếp",
};
export const itemLabels = {
	pending: "Đang chờ",
	running: "Đang phân tích",
	succeeded: "Hoàn thành",
	failed: "Chưa thành công",
	skipped: "Tạm bỏ qua",
	suppressed: "Không khả dụng",
};
export const freshnessLabels: Record<string, string> = {
	review_changed: "Đánh giá gốc đã được chỉnh sửa.",
	configuration_changed: "Cấu hình hoặc phiên bản phân tích đã thay đổi.",
	eligibility_restricted:
		"Đánh giá hiện không đủ điều kiện phân tích; có thể đang được kiểm duyệt.",
	source_unavailable: "Nguồn đánh giá hiện không khả dụng.",
};

export const moderationFlagLabels: Record<ModerationFlagType, string> = {
	profanity_or_insult: "Từ ngữ thô tục hoặc xúc phạm",
	harassment: "Quấy rối hoặc đe dọa",
	hate_speech: "Thù địch hoặc phân biệt đối xử",
	inappropriate_image: "Hình ảnh không phù hợp",
	spam_or_irrelevant: "Spam hoặc không liên quan",
	contact_info_leak: "Lộ thông tin liên lạc cá nhân",
	other: "Vi phạm khác",
};

export const detectionSourceLabels: Record<DetectionSource, string> = {
	regex: "Bộ lọc từ khóa",
	perspective_api: "Perspective API",
	gemini_safety: "Gemini Safety",
	rekognition: "Rekognition",
	admin: "Quản trị viên",
	system: "Hệ thống",
};

export const moderationQueueFilterLabels: Record<string, string> = {
	pending_review: "Cần xử lý",
	hidden: "Đã ẩn",
	resolved: "Đã giải quyết",
};

export const aspectLabels: Record<AspectType, string> = {
	safety: "An toàn",
	guide_support: "Hỗ trợ của hướng dẫn viên",
	equipment: "Trang thiết bị",
	value: "Giá trị trải nghiệm",
};

export const incidentTypeLabels: Record<IncidentType, string> = {
	fall_slip: "Trượt ngã",
	injury: "Chấn thương",
	lost_path: "Lạc đường",
	weather_hazard: "Thời tiết nguy hiểm",
	other: "Sự cố khác",
};

export const incidentOccurrenceLabels = {
	yes: "Người viết mô tả sự cố đã xảy ra",
	warning: "Cảnh báo phòng ngừa",
	unknown: "Chưa xác định rõ",
} as const;

export const incidentSeverityLabels: Record<IncidentSeverity, string> = {
	minor: "Nhẹ",
	moderate: "Vừa",
	severe: "Nghiêm trọng",
	unknown: "Chưa rõ",
};

export const routeSafetyDisclaimer =
	"Đây là nội dung người tham gia mô tả trong đánh giá, chưa phải thống kê sự cố đã được xác minh.";

export const conflict409Message =
	"Đánh giá hoặc trạng thái xử lý đã thay đổi. Vui lòng kiểm tra lại.";

export const adminOverrideMessage =
	"Đánh giá vẫn đang bị ẩn theo trạng thái xử lý báo cáo hiện có.";

export const panelClass = "rounded-2xl border border-[#dfe8df] bg-white p-4 sm:p-5";
export const buttonClass =
	"inline-flex items-center justify-center gap-2 rounded-xl bg-[#164027] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45 hover:bg-[#23583a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#164027]";
export const secondaryButtonClass =
	"inline-flex items-center justify-center gap-2 rounded-xl border border-[#dfe8df] bg-white px-4 py-2.5 text-sm font-semibold text-[#164027] disabled:cursor-not-allowed disabled:opacity-45 hover:bg-[#f0f5ed] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#164027]";
export const dangerButtonClass =
	"inline-flex items-center justify-center gap-2 rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45 hover:bg-rose-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700";
export const isActive = (status?: string) => status === "pending" || status === "running";

export const mutedTextClass = "text-[#374151] font-medium";
export const subTextClass = "text-[#4b5563]";
export const helperTextClass = "text-[#374151] text-xs";

export const ANALYSIS_PAGE_SIZE = 6;
