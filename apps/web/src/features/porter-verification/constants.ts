import type { StatusBadgeTone } from "../../shared/components";
import type { PorterVerificationStatus } from "./types";

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

export const EDITABLE_VERIFICATION_STATUSES: ReadonlySet<PorterVerificationStatus> = new Set([
	"pending_documents",
	"rejected",
]);
