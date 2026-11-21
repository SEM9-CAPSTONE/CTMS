import type { StatusBadgeTone } from "../../shared/components";
import type { GuideCard, GuideCardType, PorterVerificationStatus } from "./types";

export const PORTER_VERIFICATION_MAX_DOCUMENTS = 5;
export const PORTER_VERIFICATION_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const PORTER_VERIFICATION_MIME_TYPES = [
	"application/pdf",
	"image/jpeg",
	"image/png",
	"image/webp",
] as const;

export const PORTER_VERIFICATION_STATUS_LABELS: Record<PorterVerificationStatus, string> = {
	pending_documents: "Chưa nộp hồ sơ",
	pending_review: "Chờ duyệt",
	approved: "Đã duyệt",
	rejected: "Bị từ chối",
};

export const PORTER_VERIFICATION_STATUS_TONES: Record<PorterVerificationStatus, StatusBadgeTone> = {
	pending_documents: "neutral",
	pending_review: "warning",
	approved: "success",
	rejected: "danger",
};

export const GUIDE_CARD_TYPE_LABELS: Record<GuideCardType, string> = {
	noi_dia: "Nội địa",
	quoc_te: "Quốc tế",
};

/** Today in Vietnam as `YYYY-MM-DD` (same calendar the API uses for card expiry). */
export function vietnamToday(now: Date = new Date()): string {
	return new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Same rules as the API; null when the card can be saved. */
export function validateGuideCard(card: GuideCard, today: string = vietnamToday()): string | null {
	if (!/^\d{9}$/.test(card.cardNumber)) return "Số thẻ hướng dẫn viên gồm đúng 9 chữ số.";
	if (!/^\d{4}-\d{2}-\d{2}$/.test(card.expiresOn)) return "Vui lòng chọn ngày hết hạn của thẻ.";
	if (card.expiresOn < today) return "Thẻ hướng dẫn viên đã hết hạn.";
	return null;
}

export const EDITABLE_VERIFICATION_STATUSES: ReadonlySet<PorterVerificationStatus> = new Set([
	"pending_documents",
	"rejected",
]);
