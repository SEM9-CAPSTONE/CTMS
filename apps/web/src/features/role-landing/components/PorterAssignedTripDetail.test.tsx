import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { tripsService } from "../../trips/services/trips.service";
import type { PorterTripOperations } from "../../trips/types";
import { PorterAssignedTripDetail, PorterAssignedTripDetailView } from "./PorterAssignedTripDetail";

vi.mock("../../trekking-routes/components/RouteCheckpointMap", () => ({
	RouteCheckpointMap: () => <div data-testid="operational-route-map">Bản đồ tuyến</div>,
}));

const trip: PorterTripOperations = {
	tripId: "trip-1",
	title: "Trekking Bạch Mã",
	status: "published",
	routeName: "Vườn quốc gia Bạch Mã",
	assignmentStatus: "assigned",
	startsAt: "2026-10-19T23:00:00Z",
	endsAt: "2026-10-20T10:00:00Z",
	updatedAt: "2026-10-01T00:00:00Z",
	retrievedAt: "2026-10-16T00:00:00Z",
	meetingAt: "2026-10-19T22:45:00Z",
	meetingPoint: { type: "Point", coordinates: [107.85, 16.2] },
	meetingPointName: "Nhà điều hành Bạch Mã",
	waypoints: [
		{
			id: "wp-2",
			name: "Nghỉ giữa hành trình",
			type: "rest",
			dayNumber: 1,
			sequenceOrder: 2,
			plannedAt: "2026-10-20T04:30:00Z",
			durationMinutes: 30,
			location: { type: "Point", coordinates: [107.855, 16.205] },
		},
		{
			id: "wp-1",
			name: "Bắt đầu hành trình",
			type: "start",
			dayNumber: 1,
			sequenceOrder: 1,
			plannedAt: "2026-10-19T23:00:00Z",
			durationMinutes: null,
			location: { type: "Point", coordinates: [107.85, 16.2] },
		},
	],
	route: {
		id: "route",
		name: "Vườn quốc gia Bạch Mã",
		status: "active",
		geometry: {
			type: "LineString",
			coordinates: [
				[107.85, 16.2],
				[107.86, 16.21],
			],
		},
		updatedAt: "2026-10-01T00:00:00Z",
		checkpoints: [
			{
				id: "cp-1",
				routeId: "route",
				name: "Thác Đỗ Quyên",
				type: "water",
				location: { type: "Point", coordinates: [107.855, 16.205] },
				radiusMeters: 50,
				expectedArrivalOffset: 120,
				instructions: "Lấy thêm nước",
				nearbyWaterOrShelter: true,
				routePosition: 0.5,
				createdAt: "2026-10-01T00:00:00Z",
				updatedAt: "2026-10-01T00:00:00Z",
			},
		],
		dangerZones: [],
	},
	members: [{ memberId: "member", displayName: "Thành viên A", memberStatus: "joined" }],
	weather: { availability: "unavailable", maxAgeMinutes: 60, record: null },
	offlinePackage: { status: "unavailable", downloadedAt: null },
};

function operations(data: PorterTripOperations | undefined = trip, error: string | null = null) {
	return {
		data,
		error,
		isLoading: false,
		isStale: false,
		refetch: vi.fn().mockResolvedValue(undefined),
	};
}

