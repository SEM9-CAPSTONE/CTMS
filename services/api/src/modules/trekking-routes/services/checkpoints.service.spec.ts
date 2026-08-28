import type { Campsite } from "../../campsites/entities/campsite.entity";
import type { CreateCheckpointDto } from "../dto/create-checkpoint.dto";
import { CheckpointType } from "../entities/checkpoint.entity";
import { TrekkingRouteDifficulty, TrekkingRouteStatus } from "../entities/trekking-route.entity";
import type { CheckpointsRepository } from "../repositories/checkpoints.repository";
import { CheckpointsService } from "./checkpoints.service";

const HOST_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_HOST_ID = "22222222-2222-4222-8222-222222222222";
const CAMPSITE_ID = "33333333-3333-4333-8333-333333333333";
const ROUTE_ID = "44444444-4444-4444-8444-444444444444";
const CHECKPOINT_ID = "55555555-5555-4555-8555-555555555555";

const dto: CreateCheckpointDto = {
	name: "Ridge rest",
	location: { type: "Point", coordinates: [108.46, 11.94] },
	radiusMeters: 30,
	type: CheckpointType.REST,
	expectedArrivalOffset: 45,
	instructions: "Rest and check water.",
	nearbyWaterOrShelter: true,
};

const checkpoint = {
	id: CHECKPOINT_ID,
	routeId: ROUTE_ID,
	...dto,
	routePosition: 0.4,
	createdAt: new Date("2026-08-25T00:00:00.000Z"),
	updatedAt: new Date("2026-08-25T00:00:00.000Z"),
};

function route(hostId = HOST_ID, status = TrekkingRouteStatus.DRAFT) {
	return {
		id: ROUTE_ID,
		campsiteId: CAMPSITE_ID,
		campsite: { id: CAMPSITE_ID, hostId } as Campsite,
		name: "Pine trail",
		description: null,
		routeGeom: {
			type: "LineString" as const,
			coordinates: [
				[108.45, 11.94],
				[108.47, 11.94],
			] as Array<[number, number]>,
		},
		lengthMeters: 2100,
		difficulty: TrekkingRouteDifficulty.MODERATE,
		expectedDurationMinutes: 120,
		status,
		createdAt: new Date(),
		updatedAt: new Date(),
	};
}

