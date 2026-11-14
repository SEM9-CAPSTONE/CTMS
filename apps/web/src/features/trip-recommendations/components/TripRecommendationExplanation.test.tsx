import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { tripRecommendationsService } from "../services/trip-recommendations.service";
import type { TripRecommendationExplanation as Explanation } from "../types";
import { TripRecommendationExplanation } from "./TripRecommendationExplanation";

vi.mock("../services/trip-recommendations.service", () => ({
	tripRecommendationsService: {
		list: vi.fn(),
		getPreferences: vi.fn(),
		getExplanation: vi.fn(),
		replacePreferences: vi.fn(),
	},
}));

const service = vi.mocked(tripRecommendationsService);
const TRIP_ID = "6b1f2c4e-8d3a-4f7b-9c2e-1a5d7e9f0b3c";

const explanation = (overrides: Partial<Explanation> = {}): Explanation => ({
	tripTitle: "Săn mây đỉnh Bà Nà",
	reasons: ["fitness_match", "preferred_price"],
	healthConsidered: true,
	generatedAt: "2026-11-14T03:00:00.000Z",
	summary:
		"Vì vậy chuyến này phù hợp với bạn về thể lực, điều bạn yêu thích và mức giá, đúng với những gì bạn đã cung cấp. Trước khi đặt, hãy lưu ý về bệnh nền.",
	sections: [
		{
			kind: "fitness",
			tone: "match",
			title: "Vừa sức với thể lực của bạn",
			quote: {
				source: "health_profile",
				field: "Mức thể lực",
				text: "Nâng cao (Trekking đèo dốc thường xuyên)",
			},
			detail: "Cung đường có độ khó Khó, dài 8,5 km, nằm trong mức bạn đã quen.",
			conclusion: "Vì vậy bạn có thể đi trọn cung đường mà không bị quá sức.",
		},
		{
			kind: "interest",
			tone: "match",
			title: "Có hoạt động bạn yêu thích: săn mây",
			quote: {
				source: "personal_profile",
				field: "Giới thiệu bản thân",
				text: "Cuối tuần mình mê săn mây trên núi",
			},
			detail: "Chuyến “Săn mây đỉnh Bà Nà” có săn mây trong lịch trình.",
			conclusion: "Vì vậy chuyến đi đúng với điều bạn đã chia sẻ là mình thích.",
		},
		{
			kind: "health_note",
			tone: "caution",
			title: "Cần lưu ý với bệnh nền của bạn",
			quote: { source: "health_profile", field: "Bệnh nền", text: "Hen suyễn" },
			detail: "Cung đường có độ khó Khó. Nhớ mang theo “Ventolin” như bạn ghi trong hồ sơ.",
			conclusion: "Vì vậy hãy hỏi ý kiến bác sĩ và báo trước cho chủ chuyến.",
		},
		{
			kind: "timing",
			tone: "info",
			title: "Lịch khởi hành",
			quote: null,
			detail: "Khởi hành sau 6 ngày. Còn 7 chỗ.",
			conclusion: null,
		},
	],
	...overrides,
});

function renderPanel() {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return render(
		<QueryClientProvider client={client}>
			<TripRecommendationExplanation tripId={TRIP_ID} />
		</QueryClientProvider>
	);
}

describe("TripRecommendationExplanation", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.setItem(
			"authUser",
			JSON.stringify({ id: "camper-1", role: "camper", roles: ["camper"], status: "active" })
		);
	});
	afterEach(() => localStorage.clear());

	it("shows every server-written section with its tone and no internal id", async () => {
		service.getExplanation.mockResolvedValue(explanation());
		renderPanel();
		const list = await screen.findByRole("list", { name: "Lý do gợi ý chi tiết" });
		const items = within(list).getAllByRole("listitem");
		expect(items).toHaveLength(4);
		const fitness = items[0];
		expect(within(fitness).getByText("Vừa sức với thể lực của bạn")).toBeInTheDocument();
		expect(within(fitness).getByText("Phù hợp")).toBeInTheDocument();
		expect(
			within(fitness).getByText("Bạn đã cung cấp · Hồ sơ sức khỏe · Mức thể lực")
		).toBeInTheDocument();
		expect(
			within(fitness).getByText("“Nâng cao (Trekking đèo dốc thường xuyên)”")
		).toBeInTheDocument();
		expect(
			within(fitness).getByText("→ Vì vậy bạn có thể đi trọn cung đường mà không bị quá sức.")
		).toBeInTheDocument();
		expect(within(items[1]).getByText("“Cuối tuần mình mê săn mây trên núi”")).toBeInTheDocument();
		expect(within(items[2]).getByText("Cần lưu ý")).toBeInTheDocument();
		// A trip-only fact has no quote and no conclusion.
		expect(within(items[3]).queryByText(/Bạn đã cung cấp/)).not.toBeInTheDocument();
		expect(within(items[3]).queryByText(/^→/)).not.toBeInTheDocument();
		expect(screen.getByText("Kết luận")).toBeInTheDocument();
		expect(screen.getByText(/^Vì vậy chuyến này phù hợp với bạn về thể lực/)).toBeInTheDocument();
		expect(service.getExplanation).toHaveBeenCalledWith(TRIP_ID, expect.anything());
		expect(document.body.textContent).not.toContain(TRIP_ID.slice(0, 8));
	});

	it("suggests sharing the health profile when it was not considered", async () => {
		service.getExplanation.mockResolvedValue(explanation({ healthConsidered: false }));
		renderPanel();
		expect(
			await screen.findByText(/Bật chia sẻ hồ sơ sức khỏe để gợi ý xét thêm thể lực/)
		).toBeInTheDocument();
	});

	it("renders nothing for a Trip that is not in the latest suggestions", async () => {
		service.getExplanation.mockRejectedValue(new HttpError("Not Found", 404, {}));
		const { container } = renderPanel();
		await waitFor(() => expect(service.getExplanation).toHaveBeenCalled());
		await waitFor(() => expect(container).toBeEmptyDOMElement());
	});

	it("shows a Vietnamese error with retry, never the API message", async () => {
		service.getExplanation
			.mockRejectedValueOnce(new HttpError("Internal server error", 500, {}))
			.mockResolvedValueOnce(explanation());
		renderPanel();
		const alert = await screen.findByRole("alert");
		expect(alert).toHaveTextContent("Không tải được lý do gợi ý.");
		expect(alert).not.toHaveTextContent("Internal server error");
		fireEvent.click(within(alert).getByRole("button", { name: "Thử lại" }));
		expect(await screen.findByText("Vừa sức với thể lực của bạn")).toBeInTheDocument();
	});
});
