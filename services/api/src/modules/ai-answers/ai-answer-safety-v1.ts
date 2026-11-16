const GUIDANCE_NOTICE_VI =
	"Hướng dẫn chỉ dùng để tham khảo. Nếu có người đang gặp nguy hiểm, hãy liên hệ cấp cứu hoặc lực lượng cứu hộ tại chỗ ngay.";
const GUIDANCE_NOTICE_EN =
	"This guidance is for reference. If someone is in immediate danger, contact local emergency services or rescue personnel now.";

// Defense in depth after semantic verification. Apply the same screen to the answer and its evidence.
const UNSAFE_EXCERPT =
	/https?:\/\/|www\.|ignore.{0,50}instructions|(?:bỏ qua|phớt lờ).{0,50}(?:chỉ dẫn|hướng dẫn|chỉ thị|quy tắc|yêu cầu)|(?:system|developer) prompt|(?:đã|vừa).{0,35}(?:gửi sos|gọi cấp cứu|điều cứu hộ|mở lại tuyến|đổi mức rủi ro|thay đổi quyền|chuyển tiền|hoàn tiền)|\b(?:sos dispatched|route is open|payment approved|access granted)\b|\b\d+(?:[.,]\d+)?\s*(?:mg|mcg|μg|ml|viên)\b|(?:tiêm tĩnh mạch|tiêm bắp|đặt nội khí quản|nắn khớp|rạch vết thương|hút nọc|gây nôn|inject|intubat\w*|induce vomiting)/iu;

// Keep this artifact available for answers written under this revision.
export const answerSafetyV1 = Object.freeze({
	version: "ctms-069-answer-safety-v1",
	normalization: "NFKC" as const,
	whitespace: /\s+/gu,
	unsafeExcerpt: UNSAFE_EXCERPT,
	unsupportedMarkup:
		/<[^>]+>|\[[^\]]+\]\([^)]*\)|\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b/iu,
	noticeVi: GUIDANCE_NOTICE_VI,
	noticeEn: GUIDANCE_NOTICE_EN,
	maxAnswerChars: 3000,
	apply(answerText: string, citedExcerpts: string[], locale: string): string | null {
		if (
			[answerText, ...citedExcerpts].some((text) =>
				this.unsafeExcerpt.test(text.normalize(this.normalization).replace(this.whitespace, " "))
			) ||
			this.unsupportedMarkup.test(answerText)
		) {
			return null;
		}
		const notice = locale.split("-")[0] === "en" ? this.noticeEn : this.noticeVi;
		const answer = [notice, answerText.trim()].join("\n\n");
		return answer.length <= this.maxAnswerChars ? answer : null;
	},
});

const answerSafetyArtifacts = new Map<string, typeof answerSafetyV1>([
	[answerSafetyV1.version, answerSafetyV1],
]);

export function resolveAnswerSafetyArtifact(version: string) {
	return answerSafetyArtifacts.get(version);
}
