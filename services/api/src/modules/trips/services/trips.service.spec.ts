import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/jwt.strategy";
import {
	TrekkingRouteDifficulty,
	TrekkingRouteStatus,
} from "../../trekking-routes/entities/trekking-route.entity";
import { UserRole, UserStatus } from "../../users/entities/user.entity";
import { RiskLevel } from "../../weather/entities/weather-risk-assessment.entity";
import type { SearchTripsQueryDto } from "../dto/search-trips-query.dto";
import { WaypointType } from "../entities/trip-waypoint.entity";
import { TripStatus, TripType } from "../entities/trip.entity";
import type { TripsRepository } from "../repositories/trips.repository";
import { TripsService } from "./trips.service";

const HOST_ID = "11111111-1111-4111-8111-111111111111";
const ROUTE_ID = "22222222-2222-4222-8222-222222222222";
const TRIP_ID = "33333333-3333-4333-8333-333333333333";
const CHECKPOINT_ID = "44444444-4444-4444-8444-444444444444";
const OTHER_HOST_ID = "55555555-5555-4555-8555-555555555555";

const CAMPER_ACTOR: AuthenticatedUser = {
	userId: "88888888-8888-4888-8888-888888888888",
	roles: [UserRole.CAMPER],
	status: UserStatus.ACTIVE,
};

const HOST_ACTOR: AuthenticatedUser = {
	userId: HOST_ID,
	roles: [UserRole.HOST],
	status: UserStatus.ACTIVE,
};

const ADMIN_ACTOR: AuthenticatedUser = {
	userId: "99999999-9999-4999-8999-999999999999",
	roles: [UserRole.ADMIN],
	status: UserStatus.ACTIVE,
};

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

function configuredTrip() {
	return {
		...createdTrip(),
		status: TripStatus.PENDING_APPROVAL,
		waypoints: [
			{
				id: "66666666-6666-4666-8666-666666666666",
				tripId: TRIP_ID,
				checkpointId: CHECKPOINT_ID,
				type: WaypointType.START,
				name: "Trailhead",
				location: { type: "Point" as const, coordinates: [108.441, 11.941] as [number, number] },
				dayNumber: 1,
				sequenceOrder: 1,
				plannedAt: new Date("2026-09-20T01:00:00.000Z"),
				durationMinutes: 15,
				metadata: { note: "briefing" },
			},
			{
				id: "77777777-7777-4777-8777-777777777777",
				tripId: TRIP_ID,
				checkpointId: null,
				type: WaypointType.FINISH,
				name: "Summit exit",
				location: { type: "Point" as const, coordinates: [108.449, 11.946] as [number, number] },
				dayNumber: 1,
				sequenceOrder: 2,
				plannedAt: null,
				durationMinutes: null,
				metadata: null,
			},
		],
	};
}