describe("PorterAssignedTripDetail", () => {
	beforeEach(() => localStorage.setItem("authUser", JSON.stringify({ id: "porter" })));
	afterEach(() => {
		vi.restoreAllMocks();
		localStorage.clear();
	});

	it("shows the overview, Trip meeting point and four tabs including incidents", () => {
		render(<PorterAssignedTripDetailView operations={operations()} />);
		expect(screen.getByRole("heading", { level: 1, name: "Trekking Bạch Mã" })).toBeInTheDocument();
		expect(screen.getByText("Sắp diễn ra")).toBeInTheDocument();
		expect(screen.getByText("20/10/2026")).toBeInTheDocument();
		expect(screen.getByText("06:00 – 17:00")).toBeInTheDocument();
		expect(screen.getByText("Nhà điều hành Bạch Mã")).toBeInTheDocument();
		expect(screen.getByText("Có mặt lúc 05:45 · 20/10/2026")).toBeInTheDocument();
		expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
			"Lịch trình",
			"Tuyến đường",
			"Thành viên",
			"Sự cố",
		]);
	});

	it("lists the meeting time and waypoints in order with their real times", () => {
		render(<PorterAssignedTripDetailView operations={operations()} />);
		const panel = screen.getByRole("tabpanel");
		expect(within(panel).getByText("05:45 – Tập trung")).toBeInTheDocument();
		const titles = within(panel)
			.getAllByText(/^\d{2}:\d{2} – /)
			.map((element) => element.textContent);
		expect(titles).toEqual([
			"05:45 – Tập trung",
			"06:00 – Bắt đầu hành trình",
			"11:30 – Nghỉ giữa hành trình",
		]);
		expect(within(panel).queryByText(/^Ngày 1/)).not.toBeInTheDocument();
	});

	it("labels each day for multi-day Trips", () => {
		const multiDay: PorterTripOperations = {
			...trip,
			endsAt: "2026-10-21T09:00:00Z",
			waypoints: [
				...trip.waypoints,
				{
					id: "wp-3",
					name: "Về đích",
					type: "finish",
					dayNumber: 2,
					sequenceOrder: 3,
					plannedAt: "2026-10-21T09:00:00Z",
					durationMinutes: null,
					location: { type: "Point", coordinates: [107.86, 16.21] },
				},
			],
		};
		render(<PorterAssignedTripDetailView operations={operations(multiDay)} />);
		expect(screen.getByText("20/10 – 21/10/2026")).toBeInTheDocument();
		expect(screen.getByRole("heading", { name: "Ngày 1 · 20/10/2026" })).toBeInTheDocument();
		expect(screen.getByRole("heading", { name: "Ngày 2 · 21/10/2026" })).toBeInTheDocument();
	});

	it("shows the Trip waypoints on the route tab and the permitted members", async () => {
		render(<PorterAssignedTripDetailView operations={operations()} />);
		fireEvent.click(screen.getByRole("tab", { name: "Tuyến đường" }));
		expect(await screen.findByTestId("operational-route-map")).toBeInTheDocument();
		expect(screen.getByText("Các điểm trên tuyến (2)")).toBeInTheDocument();
		const points = within(screen.getByRole("tabpanel")).getAllByRole("listitem");
		expect(points.map((item) => item.textContent)).toEqual([
			expect.stringContaining("Bắt đầu hành trình"),
			expect.stringContaining("Nghỉ giữa hành trình"),
		]);
		expect(screen.getByText("Dự kiến 11:30 · 20/10/2026")).toBeInTheDocument();

		fireEvent.click(screen.getByRole("tab", { name: "Thành viên" }));
		expect(screen.getByText("Thành viên A")).toBeInTheDocument();
		expect(screen.getByText("Đã tham gia")).toBeInTheDocument();
	});

	it("falls back to route checkpoints when the Trip has no waypoints", () => {
		render(<PorterAssignedTripDetailView operations={operations({ ...trip, waypoints: [] })} />);
		fireEvent.click(screen.getByRole("tab", { name: "Tuyến đường" }));
		expect(screen.getByText("Thác Đỗ Quyên")).toBeInTheDocument();
		expect(screen.getByText("Lấy thêm nước")).toBeInTheDocument();
	});

	it("shows the finished status stored in the database", () => {
		render(
			<PorterAssignedTripDetailView operations={operations({ ...trip, status: "completed" })} />
		);
		expect(screen.getByText("Đã kết thúc")).toBeInTheDocument();
	});

	it("falls back to a generic meeting point label without inventing a route start", () => {
		render(
			<PorterAssignedTripDetailView
				operations={operations({ ...trip, meetingPointName: null, meetingAt: null })}
			/>
		);
		expect(screen.getByText("Điểm tập trung theo Trip")).toBeInTheDocument();
		expect(screen.getByText("Chưa có giờ tập trung")).toBeInTheDocument();
	});

	it("refuses to display a Trip outside the three porter statuses", () => {
		render(
			<PorterAssignedTripDetailView operations={operations({ ...trip, status: "cancelled" })} />
		);
		expect(screen.getByRole("alert")).toHaveTextContent("không còn hiển thị");
		expect(screen.queryByRole("tab")).not.toBeInTheDocument();
	});

	it("shows an error with retry and navigates back", () => {
		const onBack = vi.fn();
		const state = operations(undefined, "Phân công không còn hợp lệ");
		render(<PorterAssignedTripDetailView operations={state} onBack={onBack} />);
		fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
		expect(state.refetch).toHaveBeenCalledOnce();
		fireEvent.click(screen.getByRole("button", { name: "Quay lại danh sách phân công" }));
		expect(onBack).toHaveBeenCalledOnce();
	});

	it("keeps the incident tab accessible with a previously authorized offline snapshot", () => {
		render(
			<PorterAssignedTripDetailView operations={operations(trip, "Không thể kết nối máy chủ")} />
		);
		expect(screen.getByRole("alert")).toHaveTextContent("Không thể kết nối máy chủ");
		expect(screen.getByRole("tab", { name: "Sự cố" })).toBeInTheDocument();
	});

	it("loads the assigned Trip and reports a revoked assignment", async () => {
		const load = vi
			.spyOn(tripsService, "getAssignedTripOperations")
			.mockResolvedValueOnce(trip)
			.mockRejectedValue(new HttpError("revoked", 404, null));
		const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
		render(
			<QueryClientProvider client={client}>
				<PorterAssignedTripDetail tripId="trip-1" />
			</QueryClientProvider>
		);
		expect(
			await screen.findByRole("heading", { level: 1, name: "Trekking Bạch Mã" })
		).toBeInTheDocument();
		expect(load).toHaveBeenCalledWith("trip-1");
		fireEvent.click(screen.getByRole("button", { name: "Tải lại chi tiết" }));
		await waitFor(() =>
			expect(screen.getByRole("alert")).toHaveTextContent("Phân công không còn hợp lệ")
		);
	});
});
