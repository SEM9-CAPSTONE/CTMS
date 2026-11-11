import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAddBookingItem } from "../hooks/useAddBookingItem";
import { useBookingItems } from "../hooks/useBookingItems";
import { useTripEquipmentOptions } from "../hooks/useTripEquipmentOptions";
import type { BookingItem, TripEquipmentOption } from "../types";
import { BookingEquipmentPicker } from "./BookingEquipmentPicker";

vi.mock("../hooks/useTripEquipmentOptions", () => ({ useTripEquipmentOptions: vi.fn() }));
vi.mock("../hooks/useBookingItems", () => ({ useBookingItems: vi.fn() }));
vi.mock("../hooks/useAddBookingItem", () => ({ useAddBookingItem: vi.fn() }));

const option: TripEquipmentOption = {
	id: "item-1",
	hostId: "host-1",
	name: "4-person tent",
	category: "shelter",
	quantityTotal: 5,
	rentalPricePerDay: 50000,
	status: "active",
	maintenanceSchedule: null,
	createdAt: "2026-09-01T00:00:00.000Z",
	updatedAt: "2026-09-01T00:00:00.000Z",
};

describe("BookingEquipmentPicker", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(useBookingItems).mockReturnValue({
			items: [],
			isLoading: false,
			error: "",
			retry: vi.fn(),
		});
		vi.mocked(useAddBookingItem).mockReturnValue({
			isSubmitting: false,
			error: null,
			submit: vi.fn(),
			reset: vi.fn(),
		});
	});

	it("shows the loading state", () => {
		vi.mocked(useTripEquipmentOptions).mockReturnValue({
			items: [],
			isLoading: true,
			error: "",
			retry: vi.fn(),
		});
		render(
			<BookingEquipmentPicker tripId="trip-1" bookingId="booking-1" initialTotalAmount="0.00" />
		);

		expect(screen.getByTestId("equipment-options-loading")).toBeInTheDocument();
	});

	it("shows the empty state when the Host has no equipment", () => {
		vi.mocked(useTripEquipmentOptions).mockReturnValue({
			items: [],
			isLoading: false,
			error: "",
			retry: vi.fn(),
		});
		render(
			<BookingEquipmentPicker tripId="trip-1" bookingId="booking-1" initialTotalAmount="0.00" />
		);

		expect(screen.getByTestId("equipment-options-empty")).toBeInTheDocument();
	});

	it("submits the selected equipment and quantity, then updates the total", async () => {
		const submit = vi.fn().mockResolvedValue({
			item: { id: "item-1" },
			booking: { id: "booking-1", totalAmount: "150000.00" },
		});
		const retryItems = vi.fn();
		vi.mocked(useTripEquipmentOptions).mockReturnValue({
			items: [option],
			isLoading: false,
			error: "",
			retry: vi.fn(),
		});
		vi.mocked(useBookingItems).mockReturnValue({
			items: [],
			isLoading: false,
			error: "",
			retry: retryItems,
		});
		vi.mocked(useAddBookingItem).mockReturnValue({
			isSubmitting: false,
			error: null,
			submit,
			reset: vi.fn(),
		});

		render(
			<BookingEquipmentPicker
				tripId="trip-1"
				bookingId="booking-1"
				initialTotalAmount="0.00"
				defaultOpen={true}
			/>
		);

		fireEvent.change(screen.getByLabelText("Thiết bị"), { target: { value: "item-1" } });
		fireEvent.change(screen.getByLabelText("Số lượng thiết bị"), { target: { value: "2" } });
		fireEvent.click(screen.getByRole("button", { name: "Thêm thiết bị" }));

		await waitFor(() =>
			expect(submit).toHaveBeenCalledWith("booking-1", {
				equipmentCatalogItemId: "item-1",
				quantity: 2,
			})
		);
		await waitFor(() => expect(retryItems).toHaveBeenCalled());
		expect(screen.getByTestId("booking-total-amount")).toHaveTextContent("150.000");
	});

	it("notifies onEquipmentChanged after a successful add", async () => {
		const submit = vi.fn().mockResolvedValue({
			item: { id: "item-1" },
			booking: { id: "booking-1", totalAmount: "150000.00" },
		});
		const onEquipmentChanged = vi.fn();
		vi.mocked(useTripEquipmentOptions).mockReturnValue({
			items: [option],
			isLoading: false,
			error: "",
			retry: vi.fn(),
		});
		vi.mocked(useAddBookingItem).mockReturnValue({
			isSubmitting: false,
			error: null,
			submit,
			reset: vi.fn(),
		});

		render(
			<BookingEquipmentPicker
				tripId="trip-1"
				bookingId="booking-1"
				initialTotalAmount="0.00"
				onEquipmentChanged={onEquipmentChanged}
				defaultOpen={true}
			/>
		);

		fireEvent.change(screen.getByLabelText("Thiết bị"), { target: { value: "item-1" } });
		fireEvent.click(screen.getByRole("button", { name: "Thêm thiết bị" }));

		await waitFor(() => expect(onEquipmentChanged).toHaveBeenCalled());
	});

	it("shows the already-added items and the API error banner", () => {
		const addedItem: BookingItem = {
			id: "booking-item-1",
			bookingId: "booking-1",
			itemType: "equipment",
			equipmentCatalogItemId: "item-1",
			quantity: 2,
			unitPrice: "50000.00",
			rentalDays: 1,
			totalPrice: "100000.00",
			createdAt: "2026-09-01T00:00:00.000Z",
		};
		vi.mocked(useTripEquipmentOptions).mockReturnValue({
			items: [option],
			isLoading: false,
			error: "",
			retry: vi.fn(),
		});
		vi.mocked(useBookingItems).mockReturnValue({
			items: [addedItem],
			isLoading: false,
			error: "",
			retry: vi.fn(),
		});
		vi.mocked(useAddBookingItem).mockReturnValue({
			isSubmitting: false,
			error: {
				message: "Thiết bị không còn đủ số lượng.",
				isConflict: true,
				fieldErrors: {},
			},
			submit: vi.fn(),
			reset: vi.fn(),
		});

		render(
			<BookingEquipmentPicker
				tripId="trip-1"
				bookingId="booking-1"
				initialTotalAmount="0.00"
				defaultOpen={true}
			/>
		);

		expect(screen.getByTestId("booking-item-booking-item-1")).toHaveTextContent("4-person tent x2");
		expect(screen.getByRole("alert")).toHaveTextContent("Thiết bị không còn đủ số lượng.");
	});

	it("opens and closes the equipment picker modal dialog", () => {
		vi.mocked(useTripEquipmentOptions).mockReturnValue({
			items: [option],
			isLoading: false,
			error: "",
			retry: vi.fn(),
		});
		render(
			<BookingEquipmentPicker tripId="trip-1" bookingId="booking-1" initialTotalAmount="0.00" />
		);

		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: /thuê thiết bị/i }));
		expect(screen.getByRole("dialog")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Đóng bảng chọn thiết bị" }));
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	});
});
