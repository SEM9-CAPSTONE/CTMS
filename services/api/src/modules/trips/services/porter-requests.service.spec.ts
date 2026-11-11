import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { DataSource, EntityManager } from "typeorm";
import type { EventsGateway } from "../../realtime/events.gateway";
import { IntendedPorterRole } from "../dto/available-porters-query.dto";
import { type PorterRequest, PorterRequestStatus } from "../entities/porter-request.entity";
import { TripStatus } from "../entities/trip.entity";
import type { CreatePendingPorterRequestInput } from "../repositories/porter-requests.repository";
import type { PorterRequestsRepository } from "../repositories/porter-requests.repository";
import type {
	PorterAvailabilityTripContext,
	TripsRepository,
} from "../repositories/trips.repository";
import { PorterRequestsService } from "./porter-requests.service";

const HOST_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_HOST_ID = "22222222-2222-4222-8222-222222222222";
const TRIP_ID = "33333333-3333-4333-8333-333333333333";
const ROUTE_ID = "44444444-4444-4444-8444-444444444444";
const PORTER_ID = "55555555-5555-4555-8555-555555555555";
const REQUEST_ID = "66666666-6666-4666-8666-666666666666";
const NOW = new Date("2035-01-01T00:00:00.000Z");
const STARTS_AT = new Date("2035-01-03T00:00:00.000Z");
const ENDS_AT = new Date("2035-01-03T08:00:00.000Z");

function buildRequest(expiresAt = new Date("2035-01-02T00:00:00.000Z")): PorterRequest {
	return {
		id: REQUEST_ID,
		tripId: TRIP_ID,
		porterId: PORTER_ID,
		requestedBy: HOST_ID,
		requestedRole: IntendedPorterRole.LEAD,
		note: "Lead river crossing",
		status: PorterRequestStatus.PENDING,
		expiresAt,
		respondedAt: null,
		createdAt: NOW,
		updatedAt: NOW,
	} as PorterRequest;
}

