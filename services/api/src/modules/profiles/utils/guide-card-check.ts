import type { GuideCardExtraction } from "../entities/porter-verification-document.entity";
import type { GuideCardCheckResult, GuideCardType } from "../entities/porter-verification.entity";
import { normalizeVietnameseName } from "./vietnamese-name.util";

/** Labels shown to the Admin. The first two auto-reject; the others only inform the review. */
export enum GuideCardLabel {
	CARD_EXPIRED = "CARD_EXPIRED",
	CARD_TYPE_SITE_ONLY = "CARD_TYPE_SITE_ONLY",
	CARD_NOT_READ = "CARD_NOT_READ",
	NAME_MISMATCH = "NAME_MISMATCH",
	ACCOUNT_NAME_MISSING = "ACCOUNT_NAME_MISSING",
	NUMBER_MISMATCH = "NUMBER_MISMATCH",
	TYPE_MISMATCH = "TYPE_MISMATCH",
	EXPIRY_MISMATCH = "EXPIRY_MISMATCH",
}

const AUTO_REJECT_LABELS = new Set<string>([
	GuideCardLabel.CARD_EXPIRED,
	GuideCardLabel.CARD_TYPE_SITE_ONLY,
]);

export interface GuideCardDeclaration {
	cardType: GuideCardType;
	cardNumber: string;
	expiresOn: string;
}

export interface ExtractedDocument {
	id: string;
	extraction: GuideCardExtraction | null;
}

/** Today's date in Vietnam as `YYYY-MM-DD` (card validity is a calendar date). */
export function vietnamToday(now: Date = new Date()): string {
	return new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * Compares the newest readable card photo with what the Porter declared and with the account name.
 * An expired or site-only card (as read on the photo) is auto-rejected; every other finding is
 * only a label for the Admin, who still checks the official registry before approving.
 */
export function checkGuideCard(input: {
	declaration: GuideCardDeclaration;
	accountName: string | null;
	documents: ExtractedDocument[];
	today: string;
}): GuideCardCheckResult {
	const readable = [...input.documents]
		.reverse()
		.find((doc) => doc.extraction?.status === "read" && doc.extraction.isGuideCard);
	if (!readable || readable.extraction?.status !== "read") {
		return { labels: [GuideCardLabel.CARD_NOT_READ], reading: null, autoRejected: false };
	}

	const reading = readable.extraction;
	const labels: string[] = [];
	if (reading.expiresOn && reading.expiresOn < input.today)
		labels.push(GuideCardLabel.CARD_EXPIRED);
	if (reading.cardType === "tai_diem") labels.push(GuideCardLabel.CARD_TYPE_SITE_ONLY);
	if (!input.accountName) {
		labels.push(GuideCardLabel.ACCOUNT_NAME_MISSING);
	} else if (
		!reading.fullName ||
		normalizeVietnameseName(reading.fullName) !== normalizeVietnameseName(input.accountName)
	) {
		labels.push(GuideCardLabel.NAME_MISMATCH);
	}
	if (reading.cardNumber !== input.declaration.cardNumber)
		labels.push(GuideCardLabel.NUMBER_MISMATCH);
	if (reading.cardType !== "tai_diem" && reading.cardType !== input.declaration.cardType) {
		labels.push(GuideCardLabel.TYPE_MISMATCH);
	}
	if (reading.expiresOn !== input.declaration.expiresOn)
		labels.push(GuideCardLabel.EXPIRY_MISMATCH);

	return {
		labels,
		reading: {
			fullName: reading.fullName,
			cardNumber: reading.cardNumber,
			cardType: reading.cardType,
			expiresOn: reading.expiresOn,
			confidence: reading.confidence,
			documentId: readable.id,
		},
		autoRejected: labels.some((label) => AUTO_REJECT_LABELS.has(label)),
	};
}

/** Reason shown to the Porter when the system rejects the card on its own. */
export function autoRejectionReason(check: GuideCardCheckResult): string | null {
	if (!check.autoRejected) return null;
	if (check.labels.includes(GuideCardLabel.CARD_TYPE_SITE_ONLY)) {
		return "Hệ thống tự từ chối: thẻ hướng dẫn viên tại điểm không được chấp nhận. Vui lòng cung cấp thẻ nội địa hoặc quốc tế.";
	}
	const expiresOn = check.reading?.expiresOn;
	const shown = expiresOn ? expiresOn.split("-").reverse().join("/") : "";
	return `Hệ thống tự từ chối: thẻ hướng dẫn viên đã hết hạn${shown ? ` (${shown})` : ""} theo ảnh thẻ. Vui lòng cập nhật thẻ còn hiệu lực.`;
}
