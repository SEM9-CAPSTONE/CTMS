import type { TripHealthAssessment } from "./trip-health-assessment";
import type { ExplanationKind, ExplanationSection } from "./trip-recommendation-explanation";

const SECTION_LABELS: Partial<Record<ExplanationKind, string>> = {
	trip_type: "loại trải nghiệm",
	difficulty: "độ khó mong muốn",
	interest: "sở thích",
	experience: "kinh nghiệm",
	region: "khu vực",
	price: "ngân sách",
	health_note: "bệnh nền",
	age: "độ tuổi",
	availability: "tình trạng nhận đặt chỗ",
};
const EFFORT_LABELS: Readonly<Record<string, string>> = {
	"Thể lực và độ khó": "độ khó",
	"Quãng đường đi bộ trong ngày": "quãng đường đi bộ",
	"Thời gian đi bộ trong ngày": "thời gian đi bộ",
};
const unique = (items: string[]) => [...new Set(items)];
function join(items: string[]): string {
	return items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} và ${items.at(-1)}`;
}
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Summarize assessed evidence once; unknown criteria never become conclusions. */
export function summarizeRecommendation(
	sections: ExplanationSection[],
	assessment: TripHealthAssessment
): string {
	const matches = unique(
		sections
			.filter((section) => section.tone === "match")
			.flatMap((section) => SECTION_LABELS[section.kind] ?? [])
	);
	const good = unique(
		assessment.comparisons
			.filter((item) => item.result === "match")
			.flatMap((item) => EFFORT_LABELS[item.label] ?? [])
	);
	const exceeded = unique(
		assessment.comparisons
			.filter((item) => item.result === "caution")
			.flatMap((item) => EFFORT_LABELS[item.label] ?? [])
	);
	const cautions = unique([
		...assessment.comparisons
			.filter((item) => item.result === "caution" && !EFFORT_LABELS[item.label])
			.map((item) => item.label.toLocaleLowerCase("vi-VN")),
		...sections
			.filter((section) => section.tone === "caution")
			.flatMap((section) => SECTION_LABELS[section.kind] ?? []),
	]);
	const parts: string[] = [];
	if (matches.length) parts.push(`Chuyến đi phù hợp với ${join(matches)} của bạn.`);
	if (good.length && exceeded.length) {
		parts.push(
			`${capitalize(join(good))} nằm trong mức bạn khai báo, nhưng ${join(exceeded)} vượt mức quen thuộc.`
		);
	} else if (good.length) {
		parts.push(`${capitalize(join(good))} nằm trong mức bạn khai báo.`);
	} else if (exceeded.length) {
		parts.push(`${capitalize(join(exceeded))} vượt mức bạn khai báo.`);
	}
	if (exceeded.length)
		parts.push("Hãy cân nhắc chuyến nhẹ hơn hoặc xác nhận khả năng tham gia trước khi đặt.");
	if (cautions.length) parts.push(`Cần xác nhận thêm về ${join(cautions)} trước khi đặt.`);
	return parts.join(" ");
}
