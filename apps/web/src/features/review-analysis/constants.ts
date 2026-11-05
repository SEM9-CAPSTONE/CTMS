import type { Sentiment, Topic } from "./types";
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
export const panelClass = "rounded-2xl border border-[#dfe8df] bg-white p-4 sm:p-5";
export const buttonClass =
	"inline-flex items-center justify-center gap-2 rounded-xl bg-[#164027] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45 hover:bg-[#23583a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#164027]";
export const isActive = (status?: string) => status === "pending" || status === "running";

export const ANALYSIS_PAGE_SIZE = 6;
