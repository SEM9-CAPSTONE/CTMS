import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import type { TripDetails } from "../types";
import { HostTripOperationsPanel } from "./HostTripOperationsPanel";

const trip: TripDetails = {
	id: "trip-host-1",
	hostId: "host-1",
	title: "Host trip",
	description: null,
	coverImageUrl: null,
	itinerary: null,
	includes: null,
	excludes: null,
	tripType: "day_trip",
	durationNights: 0,
	startsAt: "2099-10-10T01:00:00.000Z",
	endsAt: "2099-10-10T08:00:00.000Z",
	meetingPoint: { type: "Point", coordinates: [108.1, 11.1] },
	meetingAt: null,
	bookingDeadline: "2099-10-09T00:00:00.000Z",
	capacityMin: 2,
	capacityMax: 10,
	seatsTaken: 4,
	remainingSeats: 6,
	pricePerPerson: 100000,
	cancellationPolicy: null,
	status: "published",
	difficulty: "moderate",
	weatherRiskLevel: "green",
	isBookable: true,
	createdAt: "2026-09-01T00:00:00.000Z",
	updatedAt: "2026-09-01T00:00:00.000Z",
	waypoints: [],
};

function renderPanel(overrides: Partial<ComponentProps<typeof HostTripOperationsPanel>> = {}) {
	const props: ComponentProps<typeof HostTripOperationsPanel> = {
		trip,
		isSubmitting: false,
		error: null,
		successMessage: null,
		onReschedule: vi.fn().mockResolvedValue(trip),
		onCancel: vi.fn().mockResolvedValue(trip),
		onRetry: vi.fn().mockResolvedValue(trip),
		onReset: vi.fn(),
		onRefreshTrip: vi.fn(),
		...overrides,
	};
	render(<HostTripOperationsPanel {...props} />);
	return props;
}

describe("HostTripOperationsPanel", () => {
	it("submits a valid reschedule and refreshes authoritative trip state", async () => {
		const onReschedule = vi.fn().mockResolvedValue(trip);
		const onRefreshTrip = vi.fn();
		renderPanel({ onReschedule, onRefreshTrip });

		fireEvent.change(screen.getByLabelText(/bắt đầu mới/i), {
			target: { value: "2099-10-11T07:30" },
		});
		fireEvent.change(screen.getByLabelText(/kết thúc mới/i), {
			target: { value: "2099-10-11T15:30" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Xác nhận đổi lịch" }));

		await vi.waitFor(() => {
			expect(onReschedule).toHaveBeenCalledWith({
				startsAt: expect.stringMatching(/^2099-10-1[01]T/),
				endsAt: expect.stringMatching(/^2099-10-1[01]T/),
			});
		});
		expect(onRefreshTrip).toHaveBeenCalled();
	});

	it("keeps validation on the client before calling the backend", () => {
		const onReschedule = vi.fn();
		renderPanel({ onReschedule });

		fireEvent.change(screen.getByLabelText(/bắt đầu mới/i), {
			target: { value: "2020-01-01T01:00" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Xác nhận đổi lịch" }));

		expect(
			screen.getByText("Thời gian bắt đầu mới phải cách thời điểm hiện tại ít nhất 24 giờ.")
		).toBeVisible();
		expect(onReschedule).not.toHaveBeenCalled();
	});

	it("validates reschedule dates immediately when selected", () => {
		const onReschedule = vi.fn();
		renderPanel({ onReschedule });

		fireEvent.change(screen.getByLabelText(/bắt đầu mới/i), {
			target: { value: "2020-01-01T01:00" },
		});

		expect(
			screen.getByText("Thời gian bắt đầu mới phải cách thời điểm hiện tại ít nhất 24 giờ.")
		).toBeVisible();

		fireEvent.change(screen.getByLabelText(/kết thúc mới/i), {
			target: { value: "2019-01-01T01:00" },
		});

		expect(screen.getByText("Thời gian kết thúc phải sau thời gian bắt đầu.")).toBeVisible();
		expect(onReschedule).not.toHaveBeenCalled();
	});

	it("requires an actual schedule change before rescheduling", () => {
		const onReschedule = vi.fn();
		renderPanel({ onReschedule });

		fireEvent.click(screen.getByRole("button", { name: "Xác nhận đổi lịch" }));

		expect(screen.getByText("Cần nhập thời gian bắt đầu hoặc kết thúc mới.")).toBeVisible();
		expect(onReschedule).not.toHaveBeenCalled();
	});

	it("opens edit flow for pre-publication trips", () => {
		const onEditTrip = vi.fn();
		renderPanel({
			trip: { ...trip, status: "pending_approval" },
			onEditTrip,
		});

		fireEvent.click(screen.getByRole("button", { name: "Mở màn hình chỉnh sửa" }));

		expect(onEditTrip).toHaveBeenCalled();
	});

	it("shows blocked state for completed trips", () => {
		renderPanel({ trip: { ...trip, status: "completed" } });

		expect(screen.getByTestId("host-trip-operations-blocked")).toHaveTextContent(
			"Không còn thao tác khả dụng"
		);
	});

	it("shows conflict state and exposes retry", () => {
		const onRetry = vi.fn().mockResolvedValue(trip);
		renderPanel({
			onRetry,
			error: {
				status: 409,
				message: "Trạng thái chuyến đi đã thay đổi.",
				fieldErrors: {},
				kind: "conflict",
				canRetry: true,
			},
		});

		expect(screen.getByRole("alert")).toHaveTextContent("Trạng thái chuyến đi đã thay đổi.");
		fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
		expect(onRetry).toHaveBeenCalled();
	});

	it("submits cancellation only after a reason is provided", async () => {
		const onCancel = vi.fn().mockResolvedValue(trip);
		renderPanel({ onCancel });

		fireEvent.click(screen.getByRole("button", { name: "Huỷ chuyến" }));
		fireEvent.click(screen.getByRole("button", { name: "Huỷ chuyến đi" }));
		expect(screen.getByText("Cần nhập lý do huỷ chuyến đi.")).toBeVisible();
		expect(onCancel).not.toHaveBeenCalled();

		fireEvent.change(screen.getByPlaceholderText(/nhập lý do huỷ/i), {
			target: { value: "Mưa lớn kéo dài" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Huỷ chuyến đi" }));

		await vi.waitFor(() => {
			expect(onCancel).toHaveBeenCalledWith({ reason: "Mưa lớn kéo dài" });
		});
	});
});
