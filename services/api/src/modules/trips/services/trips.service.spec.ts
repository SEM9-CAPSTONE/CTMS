import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { TrekkingRouteStatus } from "../../trekking-routes/entities/trekking-route.entity";
import { WaypointType } from "../entities/trip-waypoint.entity";
import { TripStatus, TripType } from "../entities/trip.entity";
import type { TripsRepository } from "../repositories/trips.repository";
import { TripsService } from "./trips.service";

const HOST_ID = "11111111-1111-4111-8111-111111111111";
const ROUTE_ID = "22222222-2222-4222-8222-222222222222";
const TRIP_ID = "33333333-3333-4333-8333-333333333333";
const CHECKPOINT_ID = "44444444-4444-4444-8444-444444444444";
const OTHER_HOST_ID = "55555555-5555-4555-8555-555555555555";

function createTripDto() {
	return {
		routeId: ROUTE_ID,
		title: "Langbiang sunrise trek",
		description: "A guided route",
		coverImageUrl: "https://example.com/cover.jpg",
		itinerary: { days: 1 },
		includes: { meals: true },
		excludes: { insurance: true },
		tripType: TripType.DAY_TRIP,
		startsAt: "2026-09-20T01:00:00.000Z",
		endsAt: "2026-09-20T10:00:00.000Z",
		meetingPoint: { type: "Point" as const, coordinates: [108.441, 11.941] as [number, number] },
		meetingAt: "2026-09-20T00:30:00.000Z",
		bookingDeadline: "2026-09-19T12:00:00.000Z",
		capacityMin: 2,
		capacityMax: 12,
		pricePerPerson: 100000,
		cancellationPolicy: { refundWindowHours: 48 },
		waypoints: [
			{
				checkpointId: CHECKPOINT_ID,
				type: WaypointType.START,
				name: "Trailhead",
				location: { type: "Point" as const, coordinates: [108.441, 11.941] as [number, number] },
				dayNumber: 1,
				sequenceOrder: 1,
				plannedAt: "2026-09-20T01:00:00.000Z",
				durationMinutes: 15,
				metadata: { note: "briefing" },
			},
			{
				type: WaypointType.FINISH,
				name: "Summit exit",
				location: { type: "Point" as const, coordinates: [108.449, 11.946] as [number, number] },
				dayNumber: 1,
				sequenceOrder: 2,
			},
		],
	};
}

function createdTrip() {
	return {
		id: TRIP_ID,
		hostId: HOST_ID,
		routeId: ROUTE_ID,
		title: "Langbiang sunrise trek",
		description: "A guided route",
		coverImageUrl: "https://example.com/cover.jpg",
		itinerary: { days: 1 },
		includes: { meals: true },
		excludes: { insurance: true },
		tripType: TripType.DAY_TRIP,
		durationNights: 0,
		startsAt: new Date("2026-09-20T01:00:00.000Z"),
		endsAt: new Date("2026-09-20T10:00:00.000Z"),
		meetingPoint: { type: "Point" as const, coordinates: [108.441, 11.941] as [number, number] },
		meetingAt: new Date("2026-09-20T00:30:00.000Z"),
		bookingDeadline: new Date("2026-09-19T12:00:00.000Z"),
		capacityMin: 2,
		capacityMax: 12,
		seatsTaken: 0,
		pricePerPerson: 100000,
		cancellationPolicy: { refundWindowHours: 48 },
		status: TripStatus.DRAFT,
		createdAt: new Date("2026-09-15T00:00:00.000Z"),
		updatedAt: new Date("2026-09-15T00:00:00.000Z"),
		waypoints: [],
	};
}

