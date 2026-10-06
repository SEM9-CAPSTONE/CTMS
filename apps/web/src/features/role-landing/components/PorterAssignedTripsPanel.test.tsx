import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PorterAssignedTripsPanelView } from "./PorterAssignedTripsPanel";

const emptyState = {
	trips: [],
	isLoading: false,
	error: null,
	refetch: vi.fn().mockResolvedValue(null),
};

describe("PorterAssignedTripsPanel", () => {
	it("renders loading and empty states", () => {
		const { rerender } = render(<PorterAssignedTripsPanelView {...emptyState} isLoading />);
		expect(screen.getByText("Đang tải chuyến đi được phân công...")).toBeInTheDocument();
		rerender(<PorterAssignedTripsPanelView {...emptyState} />);
		expect(screen.getByText("Chưa có chuyến đi nào được phân công.")).toBeInTheDocument();
	});

	it("navigates to the selected assigned Trip", () => {
		const onNavigate = vi.fn();
		render(
			<PorterAssignedTripsPanelView
				{...emptyState}
				trips={[
					{
						tripId: "trip-1",
						title: "Bidoup vận hành",
						status: "ongoing",
						startsAt: "2035-01-01T00:00:00.000Z",
						endsAt: "2035-01-01T08:00:00.000Z",
					},
				]}
				onNavigateToTripRoster={onNavigate}
			/>
		);
		fireEvent.click(screen.getByRole("button", { name: /Mở danh sách/i }));
		expect(onNavigate).toHaveBeenCalledWith("trip-1");
	});

	it("shows an error with retry", () => {
		const refetch = vi.fn().mockResolvedValue(null);
		render(
			<PorterAssignedTripsPanelView {...emptyState} error="Không thể tải" refetch={refetch} />
		);
		fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
		expect(refetch).toHaveBeenCalledTimes(1);
	});
});
