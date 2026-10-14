import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMyTrips } from "../hooks/useMyTrips";
import type { TripDetails } from "../types";
import { HostPorterRequestsPage } from "./HostPorterRequestsPage";

vi.mock("../hooks/useMyTrips", () => ({
	useMyTrips: vi.fn(),
}));

vi.mock("../components/AvailablePortersPanel", () => ({
	AvailablePortersPanel: ({ tripId }: { tripId: string }) => (
		<div data-testid="available-porters-panel">Trip: {tripId}</div>
	),
}));

const baseTrip: TripDetails = {
	id: "trip-1",
	hostId: "host-1",
	title: "Bidoup cuối tuần",
	description: null,
	coverImageUrl: null,
	itinerary: null,
	includes: null,
	excludes: null,
	tripType: "day_trip",
	durationNights: 0,
	startsAt: "2099-09-28T06:00:00.000Z",
	endsAt: "2099-09-28T17:00:00.000Z",
	meetingPoint: { type: "Point", coordinates: [108.45, 11.94] },
	meetingAt: null,
	bookingDeadline: "2099-09-26T23:00:00.000Z",
	capacityMin: 8,
	capacityMax: 16,
	seatsTaken: 0,
	remainingSeats: 16,
	pricePerPerson: 1850000,
	cancellationPolicy: null,
	status: "published",
	cancellationReason: null,
	cancelledAt: null,
	difficulty: "moderate",
	weatherRiskLevel: "green",
	isBookable: true,
	createdAt: "2026-08-25T00:00:00.000Z",
	updatedAt: "2026-08-25T00:00:00.000Z",
	waypoints: [],
};

const trips: TripDetails[] = [
	baseTrip,
	{
		...baseTrip,
		id: "trip-2",
		title: "Tà Năng mùa khô",
		status: "pending_approval",
	},
];

describe("HostPorterRequestsPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		window.history.replaceState({}, "", "/host/porter");
		vi.mocked(useMyTrips).mockReturnValue({
			trips,
			isLoading: false,
			error: "",
			refetch: vi.fn(),
		});
	});

	it("preselects the Trip from the query context and renders the request search panel", () => {
		render(<HostPorterRequestsPage initialTripId="trip-2" />);

		expect(screen.getByLabelText("Trip")).toHaveValue("trip-2");
		expect(screen.getByTestId("available-porters-panel")).toHaveTextContent("Trip: trip-2");
		expect(screen.getByRole("button", { name: "Tìm Porter" })).toHaveClass("border-[#164027]");
	});

	it("updates the selected Trip without fabricating a request state", () => {
		render(<HostPorterRequestsPage />);

		fireEvent.change(screen.getByLabelText("Trip"), { target: { value: "trip-2" } });

		expect(screen.getByTestId("available-porters-panel")).toHaveTextContent("Trip: trip-2");
		expect(window.location.search).toBe("?tripId=trip-2");
		expect(screen.queryByText("Đang chờ phản hồi")).not.toBeInTheDocument();
	});

	it("keeps follow-up tabs scoped out of this UI implementation", () => {
		render(<HostPorterRequestsPage initialTripId="trip-1" />);

		fireEvent.click(screen.getByRole("button", { name: "Đã phân công" }));

		expect(screen.getAllByText("Đã phân công")).toHaveLength(2);
		expect(
			screen.getByText(/chỉ triển khai thao tác tìm Porter và gửi yêu cầu/i)
		).toBeInTheDocument();
		expect(screen.queryByTestId("available-porters-panel")).not.toBeInTheDocument();
	});
});
