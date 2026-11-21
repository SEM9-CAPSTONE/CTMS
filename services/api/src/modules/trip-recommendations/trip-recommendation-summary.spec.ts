import type { TripHealthAssessment } from "./trip-health-assessment";
import type { ExplanationSection } from "./trip-recommendation-explanation";
import { summarizeRecommendation } from "./trip-recommendation-summary";

const section = (
	kind: ExplanationSection["kind"],
	tone: ExplanationSection["tone"] = "match"
): ExplanationSection => ({
	kind,
	tone,
	title: "Thông tin chuyến đi",
	quote: null,
	detail: "Thông tin đối chiếu.",
	conclusion: "Vì vậy chuyến đi phù hợp.",
});
const assessment = (comparisons: TripHealthAssessment["comparisons"]): TripHealthAssessment => ({
	status: "insufficient_data",
	summary: "Chưa đủ thông tin để đánh giá.",
	comparisons,
	missingInformation: [],
	profileConfirmedAt: null,
});
const comparison = (label: string, result: "match" | "caution" | "unknown") => ({
	label,
	result,
	profileValue: "Thông tin đã khai báo",
	tripValue: "Yêu cầu chuyến đi",
	detail: "Nhận xét từng tiêu chí.",
});

describe("concise recommendation summary", () => {
	it("combines matching preferences and mixed walking requirements without repeated conclusions", () => {
		const result = summarizeRecommendation(
			[section("trip_type"), section("experience"), section("price")],
			assessment([
				comparison("Thể lực và độ khó", "match"),
				comparison("Quãng đường đi bộ trong ngày", "match"),
				comparison("Thời gian đi bộ trong ngày", "caution"),
			])
		);
		expect(result).toBe(
			"Chuyến đi phù hợp với loại trải nghiệm, kinh nghiệm và ngân sách của bạn. Độ khó và quãng đường đi bộ nằm trong mức bạn khai báo, nhưng thời gian đi bộ vượt mức quen thuộc. Hãy cân nhắc chuyến nhẹ hơn hoặc xác nhận khả năng tham gia trước khi đặt."
		);
		expect(result).not.toContain("Vì vậy");
	});
	it("omits unknown criteria while preserving assessed evidence", () => {
		expect(
			summarizeRecommendation(
				[],
				assessment([
					comparison("Thể lực và độ khó", "match"),
					comparison("Thời gian đi bộ trong ngày", "unknown"),
				])
			)
		).toBe("Độ khó nằm trong mức bạn khai báo.");
		expect(
			summarizeRecommendation([], assessment([comparison("Thể lực và độ khó", "unknown")]))
		).toBe("");
	});
	it("keeps support needs and deduplicates warnings", () => {
		expect(
			summarizeRecommendation(
				[section("health_note", "caution")],
				assessment([comparison("Bệnh nền", "caution")])
			)
		).toBe("Cần xác nhận thêm về bệnh nền trước khi đặt.");
	});
});
