import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bookingEquipmentService } from "../../booking-equipment/services/booking-equipment.service";
import type { TripEquipmentOption } from "../../booking-equipment/types";
import { TripRentableEquipment, formatEquipmentCategory } from "./TripRentableEquipment";

vi.mock("../../booking-equipment/services/booking-equipment.service", () => ({
	bookingEquipmentService: {
		listForTrip: vi.fn(),
	},
}));

describe("TripRentableEquipment", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		cleanup();
	});

	it("formats equipment categories correctly", () => {
		expect(formatEquipmentCategory("shelter")).toBe("Lều bạt");
		expect(formatEquipmentCategory("sleeping")).toBe("Túi & đệm ngủ");
		expect(formatEquipmentCategory("backpack")).toBe("Balo & túi");
		expect(formatEquipmentCategory("gear")).toBe("Trang bị dã ngoại");
		expect(formatEquipmentCategory("lighting")).toBe("Đèn & chiếu sáng");
		expect(formatEquipmentCategory("cooking")).toBe("Dụng cụ nấu nướng");
		expect(formatEquipmentCategory("safety")).toBe("An toàn & y tế");
		expect(formatEquipmentCategory("other")).toBe("other");
	});

	it("renders anonymous preview when bookingAccess is anonymous", () => {
		const onSignIn = vi.fn();
		render(<TripRentableEquipment tripId="trip-1" bookingAccess="anonymous" onSignIn={onSignIn} />);

		expect(screen.getByTestId("equipment-preview-anonymous")).toBeInTheDocument();
		const signInBtn = screen.getByRole("button", { name: "Đăng nhập để xem thiết bị" });
		fireEvent.click(signInBtn);
		expect(onSignIn).toHaveBeenCalled();
		expect(bookingEquipmentService.listForTrip).not.toHaveBeenCalled();
	});

	it("renders non-camper notice when bookingAccess is non-camper", () => {
		render(<TripRentableEquipment tripId="trip-1" bookingAccess="non-camper" />);
		expect(screen.getByTestId("equipment-preview-non-camper")).toBeInTheDocument();
		expect(bookingEquipmentService.listForTrip).not.toHaveBeenCalled();
	});

	it("renders error state with retry button on failure", async () => {
		vi.mocked(bookingEquipmentService.listForTrip).mockRejectedValueOnce(
			new Error("Failed to load")
		);

		render(<TripRentableEquipment tripId="trip-1" bookingAccess="camper" />);

		await waitFor(() => {
			expect(screen.getByRole("alert")).toBeInTheDocument();
		});

		vi.mocked(bookingEquipmentService.listForTrip).mockResolvedValueOnce([]);
		fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));

		await waitFor(() => {
			expect(screen.getByTestId("equipment-preview-empty")).toBeInTheDocument();
		});
	});

	it("renders empty message when no equipment is available", async () => {
		vi.mocked(bookingEquipmentService.listForTrip).mockResolvedValueOnce([]);

		render(<TripRentableEquipment tripId="trip-1" bookingAccess="camper" />);

		await waitFor(() => {
			expect(screen.getByTestId("equipment-preview-empty")).toBeInTheDocument();
		});
	});

	it("renders equipment list when items are available", async () => {
		const sampleItems: TripEquipmentOption[] = [
			{
				id: "eq-1",
				hostId: "host-1",
				name: "Lều cắm trại 2 người Naturehike",
				category: "shelter",
				quantityTotal: 10,
				rentalPricePerDay: 80000,
				status: "active",
				maintenanceSchedule: "Kiểm tra sau chuyến đi",
				createdAt: "2026-01-01",
				updatedAt: "2026-01-01",
			},
			{
				id: "eq-2",
				hostId: "host-1",
				name: "Túi ngủ du lịch",
				category: "sleeping",
				quantityTotal: 20,
				rentalPricePerDay: 40000,
				status: "active",
				maintenanceSchedule: null,
				createdAt: "2026-01-01",
				updatedAt: "2026-01-01",
			},
		];

		vi.mocked(bookingEquipmentService.listForTrip).mockResolvedValueOnce(sampleItems);

		render(<TripRentableEquipment tripId="trip-1" bookingAccess="camper" />);

		await waitFor(() => {
			expect(screen.getByTestId("equipment-count-badge")).toHaveTextContent("2 thiết bị có sẵn");
		});

		expect(screen.getByText("Lều cắm trại 2 người Naturehike")).toBeInTheDocument();
		expect(screen.getByText("Lều bạt")).toBeInTheDocument();
		expect(screen.getByText(/80\.000/)).toBeInTheDocument();
		expect(screen.getByText("Túi ngủ du lịch")).toBeInTheDocument();
		expect(screen.getByText("Túi & đệm ngủ")).toBeInTheDocument();
		expect(screen.getByText(/40\.000/)).toBeInTheDocument();
	});
});
