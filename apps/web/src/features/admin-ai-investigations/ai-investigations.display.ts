import type { StatusBadgeTone } from "../../shared/components";
import type {
	InvestigationSummary,
	IssueClassification,
	ProcessingStatus,
	ReviewStatus,
	TechnicalStatus,
} from "./ai-investigations.types";

export const reviewLabels = {
	pending: ["Chờ xem xét", "warning"],
	reviewing: ["Đang xem xét", "info"],
	actioned: ["Đã xử lý", "success"],
} as const satisfies Record<ReviewStatus, readonly [string, StatusBadgeTone]>;

export const processingLabels = {
	PENDING: ["Chờ phân tích", "neutral"],
	PROCESSING: ["Đang phân tích", "info"],
	COMPLETE: ["Đã phân tích", "success"],
	FAILED: ["Phân tích thất bại", "danger"],
	SUPERSEDED: ["Đã có bản thay thế", "neutral"],
} as const satisfies Record<ProcessingStatus, readonly [string, StatusBadgeTone]>;

export const technicalLabels = {
	OPEN: ["Chưa có kết luận", "neutral"],
	HANDED_OFF: ["Đã ghi nhận bàn giao", "info"],
	VERIFIED_FIX: ["Đã xác minh bản sửa", "success"],
	JUSTIFIED_NO_FIX: ["Có căn cứ để không sửa", "success"],
} as const satisfies Record<TechnicalStatus, readonly [string, StatusBadgeTone]>;

export const issueLabels = {
	FACTUAL: "Sai thông tin",
	UNSUPPORTED_CLAIM: "Nhận định thiếu căn cứ",
	SOURCE_MISMATCH: "Trích dẫn không khớp",
	OUTDATED_CONTEXT: "Thông tin đã cũ",
	INCOMPLETE_ANSWER: "Câu trả lời chưa đầy đủ",
	SAFETY: "Rủi ro an toàn",
	UNDETERMINED: "Chưa xác định",
} satisfies Record<IssueClassification, string>;

export const confidenceLabels = { LOW: "Thấp", MEDIUM: "Trung bình", HIGH: "Cao" };

const dateTime = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" });

export function formatInvestigationDate(value: string) {
	return dateTime.format(new Date(value));
}

export function investigationTitle(item: InvestigationSummary) {
	if (item.reviewStatus !== null) return "Báo cáo nguy hiểm";
	return item.rating === "NOT_USEFUL" ? "Phản hồi chưa hữu ích" : "Phản hồi câu trả lời AI";
}
