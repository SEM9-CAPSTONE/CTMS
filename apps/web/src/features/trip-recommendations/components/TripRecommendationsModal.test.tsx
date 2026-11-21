import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { toast } from "../../../shared/components/Toast";
import type { TripSummary } from "../../trips/types";
import { tripRecommendationsService } from "../services/trip-recommendations.service";
import type { TripPreferences, TripRecommendations } from "../types";
import { TripRecommendationsBanner } from "./TripRecommendationsModal";

vi.mock("../services/trip-recommendations.service", () => ({
	tripRecommendationsService: {
		list: vi.fn(),
		regenerate: vi.fn(),
		getPreferences: vi.fn(),
		getExplanation: vi.fn(),
		replacePreferences: vi.fn(),
	},
}));
vi.mock("../../../shared/components/Toast", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

const service = vi.mocked(tripRecommendationsService);
const TRIP_ID = "6b1f2c4e-8d3a-4f7b-9c2e-1a5d7e9f0b3c";

const trip: TripSummary = {
	id: TRIP_ID,
	title: "Săn mây đỉnh Bà Nà",
	description: "Ngắm bình minh trên đỉnh Bà Nà",
	coverImageUrl: null,
	tripType: "overnight",
	durationNights: 1,
	startsAt: "2026-12-05T23:00:00.000Z",
	endsAt: "2026-12-06T10:00:00.000Z",
	meetingPoint: { type: "Point", coordinates: [107.99, 15.997] },
	meetingAt: null,
	bookingDeadline: "2026-12-03T10:00:00.000Z",
	capacityMin: 4,
	capacityMax: 12,
	seatsTaken: 5,
	remainingSeats: 7,
	pricePerPerson: 1850000,
	status: "published",
	difficulty: "hard",
	weatherRiskLevel: null,
	isBookable: true,
	createdAt: "2026-10-20T00:00:00.000Z",
	updatedAt: "2026-10-20T00:00:00.000Z",
};

const ready = (overrides: Partial<TripRecommendations> = {}): TripRecommendations => ({
	status: "ready",
	items: [{ trip, reasons: ["preferred_price", "booked_region"] }],
	generatedAt: "2026-11-14T03:00:00.000Z",
	mode: "ai",
	...overrides,
});

const needsPreferences: TripRecommendations = {
	status: "needs_preferences",
	items: [],
	generatedAt: "2026-11-14T03:00:00.000Z",
	mode: null,
};

const preferences: TripPreferences = {
	tripTypes: ["overnight"],
	difficulties: [],
	regions: [],
	minPrice: null,
	maxPrice: 2000000,
	updatedAt: "2026-11-10T00:00:00.000Z",
	regionOptions: [
		{ code: "ba_na_hoa_vang", label: "Bà Nà – Hòa Vang" },
		{ code: "son_tra", label: "Bán đảo Sơn Trà" },
	],
};

function renderBanner(onSelectTrip = vi.fn()) {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	render(
		<QueryClientProvider client={client}>
			<TripRecommendationsBanner onSelectTrip={onSelectTrip} />
		</QueryClientProvider>
	);
	return { client, onSelectTrip };
}

const openModal = () => fireEvent.click(screen.getByRole("button", { name: "Xem gợi ý" }));

describe("TripRecommendationsBanner", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		service.regenerate.mockResolvedValue(ready());
		service.getPreferences.mockResolvedValue(preferences);
		localStorage.setItem(
			"authUser",
			JSON.stringify({ id: "camper-1", role: "camper", roles: ["camper"], status: "active" })
		);
	});
	afterEach(() => localStorage.clear());

	it("does not request suggestions until the Camper opens the modal", async () => {
		service.list.mockResolvedValue(ready());
		renderBanner();
		expect(
			screen.getByRole("region", { name: "Gợi ý chuyến đi dành cho bạn" })
		).toBeInTheDocument();
		expect(service.list).not.toHaveBeenCalled();
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

		openModal();
		expect(await screen.findByRole("dialog", { name: "Gợi ý cho bạn" })).toBeInTheDocument();
		expect(service.list).toHaveBeenCalledTimes(1);
	});

	it("shows only suggested trip cards and opens the trip detail", async () => {
		service.list.mockResolvedValue(ready());
		const { onSelectTrip } = renderBanner();
		openModal();
		expect(await screen.findByText("Săn mây đỉnh Bà Nà")).toBeInTheDocument();
		expect(
			screen.queryByRole("list", { name: "Lý do gợi ý chuyến Săn mây đỉnh Bà Nà" })
		).not.toBeInTheDocument();
		expect(document.body.textContent).not.toContain(TRIP_ID);
		for (const element of document.body.querySelectorAll("[aria-label], [title], [alt]")) {
			for (const name of ["aria-label", "title", "alt"]) {
				expect(element.getAttribute(name) ?? "").not.toContain(TRIP_ID.slice(0, 8));
			}
		}

		fireEvent.click(screen.getByText("Săn mây đỉnh Bà Nà"));
		expect(onSelectTrip).toHaveBeenCalledWith(TRIP_ID);
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	});

	it("runs again each time the modal is opened", async () => {
		service.list.mockResolvedValue(ready());
		renderBanner();
		openModal();
		await screen.findByText("Săn mây đỉnh Bà Nà");
		fireEvent.click(screen.getByRole("button", { name: "Đóng" }));
		openModal();
		await waitFor(() => expect(service.list).toHaveBeenCalledTimes(2));
	});

	it("asks for preferences when there is not enough information, then suggests after saving", async () => {
		service.list.mockResolvedValueOnce(needsPreferences).mockResolvedValueOnce(ready());
		service.getPreferences.mockResolvedValue({ ...preferences, tripTypes: [], maxPrice: null });
		service.replacePreferences.mockResolvedValue({ ...preferences, regions: ["son_tra"] });
		renderBanner();
		openModal();

		expect(await screen.findByText("Cần thêm thông tin để gợi ý")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Cập nhật sở thích" }));
		const form = await screen.findByRole("dialog", { name: "Sở thích để gợi ý chuyến đi" });
		fireEvent.click(await within(form).findByLabelText("Bán đảo Sơn Trà"));
		fireEvent.click(within(form).getByRole("button", { name: "Lưu sở thích" }));

		await waitFor(() =>
			expect(service.replacePreferences).toHaveBeenCalledWith({
				tripTypes: [],
				difficulties: [],
				regions: ["son_tra"],
				minPrice: null,
				maxPrice: null,
			})
		);
		expect(toast.success).toHaveBeenCalledWith(
			"Đã lưu sở thích chuyến đi. Gợi ý đang được cập nhật."
		);
		expect(await screen.findByText("Săn mây đỉnh Bà Nà")).toBeInTheDocument();
		expect(service.list).toHaveBeenCalledTimes(2);
	});

	it("shows an empty state when nothing fits", async () => {
		service.list.mockResolvedValue(ready({ items: [] }));
		renderBanner();
		openModal();
		expect(await screen.findByText("Chưa có chuyến phù hợp lúc này")).toBeInTheDocument();
	});

	it("requires health sharing and links directly to the health profile", async () => {
		service.list.mockResolvedValue(
			ready({ status: "needs_health_consent", items: [], mode: null })
		);
		renderBanner();
		openModal();
		expect(
			await screen.findByRole("heading", { name: "Cần cho phép chia sẻ hồ sơ sức khỏe" })
		).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Mở hồ sơ sức khỏe" })).toHaveAttribute(
			"href",
			"/camper/profile?tab=health_fitness"
		);
		expect(screen.queryByText(trip.title)).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Tạo lại gợi ý chuyến đi" })
		).not.toBeInTheDocument();
		expect(service.regenerate).not.toHaveBeenCalled();
		service.list.mockResolvedValue(ready());
		fireEvent.click(screen.getByRole("button", { name: "Kiểm tra lại quyền chia sẻ" }));
		expect(await screen.findByText(trip.title)).toBeInTheDocument();
	});

	it("manually regenerates and replaces old suggestions with the fresh response", async () => {
		service.list.mockResolvedValue(ready());
		let finish!: (value: TripRecommendations) => void;
		service.regenerate.mockReturnValue(
			new Promise((resolve) => {
				finish = resolve;
			})
		);
		renderBanner();
		openModal();
		await screen.findByText(trip.title);
		fireEvent.click(screen.getByRole("button", { name: "Tạo lại gợi ý chuyến đi" }));
		await waitFor(() => expect(service.regenerate).toHaveBeenCalledTimes(1));
		expect(screen.queryByText(trip.title)).not.toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Đang tạo gợi ý..." })).toBeDisabled();
		finish(
			ready({
				items: [{ trip: { ...trip, title: "Dạo bước rừng Sơn Trà" }, reasons: ["fitness_match"] }],
			})
		);
		expect(await screen.findByText("Dạo bước rừng Sơn Trà")).toBeInTheDocument();
		expect(toast.success).toHaveBeenCalledWith("Đã tạo lại gợi ý từ hồ sơ mới nhất của bạn.");
	});

	it("clears prior recommendations when sharing has been revoked before regeneration", async () => {
		service.list.mockResolvedValue(ready());
		service.regenerate.mockResolvedValue(
			ready({ status: "needs_health_consent", items: [], mode: null })
		);
		renderBanner();
		openModal();
		await screen.findByText(trip.title);
		fireEvent.click(screen.getByRole("button", { name: "Tạo lại gợi ý chuyến đi" }));
		expect(
			await screen.findByRole("heading", { name: "Cần cho phép chia sẻ hồ sơ sức khỏe" })
		).toBeInTheDocument();
		expect(screen.queryByText(trip.title)).not.toBeInTheDocument();
		expect(toast.success).not.toHaveBeenCalled();
	});

	it("hides old results and shows a Vietnamese toast if manual regeneration fails", async () => {
		service.list.mockResolvedValue(ready());
		service.regenerate.mockRejectedValue(new Error("Internal server error"));
		renderBanner();
		openModal();
		await screen.findByText(trip.title);
		fireEvent.click(screen.getByRole("button", { name: "Tạo lại gợi ý chuyến đi" }));
		await waitFor(() =>
			expect(toast.error).toHaveBeenCalledWith(
				"Không thể tạo lại gợi ý chuyến đi. Vui lòng thử lại."
			)
		);
		expect(screen.queryByText(trip.title)).not.toBeInTheDocument();
		expect(screen.queryByText("Internal server error")).not.toBeInTheDocument();
	});

	it("shows a Vietnamese error with retry, never the API message", async () => {
		service.list
			.mockRejectedValueOnce(new HttpError("Internal server error", 500, {}))
			.mockResolvedValueOnce(ready());
		renderBanner();
		openModal();
		const alert = await screen.findByRole("alert");
		expect(alert).toHaveTextContent("Không tải được gợi ý chuyến đi.");
		expect(alert).not.toHaveTextContent("Internal server error");
		fireEvent.click(within(alert).getByRole("button", { name: "Thử lại" }));
		expect(await screen.findByText("Săn mây đỉnh Bà Nà")).toBeInTheDocument();
	});

	it("validates the price range in place and shows save errors as a toast", async () => {
		service.list.mockResolvedValue(ready());
		service.getPreferences.mockResolvedValue({ ...preferences, maxPrice: null, tripTypes: [] });
		service.replacePreferences.mockRejectedValue(new HttpError("Bad gateway", 502, {}));
		renderBanner();
		openModal();
		await screen.findByText("Săn mây đỉnh Bà Nà");
		fireEvent.click(screen.getByRole("button", { name: "Sửa sở thích" }));
		const form = await screen.findByRole("dialog", { name: "Sở thích để gợi ý chuyến đi" });
		fireEvent.change(await within(form).findByLabelText("Từ"), { target: { value: "3000000" } });
		fireEvent.change(within(form).getByLabelText("Đến"), { target: { value: "1000000" } });
		fireEvent.click(within(form).getByRole("button", { name: "Lưu sở thích" }));
		expect(
			await within(form).findByText("Giá thấp nhất không được lớn hơn giá cao nhất.")
		).toBeInTheDocument();
		expect(service.replacePreferences).not.toHaveBeenCalled();

		fireEvent.change(within(form).getByLabelText("Từ"), { target: { value: "500000" } });
		fireEvent.click(within(form).getByRole("button", { name: "Lưu sở thích" }));
		await waitFor(() =>
			expect(toast.error).toHaveBeenCalledWith("Không thể lưu sở thích. Vui lòng thử lại.")
		);
		expect(screen.getByRole("dialog", { name: "Sở thích để gợi ý chuyến đi" })).toBeInTheDocument();
	});

	it("keys the cache by the signed-in Camper", async () => {
		service.list.mockResolvedValue(ready());
		const { client } = renderBanner();
		openModal();
		await screen.findByText("Săn mây đỉnh Bà Nà");
		expect(client.getQueryData(["trip-recommendations", "camper-1", "list"])).toBeDefined();
	});

	it("keeps health assessments and preference summaries out of the results popup", async () => {
		service.list.mockResolvedValue(
			ready({
				healthBasis: {
					fitnessLevel: "Trung bình",
					activityProfile: null,
					hasMedicalConditions: false,
				},
				items: [
					{
						trip,
						reasons: ["fitness_match"],
						healthAssessment: {
							status: "suitable",
							summary: "Yêu cầu vận động trong mức khai báo.",
							comparisons: [
								{
									label: "Thể lực và độ khó",
									profileValue: "Trung bình",
									tripValue: "Dễ",
									result: "match",
									detail: "Độ khó phù hợp.",
								},
							],
							missingInformation: [],
							profileConfirmedAt: null,
						},
					},
				],
			})
		);
		renderBanner();
		openModal();
		await screen.findByText("Săn mây đỉnh Bà Nà");
		expect(screen.queryByText("Hồ sơ sức khỏe đã dùng")).not.toBeInTheDocument();
		expect(screen.queryByText("Thể lực và độ khó")).not.toBeInTheDocument();
		expect(screen.queryByText("Sở thích bổ sung")).not.toBeInTheDocument();
		expect(service.getPreferences).not.toHaveBeenCalled();
		expect(screen.getByRole("button", { name: "Sửa sở thích" })).toBeInTheDocument();
	});

	it("loads preferences only when the Camper chooses to edit them", async () => {
		service.list.mockResolvedValue(ready());
		renderBanner();
		openModal();
		await screen.findByText("Săn mây đỉnh Bà Nà");
		expect(service.getPreferences).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("button", { name: "Sửa sở thích" }));
		await screen.findByRole("dialog", { name: "Sở thích để gợi ý chuyến đi" });
		expect(service.getPreferences).toHaveBeenCalled();
	});
});
