import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type PageModule = typeof import("./PackingListPage");

let pageModule: PageModule;
let usePackingListMock: ReturnType<typeof vi.fn>;

describe("PackingListPage", () => {
	beforeEach(async () => {
		vi.resetModules();
		usePackingListMock = vi.fn().mockReturnValue({
			packingList: null,
			isLoading: true,
			error: "",
			retry: vi.fn(),
		});
		vi.doMock("../hooks/usePackingList", () => ({
			usePackingList: usePackingListMock,
		}));

		pageModule = await import("./PackingListPage");
	});

	afterEach(() => {
		vi.doUnmock("../hooks/usePackingList");
		vi.resetModules();
	});

	it("renders the header and delegates the Booking id to the panel", () => {
		render(<pageModule.PackingListPage bookingId="booking-1" />);

		expect(screen.getByText("Packing list cho chuyến đi")).toBeInTheDocument();
		expect(usePackingListMock).toHaveBeenCalledWith("booking-1", 0);
	});

	it("calls onBack when the back button is clicked", () => {
		const onBack = vi.fn();

		render(<pageModule.PackingListPage bookingId="booking-1" onBack={onBack} />);
		fireEvent.click(screen.getByLabelText("Quay lại"));

		expect(onBack).toHaveBeenCalled();
	});
});
