import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { usePorterCandidateTrips } from "../hooks/usePorterCandidateTrips";
import { tripsService } from "../services/trips.service";
import type { PorterRequest, TripDetails } from "../types";
import { HostPorterRequestsPage } from "./HostPorterRequestsPage";

vi.mock("../hooks/usePorterCandidateTrips", () => ({
	usePorterCandidateTrips: vi.fn(),
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
		status: "published",
	},
];

const pendingRequest: PorterRequest = {
	id: "request-1",
	tripId: "trip-1",
	porterId: "porter-1",
	requestedBy: "host-1",
	requestedRole: "support",
	note: null,
	status: "pending",
	expiresAt: "2099-09-27T00:00:00Z",
	respondedAt: null,
	createdAt: "2026-01-01T00:00:00Z",
	updatedAt: "2026-01-01T00:00:00Z",
};

function renderPage(props: ComponentProps<typeof HostPorterRequestsPage> = {}) {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
	return render(
		<QueryClientProvider client={client}>
			<HostPorterRequestsPage {...props} />
		</QueryClientProvider>
	);
}

describe("HostPorterRequestsPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		window.history.replaceState({}, "", "/host/porter");
		vi.spyOn(tripsService, "getHostPorterAssignments").mockResolvedValue([]);
		vi.spyOn(tripsService, "getHostPorterRequests").mockResolvedValue([pendingRequest]);
		vi.mocked(usePorterCandidateTrips).mockReturnValue({
			trips,
			isLoading: false,
			error: "",
			refetch: vi.fn(),
		});
	});
	afterEach(() => vi.restoreAllMocks());

	it("preselects the Trip from the query context and renders the request search panel", () => {
		renderPage({ initialTripId: "trip-2" });

		expect(screen.getByLabelText("Chuyến đi")).toHaveValue("trip-2");
		expect(screen.getByTestId("available-porters-panel")).toHaveTextContent("Trip: trip-2");
		expect(screen.getByRole("heading", { name: "Tìm người hỗ trợ chuyến đi" })).toBeInTheDocument();
	});

	it("updates the selected Trip without fabricating a request state", () => {
		renderPage();

		fireEvent.change(screen.getByLabelText("Chuyến đi"), { target: { value: "trip-2" } });

		expect(screen.getByTestId("available-porters-panel")).toHaveTextContent("Trip: trip-2");
		expect(new URLSearchParams(window.location.search).get("tripId")).toBe("trip-2");
		expect(new URLSearchParams(window.location.search).get("view")).toBe("find");
		expect(screen.queryByText("Đang chờ phản hồi")).not.toBeInTheDocument();
	});

	it("loads the assigned view and shows the backend's empty assignment history", async () => {
		renderPage({ initialView: "assigned" });
		expect(screen.getByRole("heading", { name: "Porter đã phân công" })).toBeInTheDocument();
		expect(await screen.findByText("Chưa có lịch sử phân công Porter.")).toBeInTheDocument();
		expect(tripsService.getHostPorterAssignments).toHaveBeenCalledOnce();
		expect(screen.queryByTestId("available-porters-panel")).not.toBeInTheDocument();
	});

	it("cancels a pending request after confirmation and refreshes its state", async () => {
		const cancel = vi.spyOn(tripsService, "cancelPorterRequest").mockImplementation(async () => {
			vi.mocked(tripsService.getHostPorterRequests).mockResolvedValue([]);
			return { ...pendingRequest, status: "cancelled" };
		});
		renderPage({ initialView: "requests" });
		fireEvent.click(await screen.findByRole("button", { name: "Hủy yêu cầu" }));
		expect(cancel).not.toHaveBeenCalled();
		fireEvent.click(screen.getByTestId("confirm-modal-submit"));
		await waitFor(() => expect(screen.queryByTestId("confirm-modal")).not.toBeInTheDocument());
		expect(cancel).toHaveBeenCalledExactlyOnceWith("trip-1", "request-1");
		expect(await screen.findByText("Không có yêu cầu ở trạng thái này.")).toBeInTheDocument();
	});

	it("keeps cancellation network errors visible in the modal", async () => {
		vi.spyOn(tripsService, "cancelPorterRequest").mockRejectedValue(new Error("offline"));
		renderPage({ initialView: "requests" });
		fireEvent.click(await screen.findByRole("button", { name: "Hủy yêu cầu" }));
		fireEvent.click(screen.getByTestId("confirm-modal-submit"));
		expect(await within(screen.getByTestId("confirm-modal")).findByRole("alert")).toHaveTextContent(
			"Vui lòng thử lại"
		);
		await waitFor(() => expect(screen.getByTestId("confirm-modal-submit")).toBeEnabled());
	});

	it("refreshes a request accepted by the Porter before the Host cancellation", async () => {
		vi.spyOn(tripsService, "cancelPorterRequest").mockImplementation(async () => {
			vi.mocked(tripsService.getHostPorterRequests).mockResolvedValue([
				{ ...pendingRequest, status: "accepted" },
			]);
			throw new HttpError("terminal", 409, null);
		});
		renderPage({ initialView: "requests" });
		fireEvent.click(await screen.findByRole("button", { name: "Hủy yêu cầu" }));
		fireEvent.click(screen.getByTestId("confirm-modal-submit"));
		await waitFor(() => expect(screen.queryByTestId("confirm-modal")).not.toBeInTheDocument());
		expect(screen.getByRole("alert")).toHaveTextContent("Yêu cầu không còn hợp lệ");
		fireEvent.click(screen.getByRole("button", { name: "Đã chấp nhận" }));
		expect(screen.getByText("Đã chấp nhận", { selector: "span" })).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Hủy yêu cầu" })).not.toBeInTheDocument();
	});
});
