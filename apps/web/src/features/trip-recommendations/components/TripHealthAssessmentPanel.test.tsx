import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecommendationHealthBasis, TripHealthAssessmentPanel } from "./TripHealthAssessmentPanel";

describe("health evidence in recommendations", () => {
	it("shows the actual activity facts used, separately from trip preferences", () => {
		render(
			<RecommendationHealthBasis
				basis={{
					fitnessLevel: "Trung bình",
					activityProfile: {
						comfortableDistanceKm: 4,
						comfortableWalkingMinutes: 120,
						activityNotes: null,
						confirmedAt: "2026-11-19T00:00:00Z",
					},
					hasMedicalConditions: false,
				}}
			/>
		);
		expect(screen.getByRole("region", { name: "Hồ sơ sức khỏe đã dùng" })).toHaveTextContent(
			"4 km/ngày"
		);
		expect(screen.getByText(/120 phút\/ngày/)).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Cập nhật khả năng vận động" })).toHaveAttribute(
			"href",
			"/camper/profile?tab=health_fitness"
		);
	});
	it("shows assessed criteria in explanation blocks and hides missing information", () => {
		render(
			<TripHealthAssessmentPanel
				assessment={{
					status: "needs_review",
					summary: "Yêu cầu vận động cần xác nhận thêm.",
					comparisons: [
						{
							label: "Quãng đường đi bộ trong ngày",
							profileValue: "4 km",
							tripValue: "12 km",
							result: "caution",
							detail: "Yêu cầu của chuyến vượt mức bạn khai báo.",
						},
					],
					missingInformation: ["Chưa có thời gian đi bộ dự kiến."],
					profileConfirmedAt: null,
				}}
			/>
		);
		expect(
			screen.getByRole("heading", { name: "Quãng đường đi bộ trong ngày" })
		).toBeInTheDocument();
		expect(screen.getByText("Cần lưu ý")).toBeInTheDocument();
		expect(screen.getByText("“4 km”")).toBeInTheDocument();
		expect(screen.getByText("Chuyến yêu cầu: 12 km")).toBeInTheDocument();
		expect(screen.queryByText("Chưa có thời gian đi bộ dự kiến.")).not.toBeInTheDocument();
		expect(
			screen.queryByRole("heading", { name: "Phù hợp với thông tin đã khai báo" })
		).not.toBeInTheDocument();
	});
	it.each([false, true])(
		"keeps known results when the overall assessment is incomplete (compact=%s)",
		(compact) => {
			render(
				<TripHealthAssessmentPanel
					compact={compact}
					assessment={{
						status: "insufficient_data",
						summary: "Chưa đủ thông tin từ hồ sơ hoặc cung đường để đánh giá mức phù hợp.",
						comparisons: [
							{
								label: "Thể lực và độ khó",
								profileValue: "Trung bình",
								tripValue: "Dễ",
								result: "match",
								detail: "Độ khó nằm trong mức thể lực bạn khai báo.",
							},
							{
								label: "Thời gian đi bộ",
								profileValue: "Chưa khai báo",
								tripValue: "120 phút",
								result: "unknown",
								detail: "Chưa đủ dữ liệu để đối chiếu.",
							},
						],
						missingInformation: ["Bạn chưa khai báo thời gian đi bộ."],
						profileConfirmedAt: null,
					}}
				/>
			);
			expect(screen.getByRole("heading", { name: "Thể lực và độ khó" })).toBeInTheDocument();
			expect(screen.getByText("Phù hợp")).toBeInTheDocument();
			expect(screen.queryByRole("heading", { name: "Thời gian đi bộ" })).not.toBeInTheDocument();
			expect(screen.queryByText(/Chưa đủ thông tin/)).not.toBeInTheDocument();
			expect(screen.queryByText(/Bạn chưa khai báo/)).not.toBeInTheDocument();
		}
	);
	it("renders nothing when no criterion can be assessed", () => {
		const { container } = render(
			<TripHealthAssessmentPanel
				assessment={{
					status: "insufficient_data",
					summary: "Chưa đủ thông tin để đánh giá.",
					comparisons: [
						{
							label: "Độ khó",
							profileValue: "Trung bình",
							tripValue: "Chưa có thông tin",
							result: "unknown",
							detail: "Chưa thể đối chiếu.",
						},
					],
					missingInformation: [],
					profileConfirmedAt: null,
				}}
			/>
		);
		expect(container).toBeEmptyDOMElement();
	});
});
