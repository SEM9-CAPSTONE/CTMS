import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CreatedTrekkingRoute, RouteCheckpoint } from "../../trekking-routes/types";
import { tripsService } from "../services/trips.service";
import type { Trip } from "../types";
import { ConfigureTripWaypointsPanel } from "./ConfigureTripWaypointsPanel";

vi.mock("../services/trips.service", () => ({
	tripsService: { configureWaypoints: vi.fn() },
}));

const checkpoint: RouteCheckpoint = {
	id: "44444444-4444-4444-8444-444444444444",
	routeId: "22222222-2222-4222-8222-222222222222",
	name: "Ridge camp checkpoint",
	location: { type: "Point", coordinates: [108.24, 16.05] },
	radiusMeters: 50,
	type: "rest",
	expectedArrivalOffset: 120,
	instructions: "Rest here",
	nearbyWaterOrShelter: true,
	routePosition: 0.5,
	createdAt: "2026-09-01T00:00:00.000Z",
	updatedAt: "2026-09-01T00:00:00.000Z",
};

const route: CreatedTrekkingRoute = {
	id: "22222222-2222-4222-8222-222222222222",
	name: "Bidoup route",
	description: null,
	geometry: {
		type: "LineString",
		coordinates: [
			[108.22, 16.04],
			[108.24, 16.05],
			[108.25, 16.06],
		],
	},
	difficulty: "moderate",
	expectedDurationMinutes: 480,
	lengthMeters: 5000,
	status: "active",
	createdAt: "2026-09-01T00:00:00.000Z",
	updatedAt: "2026-09-01T00:00:00.000Z",
};

let checkpointState = {
	items: [checkpoint],
	isLoading: false,
	error: "",
	reload: vi.fn(),
};

vi.mock("../../trekking-routes/hooks/useRouteCheckpoints", () => ({
	useRouteCheckpoints: () => checkpointState,
}));

const draftTrip: Trip = {
	id: "33333333-3333-4333-8333-333333333333",
	hostId: "11111111-1111-4111-8111-111111111111",
	routeId: "22222222-2222-4222-8222-222222222222",
	title: "Bidoup draft",
	description: null,
	coverImageUrl: null,
	itinerary: null,
	includes: null,
	excludes: null,
	tripType: "day_trip",
	durationNights: 0,
	startsAt: "2026-10-01T02:00:00.000Z",
	endsAt: "2026-10-01T10:00:00.000Z",
	meetingPoint: { type: "Point", coordinates: [108.22, 16.04] },
	meetingAt: null,
	bookingDeadline: "2026-09-30T02:00:00.000Z",
	capacityMin: 2,
	capacityMax: 12,
	seatsTaken: 0,
	pricePerPerson: 0,
	cancellationPolicy: null,
	status: "draft",
	createdAt: "2026-09-22T00:00:00.000Z",
	updatedAt: "2026-09-22T00:00:00.000Z",
	waypoints: [
		{
			id: "66666666-6666-4666-8666-666666666666",
			tripId: "33333333-3333-4333-8333-333333333333",
			checkpointId: null,
			type: "start",
			name: "Trailhead",
			location: { type: "Point", coordinates: [108.22, 16.04] },
			dayNumber: 1,
			sequenceOrder: 1,
			plannedAt: "2026-10-01T02:00:00.000Z",
			durationMinutes: null,
			metadata: null,
		},
		{
			id: "77777777-7777-4777-8777-777777777777",
			tripId: "33333333-3333-4333-8333-333333333333",
			checkpointId: null,
			type: "finish",
			name: "Exit",
			location: { type: "Point", coordinates: [108.25, 16.06] },
			dayNumber: 1,
			sequenceOrder: 2,
			plannedAt: "2026-10-01T10:00:00.000Z",
			durationMinutes: null,
			metadata: null,
		},
	],
};