describe("TripsService", () => {
	let tripsRepository: {
		createDraft: jest.Mock;
		findInvalidWaypointCheckpointIds: jest.Mock;
		findRouteDependencyForUpdate: jest.Mock;
	};
	let auditRepository: { save: jest.Mock };
	let dataSource: { transaction: jest.Mock };
	let service: TripsService;

	beforeEach(() => {
		tripsRepository = {
			createDraft: jest.fn().mockResolvedValue(createdTrip()),
			findInvalidWaypointCheckpointIds: jest.fn().mockResolvedValue([]),
			findRouteDependencyForUpdate: jest.fn().mockResolvedValue({
				id: ROUTE_ID,
				hostId: HOST_ID,
				status: TrekkingRouteStatus.ACTIVE,
			}),
		};
		auditRepository = { save: jest.fn().mockResolvedValue({}) };
		dataSource = {
			transaction: jest.fn(async (callback: (manager: unknown) => unknown) =>
				callback({
					getRepository: jest.fn().mockReturnValue(auditRepository),
					withRepository: jest.fn().mockReturnValue(tripsRepository),
				})
			),
		};
		service = new TripsService(tripsRepository as unknown as TripsRepository, dataSource as never);
	});

	it("creates a draft Trip for the authenticated owning Host and audits the create action", async () => {
		const trip = await service.create(HOST_ID, createTripDto());

		expect(tripsRepository.findRouteDependencyForUpdate).toHaveBeenCalledWith(ROUTE_ID);
		expect(tripsRepository.findInvalidWaypointCheckpointIds).toHaveBeenCalledWith(ROUTE_ID, [
			CHECKPOINT_ID,
		]);
		expect(tripsRepository.createDraft).toHaveBeenCalledWith(
			expect.objectContaining({
				hostId: HOST_ID,
				routeId: ROUTE_ID,
				durationNights: 0,
				waypoints: expect.arrayContaining([
					expect.objectContaining({ type: WaypointType.START, checkpointId: CHECKPOINT_ID }),
					expect.objectContaining({ type: WaypointType.FINISH, checkpointId: null }),
				]),
			})
		);
		expect(trip.status).toBe(TripStatus.DRAFT);
		expect(trip.seatsTaken).toBe(0);
		expect(auditRepository.save).toHaveBeenCalledWith(
			expect.objectContaining({
				actorId: HOST_ID,
				action: "trip.created",
				targetType: "trip",
				targetId: TRIP_ID,
				before: null,
				reason: "host_create_trip",
				after: expect.objectContaining({
					routeId: ROUTE_ID,
					status: TripStatus.DRAFT,
					seatsTaken: 0,
					waypointCount: 0,
				}),
			})
		);
	});

	it("derives durationNights for overnight Trips from the schedule", async () => {
		await service.create(HOST_ID, {
			...createTripDto(),
			tripType: TripType.OVERNIGHT,
			startsAt: "2026-09-20T12:00:00.000Z",
			endsAt: "2026-09-22T10:00:00.000Z",
			waypoints: createTripDto().waypoints.map((waypoint) => ({
				...waypoint,
				plannedAt: undefined,
			})),
		});

		expect(tripsRepository.createDraft).toHaveBeenCalledWith(
			expect.objectContaining({ durationNights: 2 })
		);
	});

	it("allows a free Trip when pricePerPerson is zero", async () => {
		await service.create(HOST_ID, { ...createTripDto(), pricePerPerson: 0 });

		expect(tripsRepository.createDraft).toHaveBeenCalledWith(
			expect.objectContaining({ pricePerPerson: 0 })
		);
	});

	it("returns 404 when the referenced Route does not exist", async () => {
		tripsRepository.findRouteDependencyForUpdate.mockResolvedValue(null);

		await expect(service.create(HOST_ID, createTripDto())).rejects.toBeInstanceOf(
			NotFoundException
		);
		expect(tripsRepository.createDraft).not.toHaveBeenCalled();
		expect(auditRepository.save).not.toHaveBeenCalled();
	});

	it("returns 403 when the Route belongs to another Host", async () => {
		tripsRepository.findRouteDependencyForUpdate.mockResolvedValue({
			id: ROUTE_ID,
			hostId: OTHER_HOST_ID,
			status: TrekkingRouteStatus.ACTIVE,
		});

		await expect(service.create(HOST_ID, createTripDto())).rejects.toBeInstanceOf(
			ForbiddenException
		);
		expect(tripsRepository.createDraft).not.toHaveBeenCalled();
	});

	it.each([
		TrekkingRouteStatus.DRAFT,
		TrekkingRouteStatus.PENDING_APPROVAL,
		TrekkingRouteStatus.CLOSED,
	])("returns 409 when the Route status is %s", async (status) => {
		tripsRepository.findRouteDependencyForUpdate.mockResolvedValue({
			id: ROUTE_ID,
			hostId: HOST_ID,
			status,
		});

		await expect(service.create(HOST_ID, createTripDto())).rejects.toBeInstanceOf(
			ConflictException
		);
		expect(tripsRepository.createDraft).not.toHaveBeenCalled();
	});

	it("returns 422 when a waypoint references a checkpoint outside the selected Route", async () => {
		tripsRepository.findInvalidWaypointCheckpointIds.mockResolvedValue([CHECKPOINT_ID]);

		await expect(service.create(HOST_ID, createTripDto())).rejects.toMatchObject({ status: 422 });
		expect(tripsRepository.createDraft).not.toHaveBeenCalled();
	});

	it.each([
		{
			name: "startsAt is not before endsAt",
			patch: {
				startsAt: "2026-09-20T10:00:00.000Z",
				endsAt: "2026-09-20T10:00:00.000Z",
			},
		},
		{
			name: "bookingDeadline is not before startsAt",
			patch: { bookingDeadline: "2026-09-20T01:00:00.000Z" },
		},
		{
			name: "meetingAt is after startsAt",
			patch: { meetingAt: "2026-09-20T01:01:00.000Z" },
		},
		{
			name: "capacityMin is greater than capacityMax",
			patch: { capacityMin: 13 },
		},
	])("returns 422 when $name", async ({ patch }) => {
		await expect(service.create(HOST_ID, { ...createTripDto(), ...patch })).rejects.toMatchObject({
			status: 422,
		});
		expect(tripsRepository.findRouteDependencyForUpdate).not.toHaveBeenCalled();
		expect(tripsRepository.createDraft).not.toHaveBeenCalled();
	});

	it("returns 422 when waypoint sequence order is duplicated", async () => {
		const dto = createTripDto();
		dto.waypoints[1].sequenceOrder = 1;

		await expect(service.create(HOST_ID, dto)).rejects.toMatchObject({ status: 422 });
		expect(tripsRepository.createDraft).not.toHaveBeenCalled();
	});

	it("returns 422 when start or finish waypoints are missing", async () => {
		const dto = createTripDto();
		dto.waypoints = dto.waypoints.filter((waypoint) => waypoint.type !== WaypointType.FINISH);

		await expect(service.create(HOST_ID, dto)).rejects.toMatchObject({ status: 422 });
		expect(tripsRepository.createDraft).not.toHaveBeenCalled();
	});

	it("propagates audit failure so the transaction can roll back Trip creation", async () => {
		auditRepository.save.mockRejectedValue(new Error("audit unavailable"));

		await expect(service.create(HOST_ID, createTripDto())).rejects.toThrow("audit unavailable");
		expect(tripsRepository.createDraft).toHaveBeenCalledTimes(1);
	});
});