describe("PorterRequestsService", () => {
	let dataSource: { transaction: jest.Mock };
	let manager: { withRepository: jest.Mock; query: jest.Mock };
	let tripsRepository: { findPorterAvailabilityContext: jest.Mock };
	let porterRequestsRepository: {
		hasActiveAssignmentForTrip: jest.Mock;
		createPendingIdempotent: jest.Mock;
		findPendingByTripAndPorter: jest.Mock;
	};
	let configService: { get: jest.Mock };
	let eventsGateway: { emitPorterRequestCreated: jest.Mock };
	let service: PorterRequestsService;
	let order: string[];

	beforeEach(() => {
		order = [];
		tripsRepository = {
			findPorterAvailabilityContext: jest.fn().mockResolvedValue({
				id: TRIP_ID,
				hostId: HOST_ID,
				routeId: ROUTE_ID,
				startsAt: STARTS_AT,
				endsAt: ENDS_AT,
				status: TripStatus.PUBLISHED,
				hasActivePorter: false,
			} satisfies PorterAvailabilityTripContext),
		};
		porterRequestsRepository = {
			hasActiveAssignmentForTrip: jest.fn().mockResolvedValue(false),
			createPendingIdempotent: jest.fn().mockResolvedValue({
				request: buildRequest(),
				created: true,
			}),
			findPendingByTripAndPorter: jest.fn().mockResolvedValue(buildRequest()),
		};
		manager = {
			withRepository: jest.fn((repository: unknown) => repository),
			query: jest
				.fn()
				.mockResolvedValueOnce([{ now: NOW }])
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([{ "?column?": 1 }]),
		};
		dataSource = {
			transaction: jest.fn(async (work: (entityManager: EntityManager) => unknown) => {
				const result = await work(manager as unknown as EntityManager);
				order.push("commit");
				return result;
			}),
		};
		configService = { get: jest.fn().mockReturnValue("24") };
		eventsGateway = {
			emitPorterRequestCreated: jest.fn(() => {
				order.push("notify");
			}),
		};
		service = new PorterRequestsService(
			dataSource as unknown as DataSource,
			tripsRepository as unknown as TripsRepository,
			porterRequestsRepository as unknown as PorterRequestsRepository,
			configService as unknown as ConfigService,
			eventsGateway as unknown as EventsGateway
		);
	});

	it("creates a pending request inside a transaction and notifies only after commit", async () => {
		const result = await service.create(HOST_ID, TRIP_ID, {
			porterId: PORTER_ID,
			requestedRole: IntendedPorterRole.LEAD,
			note: "Lead river crossing",
		});

		expect(tripsRepository.findPorterAvailabilityContext).toHaveBeenCalledWith(TRIP_ID);
		expect(porterRequestsRepository.createPendingIdempotent).toHaveBeenCalledWith({
			tripId: TRIP_ID,
			porterId: PORTER_ID,
			requestedBy: HOST_ID,
			requestedRole: IntendedPorterRole.LEAD,
			note: "Lead river crossing",
			expiresAt: new Date("2035-01-02T00:00:00.000Z"),
		});
		expect(eventsGateway.emitPorterRequestCreated).toHaveBeenCalledWith({
			requestId: REQUEST_ID,
			tripId: TRIP_ID,
			porterId: PORTER_ID,
			requestedBy: HOST_ID,
			requestedRole: IntendedPorterRole.LEAD,
			expiresAt: "2035-01-02T00:00:00.000Z",
		});
		expect(order).toEqual(["commit", "notify"]);
		expect(result.id).toBe(REQUEST_ID);
	});

	it("caps expiry at the Trip start when policy TTL would go beyond it", async () => {
		configService.get.mockReturnValue("72");
		porterRequestsRepository.createPendingIdempotent.mockImplementation(
			async (input: CreatePendingPorterRequestInput) => ({
				request: buildRequest(input.expiresAt),
				created: true,
			})
		);

		const result = await service.create(HOST_ID, TRIP_ID, {
			porterId: PORTER_ID,
			requestedRole: IntendedPorterRole.SUPPORT,
		});

		expect(porterRequestsRepository.createPendingIdempotent).toHaveBeenCalledWith(
			expect.objectContaining({ expiresAt: STARTS_AT })
		);
		expect(result.expiresAt).toEqual(STARTS_AT);
	});

	it("returns an existing pending request without emitting a duplicate notification", async () => {
		porterRequestsRepository.createPendingIdempotent.mockResolvedValue({
			request: buildRequest(),
			created: false,
		});

		const result = await service.create(HOST_ID, TRIP_ID, {
			porterId: PORTER_ID,
			requestedRole: IntendedPorterRole.LEAD,
		});

		expect(result.id).toBe(REQUEST_ID);
		expect(eventsGateway.emitPorterRequestCreated).not.toHaveBeenCalled();
	});

	it("finds an active pending request for the owning Host", async () => {
		const result = await service.findPending(HOST_ID, TRIP_ID, PORTER_ID);

		expect(tripsRepository.findPorterAvailabilityContext).toHaveBeenCalledWith(TRIP_ID);
		expect(porterRequestsRepository.findPendingByTripAndPorter).toHaveBeenCalledWith(
			TRIP_ID,
			PORTER_ID
		);
		expect(result).toEqual(expect.objectContaining({ id: REQUEST_ID, status: "pending" }));
	});

	it("returns null when no active pending request exists", async () => {
		porterRequestsRepository.findPendingByTripAndPorter.mockResolvedValue(null);

		await expect(service.findPending(HOST_ID, TRIP_ID, PORTER_ID)).resolves.toBeNull();
	});

	it("rejects pending lookup for a Host that does not manage the Trip", async () => {
		tripsRepository.findPorterAvailabilityContext.mockResolvedValue({
			id: TRIP_ID,
			hostId: OTHER_HOST_ID,
			routeId: ROUTE_ID,
			startsAt: STARTS_AT,
			endsAt: ENDS_AT,
		});

		await expect(service.findPending(HOST_ID, TRIP_ID, PORTER_ID)).rejects.toBeInstanceOf(
			ForbiddenException
		);
		expect(porterRequestsRepository.findPendingByTripAndPorter).not.toHaveBeenCalled();
	});

	it("keeps the committed request when post-commit notification fails", async () => {
		eventsGateway.emitPorterRequestCreated.mockImplementation(() => {
			order.push("notify");
			throw new Error("socket offline");
		});

		await expect(
			service.create(HOST_ID, TRIP_ID, {
				porterId: PORTER_ID,
				requestedRole: IntendedPorterRole.LEAD,
			})
		).resolves.toEqual(expect.objectContaining({ id: REQUEST_ID }));
		expect(order).toEqual(["commit", "notify"]);
	});

	it("rejects a missing Trip", async () => {
		tripsRepository.findPorterAvailabilityContext.mockResolvedValue(null);

		await expect(
			service.create(HOST_ID, TRIP_ID, {
				porterId: PORTER_ID,
				requestedRole: IntendedPorterRole.SUPPORT,
			})
		).rejects.toBeInstanceOf(NotFoundException);
		expect(porterRequestsRepository.createPendingIdempotent).not.toHaveBeenCalled();
	});

	it("rejects a Host that does not manage the Trip", async () => {
		tripsRepository.findPorterAvailabilityContext.mockResolvedValue({
			id: TRIP_ID,
			hostId: OTHER_HOST_ID,
			routeId: ROUTE_ID,
			startsAt: STARTS_AT,
			endsAt: ENDS_AT,
		});

		await expect(
			service.create(HOST_ID, TRIP_ID, {
				porterId: PORTER_ID,
				requestedRole: IntendedPorterRole.SUPPORT,
			})
		).rejects.toBeInstanceOf(ForbiddenException);
		expect(porterRequestsRepository.createPendingIdempotent).not.toHaveBeenCalled();
	});

	it("rejects when schedule conflict revalidation finds an overlapping assignment", async () => {
		manager.query = jest
			.fn()
			.mockResolvedValueOnce([{ now: NOW }])
			.mockResolvedValueOnce([{ "?column?": 1 }]);

		await expect(
			service.create(HOST_ID, TRIP_ID, {
				porterId: PORTER_ID,
				requestedRole: IntendedPorterRole.SUPPORT,
			})
		).rejects.toBeInstanceOf(ConflictException);
		expect(porterRequestsRepository.createPendingIdempotent).not.toHaveBeenCalled();
	});

	it("rejects when active Porter/profile/qualification eligibility cannot be revalidated", async () => {
		manager.query = jest
			.fn()
			.mockResolvedValueOnce([{ now: NOW }])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([]);

		await expect(
			service.create(HOST_ID, TRIP_ID, {
				porterId: PORTER_ID,
				requestedRole: IntendedPorterRole.LEAD,
			})
		).rejects.toBeInstanceOf(ConflictException);
		expect(porterRequestsRepository.createPendingIdempotent).not.toHaveBeenCalled();
	});
});
