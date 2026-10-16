import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TripDetails } from "../../trips/types";
import { useHostOperationalOverview } from "../hooks/useHostOperationalOverview";
import { buildHostOperationalOverview } from "../utils/host-operational-overview";
import { HostOperationalOverview } from "./HostOperationalOverview";

vi.mock("../hooks/useHostOperationalOverview", () => ({ useHostOperationalOverview: vi.fn() }));
vi.mock("./HostTripMap", () => ({
	HostTripMap: ({ trip }: { trip: TripDetails }) => <div data-testid="selected-map">{trip.id}</div>,
}));

const now = Date.parse("2026-10-15T09:00:00+07:00");
function trip(id: string): TripDetails {
	return {
		id,
		title: id,
		hostId: "host",
		description: null,
		coverImageUrl: null,
		itinerary: null,
		includes: null,
		excludes: null,
		tripType: "day_trip",
		durationNights: 0,
		startsAt: "2026-10-15T08:00:00+07:00",
		endsAt: "2026-10-15T17:00:00+07:00",
		meetingPoint: { type: "Point", coordinates: [108, 16] },
		meetingAt: null,
		bookingDeadline: "2026-10-14T00:00:00+07:00",
		capacityMin: 1,
		capacityMax: 15,
		seatsTaken: 0,
		remainingSeats: 15,
		pricePerPerson: 100000,
		cancellationPolicy: null,
		status: "ongoing",
		cancellationReason: null,
		cancelledAt: null,
		weatherRiskLevel: "green",
		isBookable: false,
		createdAt: "2026-10-01T00:00:00Z",
		updatedAt: "2026-10-01T00:00:00Z",
		waypoints: [],
	};
}
function setTrips(trips: TripDetails[]) {
	vi.mocked(useHostOperationalOverview).mockReturnValue({
		...buildHostOperationalOverview(trips, [], now),
		isLoading: false,
		isError: false,
		portersUnavailable: false,
		isRefreshing: false,
		updatedAt: now,
		refresh: vi.fn(),
	});
}

describe("HostOperationalOverview trip selection", () => {
	beforeEach(() => vi.clearAllMocks());
	it("shows simultaneous trips and switches the map and details to the selected trip", () => {
		setTrips([trip("abcd"), trip("abc")]);
		const navigate = vi.fn();
		render(<HostOperationalOverview hostId="host" onNavigateToTripDetail={navigate} />);
		expect(screen.getByText("Đang diễn ra (2)")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "abcd" })).toHaveAttribute("aria-pressed", "true");
		fireEvent.click(screen.getByRole("button", { name: "abc" }));
		expect(screen.getByRole("button", { name: "abc" })).toHaveAttribute("aria-pressed", "true");
		expect(screen.getByRole("heading", { name: "abc" })).toBeInTheDocument();
		expect(screen.getByTestId("selected-map")).toHaveTextContent("abc");
		fireEvent.click(screen.getByRole("button", { name: "Xem chi tiết chuyến đi" }));
		expect(navigate).toHaveBeenCalledWith("abc");
	});

	it("preserves the selection on refresh and falls back if the selected trip finishes", () => {
		setTrips([trip("abcd"), trip("abc")]);
		const { rerender } = render(<HostOperationalOverview hostId="host" />);
		fireEvent.click(screen.getByRole("button", { name: "abc" }));
		setTrips([trip("abcd"), trip("abc")]);
		rerender(<HostOperationalOverview hostId="host" />);
		expect(screen.getByTestId("selected-map")).toHaveTextContent("abc");
		setTrips([trip("abcd"), { ...trip("abc"), status: "completed" }]);
		rerender(<HostOperationalOverview hostId="host" />);
		expect(screen.getByTestId("selected-map")).toHaveTextContent("abcd");
		expect(screen.queryByRole("button", { name: "abc" })).not.toBeInTheDocument();
	});
});
