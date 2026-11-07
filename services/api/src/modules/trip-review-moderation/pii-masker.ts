import type { DetectedPiiFlag, PiiMaskResult } from "./trip-review-moderation.types";

const EMAIL_REGEX = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE_REGEX = /(?<!\w)\+?\d[\d ().-]{6,}\d(?!\w)/g;
const DATE_REGEX = /^(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{4})$/;

function maskEmail(email: string): string {
	const parts = email.split("@");
	if (parts.length !== 2) return "[email]";
	const local = parts[0];
	const domain = parts[1];
	const maskedLocal =
		local.length > 2 ? `${local[0]}***${local[local.length - 1]}` : `${local[0]}***`;
	return `${maskedLocal}@${domain}`;
}

function maskPhone(phone: string): string {
	const digits = phone.replace(/\D/g, "");
	if (digits.length < 8) return phone;
	const start = digits.slice(0, 3);
	const end = digits.slice(-3);
	return `${start}***${end}`;
}

export function maskPii(text: string | null): PiiMaskResult {
	if (!text) {
		return { maskedText: "", piiFlags: [] };
	}

	const piiFlags: DetectedPiiFlag[] = [];
	let maskedText = text;

	// 1. Process Emails
	const emailMatches = text.match(EMAIL_REGEX);
	if (emailMatches) {
		for (const email of emailMatches) {
			const masked = maskEmail(email);
			piiFlags.push({
				flagType: "personal_data_leak",
				detectionSource: "rule",
				confidence: null,
				evidence: `Server rule detected email: ${masked}`,
				quote: masked,
			});
			maskedText = maskedText.replaceAll(email, "[email]");
		}
	}

	// 2. Process Phones
	const phoneMatches = maskedText.match(PHONE_REGEX);
	if (phoneMatches) {
		for (const phone of phoneMatches) {
			if (DATE_REGEX.test(phone.trim())) {
				continue;
			}
			const digitsOnly = phone.replace(/\D/g, "");
			if (digitsOnly.length >= 8 && digitsOnly.length <= 15) {
				const masked = maskPhone(phone);
				piiFlags.push({
					flagType: "personal_data_leak",
					detectionSource: "rule",
					confidence: null,
					evidence: `Server rule detected phone number: ${masked}`,
					quote: masked,
				});
				maskedText = maskedText.replaceAll(phone, "[phone]");
			}
		}
	}

	return {
		maskedText,
		piiFlags,
	};
}