describe("TripsService", () => {
	let tripsRepository: {
		createDraft: jest.Mock;
		findByIdForWaypointConfiguration: jest.Mock;
		findInvalidWaypointCheckpointIds: jest.Mock;
		findRouteDependencyForUpdate: jest.Mock;
		replaceWaypointsAndSubmitForApproval: jest.Mock;
		findById: jest.Mock;
		findTripsByHost: jest.Mock;
		searchPublishedTrips: jest.Mock;
	};
	let auditRepository: { save: jest.Mock };
	let dataSource: { transaction: jest.Mock };
	let service: TripsService;

	beforeEach(() => {
		tripsRepository = {
			createDraft: jest.fn().mockResolvedValue(createdTrip()),
			findByIdForWaypointConfiguration: jest.fn().mockResolvedValue({
				trip: createdTrip(),
				hostId: HOST_ID,
				routeId: ROUTE_ID,
				status: TripStatus.DRAFT,
			}),
			findInvalidWaypointCheckpointIds: jest.fn().mockResolvedValue([]),
			findRouteDependencyForUpdate: jest.fn().mockResolvedValue({
				id: ROUTE_ID,
				hostId: HOST_ID,
				status: TrekkingRouteStatus.ACTIVE,
			}),
			replaceWaypointsAndSubmitForApproval: jest.fn().mockResolvedValue(configuredTrip()),
			findById: jest.fn().mockResolvedValue(createdTrip()),
			findTripsByHost: jest.fn().mockResolvedValue([]),
			searchPublishedTrips: jest.fn().mockResolvedValue({ items: [], total: 0 }),
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

	it("allows capacityMax to be null for an unlimited Trip", async () => {
		await service.create(HOST_ID, { ...createTripDto(), capacityMax: null });

		expect(tripsRepository.createDraft).toHaveBeenCalledWith(
			expect.objectContaining({ capacityMax: null })
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
			name: "day_trip spans multiple dates",
			patch: {
				endsAt: "2026-09-21T10:00:00.000Z",
				waypoints: createTripDto().waypoints.map((waypoint) => ({
					...waypoint,
					plannedAt: undefined,
				})),
			},
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

	describe("configureWaypoints", () => {
		it("replaces draft Trip waypoints, submits the Trip for approval, and audits the change", async () => {
			const result = await service.configureWaypoints(HOST_ID, TRIP_ID, {
				waypoints: createTripDto().waypoints,
			});

			expect(tripsRepository.findByIdForWaypointConfiguration).toHaveBeenCalledWith(TRIP_ID);
			expect(tripsRepository.findInvalidWaypointCheckpointIds).toHaveBeenCalledWith(ROUTE_ID, [
				CHECKPOINT_ID,
			]);
			expect(tripsRepository.replaceWaypointsAndSubmitForApproval).toHaveBeenCalledWith(
				TRIP_ID,
				expect.arrayContaining([
					expect.objectContaining({ type: WaypointType.START, checkpointId: CHECKPOINT_ID }),
					expect.objectContaining({ type: WaypointType.FINISH, checkpointId: null }),
				])
			);
			expect(result.status).toBe(TripStatus.PENDING_APPROVAL);
			expect(auditRepository.save).toHaveBeenCalledWith(
				expect.objectContaining({
					actorId: HOST_ID,
					action: "trip_waypoints.configured",
					targetType: "trip",
					targetId: TRIP_ID,
					reason: "host_configure_trip_waypoints",
					before: expect.objectContaining({ status: TripStatus.DRAFT }),
					after: expect.objectContaining({ status: TripStatus.PENDING_APPROVAL }),
				})
			);
		});

		it("returns 404 when the Trip does not exist", async () => {
			tripsRepository.findByIdForWaypointConfiguration.mockResolvedValue(null);

			await expect(
				service.configureWaypoints(HOST_ID, TRIP_ID, { waypoints: createTripDto().waypoints })
			).rejects.toBeInstanceOf(NotFoundException);
			expect(tripsRepository.replaceWaypointsAndSubmitForApproval).not.toHaveBeenCalled();
		});

		it("returns 403 when the Trip belongs to another Host", async () => {
			tripsRepository.findByIdForWaypointConfiguration.mockResolvedValue({
				trip: createdTrip(),
				hostId: OTHER_HOST_ID,
				routeId: ROUTE_ID,
				status: TripStatus.DRAFT,
			});

			await expect(
				service.configureWaypoints(HOST_ID, TRIP_ID, { waypoints: createTripDto().waypoints })
			).rejects.toBeInstanceOf(ForbiddenException);
			expect(tripsRepository.replaceWaypointsAndSubmitForApproval).not.toHaveBeenCalled();
		});

		it("returns the existing pending Trip for an identical retry without writing again", async () => {
			const pendingTrip = configuredTrip();
			tripsRepository.findByIdForWaypointConfiguration.mockResolvedValue({
				trip: pendingTrip,
				hostId: HOST_ID,
				routeId: ROUTE_ID,
				status: TripStatus.PENDING_APPROVAL,
			});

			const result = await service.configureWaypoints(HOST_ID, TRIP_ID, {
				waypoints: createTripDto().waypoints,
			});

			expect(result).toBe(pendingTrip);
			expect(tripsRepository.replaceWaypointsAndSubmitForApproval).not.toHaveBeenCalled();
			expect(auditRepository.save).not.toHaveBeenCalled();
		});

		it("returns 409 when a non-draft Trip is submitted with different waypoints", async () => {
			tripsRepository.findByIdForWaypointConfiguration.mockResolvedValue({
				trip: { ...createdTrip(), status: TripStatus.PUBLISHED },
				hostId: HOST_ID,
				routeId: ROUTE_ID,
				status: TripStatus.PUBLISHED,
			});

			await expect(
				service.configureWaypoints(HOST_ID, TRIP_ID, { waypoints: createTripDto().waypoints })
			).rejects.toBeInstanceOf(ConflictException);
			expect(tripsRepository.replaceWaypointsAndSubmitForApproval).not.toHaveBeenCalled();
		});

		it("returns 422 when a day Trip includes an overnight waypoint", async () => {
			const dto = createTripDto();
			dto.waypoints.splice(1, 0, {
				type: WaypointType.OVERNIGHT,
				name: "Camp",
				location: { type: "Point" as const, coordinates: [108.445, 11.943] as [number, number] },
				dayNumber: 1,
				sequenceOrder: 2,
			});
			dto.waypoints[2].sequenceOrder = 3;

			await expect(
				service.configureWaypoints(HOST_ID, TRIP_ID, { waypoints: dto.waypoints })
			).rejects.toMatchObject({
				status: 422,
			});
			expect(tripsRepository.replaceWaypointsAndSubmitForApproval).not.toHaveBeenCalled();
		});

		it("returns 422 when a waypoint references a checkpoint outside the Trip route", async () => {
			tripsRepository.findInvalidWaypointCheckpointIds.mockResolvedValue([CHECKPOINT_ID]);

			await expect(
				service.configureWaypoints(HOST_ID, TRIP_ID, { waypoints: createTripDto().waypoints })
			).rejects.toMatchObject({ status: 422 });
			expect(tripsRepository.replaceWaypointsAndSubmitForApproval).not.toHaveBeenCalled();
		});
	});

	describe("search", () => {
		it("returns paginated search results for published trips", async () => {
			const mockSummary = {
				id: TRIP_ID,
				title: "Langbiang sunrise trek",
				description: "A guided route",
				coverImageUrl: "https://example.com/cover.jpg",
				tripType: TripType.DAY_TRIP,
				durationNights: 0,
				startsAt: new Date("2026-09-20T01:00:00.000Z"),
				endsAt: new Date("2026-09-20T10:00:00.000Z"),
				meetingPoint: { type: "Point", coordinates: [108.441, 11.941] },
				meetingAt: new Date("2026-09-20T00:30:00.000Z"),
				bookingDeadline: new Date("2026-09-19T12:00:00.000Z"),
				capacityMin: 2,
				capacityMax: 12,
				seatsTaken: 2,
				remainingSeats: 10,
				pricePerPerson: 100000,
				status: TripStatus.PUBLISHED,
				difficulty: TrekkingRouteDifficulty.MODERATE,
				weatherRiskLevel: RiskLevel.GREEN,
				isBookable: true,
				createdAt: new Date("2026-09-15T00:00:00.000Z"),
				updatedAt: new Date("2026-09-15T00:00:00.000Z"),
			};
			tripsRepository.searchPublishedTrips.mockResolvedValue({
				items: [mockSummary],
				total: 1,
			});

			const query: SearchTripsQueryDto = {
				page: 1,
				limit: 10,
			};
			const result = await service.search(query);

			expect(tripsRepository.searchPublishedTrips).toHaveBeenCalledWith({
				search: undefined,
				tripType: undefined,
				difficulty: undefined,
				startDate: undefined,
				endDate: undefined,
				minPrice: undefined,
				maxPrice: undefined,
				routeId: undefined,
				province: undefined,
				city: undefined,
				page: 1,
				limit: 10,
			});
			expect(result.items).toHaveLength(1);
			expect(result.items[0]).toEqual(mockSummary);
			expect(result.pagination).toEqual({
				page: 1,
				limit: 10,
				total: 1,
				totalPages: 1,
			});
		});

		it("passes filter parameters to the repository", async () => {
			tripsRepository.searchPublishedTrips.mockResolvedValue({
				items: [],
				total: 0,
			});

			const query: SearchTripsQueryDto = {
				search: "sunrise",
				tripType: TripType.DAY_TRIP,
				difficulty: TrekkingRouteDifficulty.MODERATE,
				startDate: "2026-09-20T00:00:00.000Z",
				endDate: "2026-09-25T00:00:00.000Z",
				minPrice: 50000,
				maxPrice: 200000,
				routeId: ROUTE_ID,
				province: "Lam Dong",
				city: "Da Lat",
				page: 2,
				limit: 5,
			};

			const result = await service.search(query);

			expect(tripsRepository.searchPublishedTrips).toHaveBeenCalledWith({
				search: "sunrise",
				tripType: TripType.DAY_TRIP,
				difficulty: TrekkingRouteDifficulty.MODERATE,
				startDate: new Date("2026-09-20T00:00:00.000Z"),
				endDate: new Date("2026-09-25T00:00:00.000Z"),
				minPrice: 50000,
				maxPrice: 200000,
				routeId: ROUTE_ID,
				province: "Lam Dong",
				city: "Da Lat",
				page: 2,
				limit: 5,
			});
			expect(result.pagination.totalPages).toBe(0);
		});

		it("returns 422 when startDate is after endDate", async () => {
			const query: SearchTripsQueryDto = {
				startDate: "2026-09-25T00:00:00.000Z",
				endDate: "2026-09-20T00:00:00.000Z",
				page: 1,
				limit: 10,
			};

			await expect(service.search(query)).rejects.toMatchObject({
				status: 422,
			});
			expect(tripsRepository.searchPublishedTrips).not.toHaveBeenCalled();
		});

		it("returns 422 when minPrice is greater than maxPrice", async () => {
			const query: SearchTripsQueryDto = {
				minPrice: 300000,
				maxPrice: 100000,
				page: 1,
				limit: 10,
			};

			await expect(service.search(query)).rejects.toMatchObject({
				status: 422,
			});
			expect(tripsRepository.searchPublishedTrips).not.toHaveBeenCalled();
		});
	});

	describe("getTripDetails", () => {
		it("returns published Trip details for a Camper and redacts routeId (BR-077, BR-214)", async () => {
			const publishedTrip = {
				...createdTrip(),
				status: TripStatus.PUBLISHED,
				difficulty: TrekkingRouteDifficulty.MODERATE,
				weatherRiskLevel: RiskLevel.GREEN,
				remainingSeats: 12,
				isBookable: true,
			};
			tripsRepository.findById.mockResolvedValue(publishedTrip);

			const result = await service.getTripDetails(CAMPER_ACTOR, TRIP_ID);

			expect(tripsRepository.findById).toHaveBeenCalledWith(TRIP_ID);
			expect(result.id).toBe(TRIP_ID);
			expect(result.status).toBe(TripStatus.PUBLISHED);
			expect(result.difficulty).toBe(TrekkingRouteDifficulty.MODERATE);
			expect(result.weatherRiskLevel).toBe(RiskLevel.GREEN);
			expect(result.isBookable).toBe(true);
			expect(result.routeId).toBeUndefined();
		});

		it("returns published Trip details with routeId retained for the owning Host", async () => {
			const publishedTrip = {
				...createdTrip(),
				status: TripStatus.PUBLISHED,
				difficulty: TrekkingRouteDifficulty.MODERATE,
				weatherRiskLevel: RiskLevel.GREEN,
				remainingSeats: 12,
				isBookable: true,
			};
			tripsRepository.findById.mockResolvedValue(publishedTrip);

			const result = await service.getTripDetails(HOST_ACTOR, TRIP_ID);

			expect(result.routeId).toBe(ROUTE_ID);
		});

		it("returns published Trip details with routeId retained for an Admin", async () => {
			const publishedTrip = {
				...createdTrip(),
				status: TripStatus.PUBLISHED,
				difficulty: TrekkingRouteDifficulty.MODERATE,
				weatherRiskLevel: RiskLevel.GREEN,
				remainingSeats: 12,
				isBookable: true,
			};
			tripsRepository.findById.mockResolvedValue(publishedTrip);

			const result = await service.getTripDetails(ADMIN_ACTOR, TRIP_ID);

			expect(result.routeId).toBe(ROUTE_ID);
		});

		it("returns 404 when Camper attempts to view a draft Trip (BR-073, BR-075, BR-202)", async () => {
			const draftTrip = {
				...createdTrip(),
				status: TripStatus.DRAFT,
			};
			tripsRepository.findById.mockResolvedValue(draftTrip);

			await expect(service.getTripDetails(CAMPER_ACTOR, TRIP_ID)).rejects.toBeInstanceOf(
				NotFoundException
			);
		});

		it("returns 404 when Camper attempts to view a cancelled Trip (BR-073, BR-075)", async () => {
			const cancelledTrip = {
				...createdTrip(),
				status: TripStatus.CANCELLED,
			};
			tripsRepository.findById.mockResolvedValue(cancelledTrip);

			await expect(service.getTripDetails(CAMPER_ACTOR, TRIP_ID)).rejects.toBeInstanceOf(
				NotFoundException
			);
		});

		it("allows owning Host to view their own draft Trip", async () => {
			const draftTrip = {
				...createdTrip(),
				status: TripStatus.DRAFT,
			};
			tripsRepository.findById.mockResolvedValue(draftTrip);

			const result = await service.getTripDetails(HOST_ACTOR, TRIP_ID);

			expect(result.id).toBe(TRIP_ID);
			expect(result.status).toBe(TripStatus.DRAFT);
			expect(result.routeId).toBe(ROUTE_ID);
		});

		it("allows Admin to view any draft Trip", async () => {
			const draftTrip = {
				...createdTrip(),
				status: TripStatus.DRAFT,
			};
			tripsRepository.findById.mockResolvedValue(draftTrip);

			const result = await service.getTripDetails(ADMIN_ACTOR, TRIP_ID);

			expect(result.id).toBe(TRIP_ID);
			expect(result.status).toBe(TripStatus.DRAFT);
			expect(result.routeId).toBe(ROUTE_ID);
		});

		it("returns 404 when Trip does not exist in database", async () => {
			tripsRepository.findById.mockResolvedValue(null);

			await expect(service.getTripDetails(CAMPER_ACTOR, TRIP_ID)).rejects.toBeInstanceOf(
				NotFoundException
			);
		});
	});

	describe("getMyTrips", () => {
		it("returns list of trips owned by the host from repository", async () => {
			const myTrips = [createdTrip()];
			tripsRepository.findTripsByHost.mockResolvedValue(myTrips);

			const result = await service.getMyTrips(HOST_ID);

			expect(tripsRepository.findTripsByHost).toHaveBeenCalledWith(HOST_ID);
			expect(result).toBe(myTrips);
		});
	});
});
