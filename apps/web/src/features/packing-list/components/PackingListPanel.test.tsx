import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PackingListResponse } from "../types";

type ComponentModule = typeof import("./PackingListPanel");

let componentModule: ComponentModule;
let usePackingListMock: ReturnType<typeof vi.fn>;

function response(overrides: Partial<PackingListResponse> = {}): PackingListResponse {
	return {
		bookingId: "booking-1",
		tripId: "trip-1",
		context: {
			durationNights: 0,
			tripType: "day_trip",
			difficulty: null,
			memberCount: 1,
			weatherRiskLevel: null,
		},
		items: [],
		...overrides,
	};
}

describe("PackingListPanel", () => {
	beforeEach(async () => {
		vi.resetModules();
		usePackingListMock = vi.fn();
		vi.doMock("../hooks/usePackingList", () => ({
			usePackingList: usePackingListMock,
		}));

		componentModule = await import("./PackingListPanel");
	});

	afterEach(() => {
		vi.doUnmock("../hooks/usePackingList");
		vi.resetModules();
	});

	it("shows the loading state", () => {
		usePackingListMock.mockReturnValue({
			packingList: null,
			isLoading: true,
			error: "",
			retry: vi.fn(),
		});
		render(<componentModule.PackingListPanel bookingId="booking-1" />);
		expect(screen.getByTestId("packing-list-loading")).toBeInTheDocument();
	});

	it("shows an error with a retry action", () => {
		const retry = vi.fn();
		usePackingListMock.mockReturnValue({
			packingList: null,
			isLoading: false,
			error: "Không thể tải packing list. Vui lòng thử lại.",
			retry,
		});
		render(<componentModule.PackingListPanel bookingId="booking-1" />);
		expect(screen.getByRole("alert")).toHaveTextContent("Không thể tải packing list");
		screen.getByRole("button", { name: /tải lại/i }).click();
		expect(retry).toHaveBeenCalled();
	});

	it("shows the empty state when there are no items", () => {
		usePackingListMock.mockReturnValue({
			packingList: response(),
			isLoading: false,
			error: "",
			retry: vi.fn(),
		});
		render(<componentModule.PackingListPanel bookingId="booking-1" />);
		expect(screen.getByTestId("packing-list-empty")).toBeInTheDocument();
	});

	it("splits required and recommended items and shows the already-covered badge", () => {
		usePackingListMock.mockReturnValue({
			packingList: response({
				context: {
					durationNights: 2,
					tripType: "overnight",
					difficulty: "hard",
					memberCount: 2,
					weatherRiskLevel: "yellow",
				},
				items: [
					{
						id: "id-documents",
						name: "Giấy tờ tùy thân",
						category: "essential",
						required: true,
						reason: "Luôn cần mang theo",
						alreadyCovered: false,
					},
					{
						id: "tent",
						name: "Lều cắm trại",
						category: "gear",
						required: false,
						reason: "Đã có trong thiết bị thuê",
						alreadyCovered: true,
					},
					{
						id: "trekking-poles",
						name: "Gậy leo núi",
						category: "gear",
						required: false,
						reason: "Hỗ trợ di chuyển ở địa hình khó",
						alreadyCovered: false,
					},
				],
			}),
			isLoading: false,
			error: "",
			retry: vi.fn(),
		});
		render(<componentModule.PackingListPanel bookingId="booking-1" />);

		expect(screen.getByText("Bắt buộc")).toBeInTheDocument();
		expect(screen.getByText("Khuyến nghị")).toBeInTheDocument();
		expect(screen.getByTestId("packing-list-item-id-documents")).toBeInTheDocument();
		expect(screen.getByTestId("packing-list-item-tent")).toHaveTextContent(
			"Đã có trong thiết bị thuê"
		);
		expect(screen.getByText("Qua đêm (2 đêm)")).toBeInTheDocument();
		expect(screen.getByText("Độ khó: Khó")).toBeInTheDocument();
		expect(screen.getByText("Thời tiết: Cần lưu ý")).toBeInTheDocument();
	});
});