describe("CheckpointsService", () => {
	let routeQuery: {
		innerJoinAndSelect: jest.Mock;
		where: jest.Mock;
		setLock: jest.Mock;
		getOne: jest.Mock;
	};
	let routeRepository: { findOne: jest.Mock; createQueryBuilder: jest.Mock };
	let checkpointRepository: { findByRoute: jest.Mock; createForRoute: jest.Mock };
	let auditRepository: { save: jest.Mock };
	let manager: { getRepository: jest.Mock; withRepository: jest.Mock };
	let dataSource: { getRepository: jest.Mock; transaction: jest.Mock };
	let service: CheckpointsService;

	beforeEach(() => {
		routeQuery = {
			innerJoinAndSelect: jest.fn(),
			where: jest.fn(),
			setLock: jest.fn(),
			getOne: jest.fn().mockResolvedValue(route()),
		};
		routeQuery.innerJoinAndSelect.mockReturnValue(routeQuery);
		routeQuery.where.mockReturnValue(routeQuery);
		routeQuery.setLock.mockReturnValue(routeQuery);
		routeRepository = {
			findOne: jest.fn().mockResolvedValue(route()),
			createQueryBuilder: jest.fn().mockReturnValue(routeQuery),
		};
		checkpointRepository = {
			findByRoute: jest.fn().mockResolvedValue([checkpoint]),
			createForRoute: jest.fn().mockResolvedValue(checkpoint),
		};
		auditRepository = { save: jest.fn().mockResolvedValue({}) };
		manager = {
			getRepository: jest.fn((entity: { name?: string }) =>
				entity.name === "TrekkingRoute" ? routeRepository : auditRepository
			),
			withRepository: jest.fn().mockReturnValue(checkpointRepository),
		};
		dataSource = {
			getRepository: jest.fn().mockReturnValue(routeRepository),
			transaction: jest.fn(async (callback: (value: typeof manager) => unknown) =>
				callback(manager)
			),
		};
		service = new CheckpointsService(
			checkpointRepository as unknown as CheckpointsRepository,
			dataSource as never
		);
	});

	it("lists checkpoints only after verifying route ownership", async () => {
		await expect(service.list(HOST_ID, ROUTE_ID)).resolves.toEqual([checkpoint]);
		expect(routeRepository.findOne).toHaveBeenCalledWith({
			where: { id: ROUTE_ID },
			relations: { campsite: true },
		});
		expect(checkpointRepository.findByRoute).toHaveBeenCalledWith(ROUTE_ID);
	});

	it("returns 404 for a missing route and 403 for another Host's route", async () => {
		routeRepository.findOne.mockResolvedValueOnce(null);
		await expect(service.list(HOST_ID, ROUTE_ID)).rejects.toMatchObject({ status: 404 });
		routeRepository.findOne.mockResolvedValueOnce(route(OTHER_HOST_ID));
		await expect(service.list(HOST_ID, ROUTE_ID)).rejects.toMatchObject({ status: 403 });
		expect(checkpointRepository.findByRoute).not.toHaveBeenCalled();
	});

	it("locks the route, creates the checkpoint, and writes the exact audit in one transaction", async () => {
		await expect(service.create(HOST_ID, ROUTE_ID, dto)).resolves.toEqual(checkpoint);
		expect(routeRepository.createQueryBuilder).toHaveBeenCalledWith("route");
		expect(routeQuery.innerJoinAndSelect).toHaveBeenCalledWith("route.campsite", "campsite");
		expect(routeQuery.where).toHaveBeenCalledWith("route.id = :routeId", { routeId: ROUTE_ID });
		expect(routeQuery.setLock).toHaveBeenCalledWith("pessimistic_write");
		expect(checkpointRepository.createForRoute).toHaveBeenCalledWith({ routeId: ROUTE_ID, ...dto });
		expect(auditRepository.save).toHaveBeenCalledWith({
			actorId: HOST_ID,
			action: "trekking_route_checkpoint.created",
			targetType: "trekking_route_checkpoint",
			targetId: CHECKPOINT_ID,
			before: null,
			after: expect.objectContaining({
				id: CHECKPOINT_ID,
				routeId: ROUTE_ID,
				location: dto.location,
				routePosition: 0.4,
			}),
			reason: "host_create_trekking_route_checkpoint",
		});
	});

	it("returns 404 for a missing route and 403 for another Host's route before create writes", async () => {
		routeQuery.getOne.mockResolvedValueOnce(null);
		await expect(service.create(HOST_ID, ROUTE_ID, dto)).rejects.toMatchObject({ status: 404 });

		routeQuery.getOne.mockResolvedValueOnce(route(OTHER_HOST_ID));
		await expect(service.create(HOST_ID, ROUTE_ID, dto)).rejects.toMatchObject({ status: 403 });
		expect(checkpointRepository.createForRoute).not.toHaveBeenCalled();
		expect(auditRepository.save).not.toHaveBeenCalled();
	});

	it.each([
		TrekkingRouteStatus.PENDING_APPROVAL,
		TrekkingRouteStatus.ACTIVE,
		TrekkingRouteStatus.CLOSED,
	])("rejects a %s route with 409 before checkpoint or audit writes", async (status) => {
		routeQuery.getOne.mockResolvedValue(route(HOST_ID, status));
		await expect(service.create(HOST_ID, ROUTE_ID, dto)).rejects.toMatchObject({ status: 409 });
		expect(checkpointRepository.createForRoute).not.toHaveBeenCalled();
		expect(auditRepository.save).not.toHaveBeenCalled();
	});

	it("accepts an offset equal to the parent route duration", async () => {
		await expect(
			service.create(HOST_ID, ROUTE_ID, { ...dto, expectedArrivalOffset: 120 })
		).resolves.toEqual(checkpoint);
		expect(checkpointRepository.createForRoute).toHaveBeenCalledWith({
			routeId: ROUTE_ID,
			...dto,
			expectedArrivalOffset: 120,
		});
	});

	it("rejects an offset beyond the parent duration with 422", async () => {
		await expect(
			service.create(HOST_ID, ROUTE_ID, { ...dto, expectedArrivalOffset: 121 })
		).rejects.toMatchObject({ status: 422 });
		expect(checkpointRepository.createForRoute).not.toHaveBeenCalled();
	});

	it("propagates audit failures so the surrounding transaction can roll back", async () => {
		auditRepository.save.mockRejectedValue(new Error("audit unavailable"));
		await expect(service.create(HOST_ID, ROUTE_ID, dto)).rejects.toThrow("audit unavailable");
		expect(checkpointRepository.createForRoute).toHaveBeenCalledTimes(1);
	});
});