describe("ConfigureTripWaypointsPanel", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		checkpointState = {
			items: [checkpoint],
			isLoading: false,
			error: "",
			reload: vi.fn(),
		};
	});

	it("submits configured waypoints for the current draft Trip and shows server status", async () => {
		vi.mocked(tripsService.configureWaypoints).mockResolvedValue({
			...draftTrip,
			status: "pending_approval",
		});
		render(<ConfigureTripWaypointsPanel trip={draftTrip} route={route} />);

		fireEvent.click(screen.getByRole("button", { name: "Chọn vị trí tuyến 2" }));
		fireEvent.change(screen.getByLabelText("Thời gian điểm dừng 2"), {
			target: { value: "2026-10-01T12:00" },
		});

		fireEvent.click(screen.getByRole("button", { name: "Gửi duyệt" }));

		await waitFor(() =>
			expect(tripsService.configureWaypoints).toHaveBeenCalledWith(
				draftTrip.id,
				expect.objectContaining({
					waypoints: expect.arrayContaining([
						expect.objectContaining({
							type: "start",
							plannedAt: expect.any(String),
						}),
						expect.objectContaining({
							type: "finish",
							plannedAt: expect.any(String),
						}),
						expect.objectContaining({
							type: "rest",
							name: "Nghỉ chân",
							location: expect.objectContaining({
								coordinates: [108.24, 16.05],
							}),
							plannedAt: expect.any(String),
						}),
					]),
				})
			)
		);
		expect(await screen.findByTestId("configure-trip-status")).toHaveTextContent("Chờ duyệt");
		expect(screen.getByText(/Lịch trình đã được lưu/)).toBeVisible();
	});

	it("blocks day-trip overnight waypoint before calling the backend", async () => {
		render(<ConfigureTripWaypointsPanel trip={draftTrip} route={route} />);

		fireEvent.click(screen.getByRole("button", { name: "Chọn vị trí tuyến 2" }));
		fireEvent.change(screen.getByLabelText("Điểm dừng 2"), {
			target: { value: "overnight" },
		});
		fireEvent.change(screen.getByLabelText("Thời gian điểm dừng 2"), {
			target: { value: "2026-10-01T12:00" },
		});

		fireEvent.click(screen.getByRole("button", { name: "Gửi duyệt" }));

		expect(
			await screen.findByText("Chuyến đi trong ngày không được có điểm dừng qua đêm")
		).toBeVisible();
		expect(tripsService.configureWaypoints).not.toHaveBeenCalled();
	});

	it("keeps selected day-trip route points on day one before arrival time is chosen", () => {
		render(<ConfigureTripWaypointsPanel trip={draftTrip} route={route} />);

		fireEvent.click(screen.getByRole("button", { name: "Chọn vị trí tuyến 2" }));

		expect(screen.getAllByText("Ngày 1").length).toBeGreaterThanOrEqual(3);
	});

	it("deduplicates duplicated finish waypoints from existing draft data", () => {
		const finishWaypoint = draftTrip.waypoints[1];

		if (!finishWaypoint) {
			throw new Error("Expected finish waypoint to exist");
		}

		render(
			<ConfigureTripWaypointsPanel
				trip={{
					...draftTrip,
					waypoints: [
						...draftTrip.waypoints,
						{
							...finishWaypoint,
							id: "88888888-8888-4888-8888-888888888888",
						},
					],
				}}
				route={route}
			/>
		);

		expect(screen.getAllByText(/Kết thúc/)).toHaveLength(1);
	});

	it("shows empty checkpoint state while preserving custom location editing", () => {
		checkpointState = {
			items: [],
			isLoading: false,
			error: "",
			reload: vi.fn(),
		};

		render(<ConfigureTripWaypointsPanel trip={draftTrip} />);

		expect(screen.getByTestId("trip-waypoint-location-map")).toBeVisible();
		expect(screen.getByRole("button", { name: "Chọn điểm dừng trên bản đồ" })).toBeVisible();
	});

	it("shows blocked state and disables submit when Trip is already published", () => {
		render(<ConfigureTripWaypointsPanel trip={{ ...draftTrip, status: "published" }} />);

		expect(screen.getByText(/không thể cấu hình điểm dừng/)).toBeVisible();
		expect(screen.getByRole("button", { name: "Gửi duyệt" })).toBeDisabled();
	});

	it("shows retry for a backend conflict without clearing form values", async () => {
		vi.mocked(tripsService.configureWaypoints).mockRejectedValue(
			new Error("conflict while submitting")
		);
		render(<ConfigureTripWaypointsPanel trip={draftTrip} />);

		fireEvent.click(screen.getByRole("button", { name: "Mở chỉnh sửa điểm dừng 1" }));
		fireEvent.change(screen.getByLabelText("Mô tả điểm dừng 1"), {
			target: { value: "Keep me" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Gửi duyệt" }));

		expect(await screen.findByRole("alert")).toHaveTextContent("Không thể cấu hình điểm dừng");
		expect(screen.getByLabelText("Mô tả điểm dừng 1")).toHaveValue("Keep me");
		expect(screen.getByRole("button", { name: "Thử lại" })).toBeVisible();
	});
});
